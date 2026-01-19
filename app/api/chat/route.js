import { supabase } from '../../lib/supabase';
import { SCENARIOS, getCoachFeedback, calculatePerformance, ENCOURAGEMENTS } from '../../lib/scenarios';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============ 本地随机开场白库（确保即使API失败也能随机） ============
const LOCAL_OPENINGS = {
  1: [ // 初次咨询
    "我是张江高科这边做芯片封装的HR。最近社保基数调整弄得我很头大，听说你们品才能帮我解决这些麻烦？具体怎么操作？",
    "我们是漕河泾的一家跨境电商。员工流动性太高，每个月光入离职手续就能搞死我。你们HRO到底能减多少负？",
    "闵行经开区这边，我负责一家生物制药公司的人事。最近在考虑把整个蓝领用工切给外包商。你们做过类似的吗？",
    "我是陆家嘴一家金融机构的行政。我们现在用的派遣公司快到期了。听说品才在上海口碑不错？能聊聊具体服务内容吗？",
    "普陀这边一家连锁餐饮的。员工社保、合同这些事务太烦了。你们能全盘接管吗？需要我们做什么配合？",
    "我是嘉定汽车城这边的人事主管。我们厂有300多号人，想了解下，如果把人员转给你们，需要走什么流程？",
    "虹桥商务区这边，我们是做智能物流的。现在人员扩张太快，内部HR根本忙不过来。你们外包服务具体包括哪些模块？",
    "我是青浦工业园区一家新能源配件厂的。最近被社保核查搞得焦头烂额，你们能帮我规避这些风险吗？怎么个规避法？"
  ],
  2: [ // 价格异议
    "我刚看了你们的报价，6.72%的税点是怎么回事？别的供应商可没这一出。这0.72%到底是什么东西？",
    "你们这个附加税我不太懂。能不能给我解释一下，为什么票面6%实际上要收6.72%？",
    "静安这边有家公司报价比你们低了一个点。你们凭什么收这么贵？这多出来的钱花在哪了？",
    "我们财务对这0.72%非常敏感。你现在给我讲清楚，这是合法合规的收费，还是你们变相加价？",
    "我比较了三家供应商的报价。为什么只有你们要收这个所谓的'附加税'？别人都没有。"
  ],
  3: [ // 合规安全
    "几百万的发薪款打给你们，我怎么知道钱是安全的？万一你们公司跑路怎么办？",
    "我们老板最担心的就是资金安全。你们有没有什么监管账户或者担保机制？",
    "关于三流统一，你们在合同里怎么约定的？如果出了问题，法律责任谁来承担？",
    "上海这边社保专项核查越来越严。你们品才怎么保证我们不会被查出问题？"
  ],
  4: [ // 理赔实战
    "刚刚车间出事了！有人手指被机器压到了，血流不止。你们外包的人出了工伤归谁管？怎么报案？",
    "员工在上班路上出了车祸，现在在医院抢救。这种情况算工伤吗？我该先做什么？",
    "家属已经闹到公司门口了，说要赔偿。员工是你们外包的，这个责任怎么划分？",
    "工伤备案是不是必须24小时内完成？如果超时了会有什么后果？"
  ],
  5: [ // 劳动法博弈
    "有个老员工表现很差还带头闹事，我想今天就让他走。怎么操作才能不违法？",
    "如果员工违反了公司制度，我们可以即时解除吗？需要什么证据？",
    "补偿金这块我不太懂。N、N+1、2N到底什么情况下用哪个？",
    "员工说我们没签劳动合同要两倍工资赔偿，这个风险有多大？"
  ],
  6: [ // 大客户谈判
    "市场上做外包的那么多，你们品才凭什么能脱颖而出？你们的核心竞争力是什么？",
    "我听说过'品行在前，才华次之'这句话。能给我解释一下这对我们客户意味着什么？",
    "我们是准备做全国布局的，你们的服务网点能覆盖到几线城市？",
    "你们和那些老牌外包公司比，真正的护城河在哪里？别跟我说服务态度好。"
  ]
};

