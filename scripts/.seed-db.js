const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const knowledgeData = [
    {
        category: 'faq',
        scenario: 'intro',
        question: '什么是人力资源外包服务？',
        answer: '将一家企业非核心岗位人员的劳动关系转移到第三方人力资源公司，以此降低用工成本，转移用工风险，让专业的人做专业的事，释放企业核心生产力。',
        keywords: ['外包', '定义', '价值']
    },
    {
        category: 'faq',
        scenario: 'price',
        question: '同行价格比我们低，怎么说服客户？',
        answer: '1. 解释市场恶意低价伴随风险；2. 强调品才是实战外包，承担了95%的风险；3. 强调服务附加值（人才招聘、法务咨询）；4. 强调合作的合规性（经得起法律税务审核）。',
        keywords: ['价格', '低价', '同行']
    },
    {
        category: 'faq',
        scenario: 'compliance',
        question: '客户对资金安全不放心，如何解决？',
        answer: '从六个维度：1. 公对公业务有迹可循；2. 现场实时发放工资；3. 分批次打款；4. 签署《资金安全承保协议》；5. 注册资金实缴保障。',
        keywords: ['资金', '安全', '打款']
    },
    {
        category: 'faq',
        scenario: 'accident',
        question: '认定为工伤的情形有哪些？',
        answer: '工作时间、工作场所内，因工作原因受伤；突发疾病48小时内抢救无效死亡；上下班途中机动车事故；因工外出受到伤害。',
        keywords: ['工伤', '认定', '范围']
    }
];

async function seed() {
    console.log('正在导入知识库数据...');
    const { data, error } = await supabase
        .from('knowledge_base')
        .insert(knowledgeData);

    if (error) {
        console.error('导入失败:', error);
    } else {
        console.log('✅ 导入成功！');
    }
}

seed();