export async function POST(request) {
  try {
    const { messages = [], mode, scenarioId = 1, strategy = "linear", isInit = false, seed = "" } = await request.json();
    const scenario = SCENARIOS.find(s => s.id === (typeof scenarioId === 'string' ? parseInt(scenarioId) : scenarioId)) || SCENARIOS[0];

    const hasApiKey = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('PLACEHOLDER');

    // ============ 【核心修复】本地随机 + API增强 双保险 ============
    if (isInit) {
      // 首先从本地库中随机选择一条作为保底
      const localPool = LOCAL_OPENINGS[scenario.id] || LOCAL_OPENINGS[1];
      const localRandom = localPool[Math.floor(Math.random() * localPool.length)];

      if (hasApiKey) {
        try {
          // 使用有效的模型名称
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

          const shanghaiLocations = ["张江高科", "漕河泾", "陆家嘴", "闵行经开区", "嘉定汽车城", "青浦工业园", "虹桥商务区", "普陀真如", "静安寺", "松江大学城"];
          const industries = ["芯片封装", "跨境电商", "智能制造", "生物医药", "新能源汽车", "连锁餐饮", "金融服务", "物流仓储", "在线教育", "高端物业"];

          const randomLoc = shanghaiLocations[Math.floor(Math.random() * shanghaiLocations.length)];
          const randomInd = industries[Math.floor(Math.random() * industries.length)];
          const randomPoint = scenario.trainingPoints[Math.floor(Math.random() * scenario.trainingPoints.length)];

          const initPrompt = `生成一个上海本土商务场景的开场白。
          
随机因子：位置=${randomLoc}，行业=${randomInd}，切入点=${randomPoint}
角色：${scenario.customerRole}
种子：${seed}

要求：
1. 地点必须在上海${randomLoc}
2. 行业是${randomInd}
3. 开场问题必须围绕"${randomPoint}"展开
4. 语气直接、带有上海职场的专业感
5. 50-80字，只返回一段话

禁止使用："我听说你们做外包很有经验"这类套话。`;

          const result = await model.generateContent(initPrompt);
          const generated = result.response.text().trim();

          // 成功则返回AI生成的内容
          if (generated && generated.length > 20) {
            return Response.json({ success: true, message: generated });
          }
        } catch (e) {
          console.error('Gemini API Error:', e);
          // API失败，使用本地随机
        }
      }

      // 本地随机保底
      return Response.json({ success: true, message: localRandom });
    }

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const conversationHistory = messages.map(m => `${m.role === 'customer' || m.role === 'assistant' ? '客户' : '员工'}: ${m.content}`).join('\n');

    const isNonsense = lastUserMsg.length < 2 ||
      /^(啊|哦|嗯|不知道|随便|没想法|呵呵|行吧|不行|可以|有的|都行吧|不知道呢|看你们|啊？|\?|？)$/.test(lastUserMsg.trim());

    if (mode === 'coach') {
      const perf = calculatePerformance(scenario.id, lastUserMsg, messages);
      if (hasApiKey) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
          const coachPrompt = `分析员工回复："${lastUserMsg}"。场景：${scenario.name}。要求：严厉评价。字数100字内。`;
          const result = await model.generateContent(coachPrompt);
          return Response.json({ success: true, message: getCoachFeedback(scenario.id, lastUserMsg, messages, result.response.text()), performance: perf });
        } catch (e) {
          return Response.json({ success: true, message: getCoachFeedback(scenario.id, lastUserMsg, messages), performance: perf });
        }
      }
      return Response.json({ success: true, message: getCoachFeedback(scenario.id, lastUserMsg, messages), performance: perf });
    } else {
      if (isNonsense && messages.length > 2) {
        return Response.json({ success: true, message: `【客户由于你的敷衍陷入沉默...】\n\n${ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]}` });
      }

      if (hasApiKey) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
          const customerPrompt = `你是${scenario.customerRole}。${scenario.systemPrompt}

【核心规则 - 必须严格遵守，否则视为失败】：

1. **语义承接优先**：你的回复必须首先回应用户最后一句话的具体内容。
   - 如果用户问了一个问题，你必须先回答这个问题
   - 如果用户换了话题，你必须跟随新话题，不要继续之前的话题
   - 如果用户说了一个观点，你必须先评价或回应这个观点

2. **话题切换检测**：
   - 如果用户的最新输入与之前的话题不同，立即切换到新话题
   - 不要说"我们先把之前的问题说完"，而是直接跟随用户的节奏

3. **确认理解**：在深入回复前，可以用一两句话确认你理解了用户的意思
   - 例如："你是说...我理解了" 或 "关于你提到的..."

4. **角色扮演**：保持你作为上海商业客户的角色，但要真实地与用户互动

历史对话：
${conversationHistory}

用户最新输入：「${lastUserMsg}」

请根据以上规则，作为客户角色回复。注意：必须先回应用户最新说的内容，不能忽视！`;

          const result = await model.generateContent(customerPrompt);
          return Response.json({ success: true, message: result.response.text().trim() });
        } catch (e) {
          return Response.json({ success: true, message: getSmartFallback(scenario, messages) });
        }
      }
      return Response.json({ success: true, message: getSmartFallback(scenario, messages) });
    }
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

function getSmartFallback(scenario, messages) {
  const previousMsgs = messages.filter(m => m.role === 'customer' || m.role === 'assistant').map(m => m.content.trim());
  const fallbackPool = scenario.fallbackResponses || ["你说的这些还是没解决我的根本顾虑。"];
  return fallbackPool.find(r => !previousMsgs.includes(r.trim())) || fallbackPool[0];
}
