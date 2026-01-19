"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { SCENARIOS } from "./lib/scenarios";

// 简易 Markdown 渲染
function renderMarkdown(text) {
  if (!text) return "";

  return text
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/## (.*)/g, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/> "(.*?)"/g, '<blockquote>"$1"</blockquote>')
    .replace(/> (.*)/g, '<blockquote>$1</blockquote>')
    .replace(/^\d+\. (.*)/gm, '<li>$1</li>')
    .replace(/^- (.*)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export default function Home() {
  const [currentView, setCurrentView] = useState('select'); // 'select' | 'training'
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [performance, setPerformance] = useState(null); // { score, level, hitKeywords }
  const [strategy, setStrategy] = useState('linear'); // 'linear' | 'random'
  const [savedSession, setSavedSession] = useState(null); // 保存的会话信息
  const chatAreaRef = useRef(null);

  // 从 localStorage 检查是否有保存的对话记录
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem('ai-coach-session');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.messages && parsed.messages.length > 0) {
            const scenario = SCENARIOS.find(s => s.id === parsed.scenarioId);
            if (scenario) {
              setSavedSession({
                scenario,
                messages: parsed.messages,
                strategy: parsed.strategy || 'linear',
                timestamp: parsed.timestamp
              });
            }
          }
        } catch (e) {
          console.error('Failed to load saved session:', e);
        }
      }
    }
  }, []);

  // 保存对话到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedScenario && messages.length > 0) {
      const sessionData = {
        scenarioId: selectedScenario.id,
        messages: messages,
        strategy: strategy,
        timestamp: Date.now()
      };
      localStorage.setItem('ai-coach-session', JSON.stringify(sessionData));
    }
  }, [messages, selectedScenario, strategy]);

  // 自动滚动
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, loading, coachLoading]);

  // 选择关卡
  const handleSelectScenario = (scenario) => {
    setSelectedScenario(scenario);
    setMessages([]);
    setCurrentView('training');
    startScenario(scenario);
  };

  // 开始场景
  const startScenario = async (scenario) => {
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "customer",
          scenarioId: scenario.id,
          isInit: true,
          seed: Math.random().toString(36).substring(7) + Date.now()
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessages([{ role: "customer", content: data.message }]);
      } else {
        setMessages([{ role: "customer", content: scenario.openingMessage }]);
      }
    } catch (error) {
      setMessages([{ role: "customer", content: scenario.openingMessage }]);
    }
    setLoading(false);
  };

  // 返回选择页面
  const handleBack = () => {
    setCurrentView('select');
    setMessages([]);
    setSelectedScenario(null);
    setSavedSession(null);
    // 清除保存的会话
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai-coach-session');
    }
  };

  // 继续上次对话
  const handleResumeSavedSession = () => {
    if (savedSession) {
      setSelectedScenario(savedSession.scenario);
      setMessages(savedSession.messages);
      setStrategy(savedSession.strategy);
      setCurrentView('training');
    }
  };

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    const newMessages = [...messages, { role: "employee", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          mode: "customer",
          scenarioId: selectedScenario?.id || 2,
          strategy: strategy
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessages([...newMessages, { role: "customer", content: data.message }]);
      }
    } catch (error) {
      console.error("发送失败:", error);
    }

    setLoading(false);
  };

  // 请求教练反馈
  const handleCoachFeedback = async () => {
    if (coachLoading) return;

    const lastEmployeeMsg = [...messages].reverse().find(m => m.role === "employee");
    if (!lastEmployeeMsg) return;

    setCoachLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          mode: "coach",
          scenarioId: selectedScenario?.id || 2
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessages([...messages, { role: "coach", content: data.message }]);
        if (data.performance) {
          setPerformance(data.performance);
        }
      }
    } catch (error) {
      console.error("获取教练反馈失败:", error);
    }

    setCoachLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 关卡选择视图
  if (currentView === 'select') {
    return (
      <main className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>🎯 品才AI学习官</h1>
          <p className={styles.subtitle}>实战陪练 · 深度教练反馈</p>
          <p className={styles.subtitle} style={{ marginTop: '8px', opacity: 0.7 }}>
            选择关卡开始训练
          </p>
        </header>

        <div className={styles.scenarioGrid}>
          {SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              className={styles.scenarioCard}
              onClick={() => handleSelectScenario(scenario)}
            >
              <div className={styles.scenarioHeader}>
                <span className={styles.scenarioIcon}>{scenario.icon}</span>
                <div className={styles.scenarioMeta}>
                  <span className={styles.scenarioLevel}>第{scenario.id}关</span>
                  <div className={styles.difficultyStars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ opacity: i < scenario.difficulty ? 1 : 0.3 }}>★</span>
                    ))}
                  </div>
                </div>
              </div>
              <h3 className={styles.scenarioTitle}>{scenario.name}</h3>
              <p className={styles.scenarioSubtitle}>{scenario.subtitle}</p>
              <p className={styles.scenarioDesc}>{scenario.description}</p>
              <div className={styles.scenarioCustomer}>
                👤 {scenario.customerRole}
              </div>
              <div className={styles.scenarioTags}>
                {scenario.trainingPoints.slice(0, 2).map((point, i) => (
                  <span key={i} className={styles.tag}>{point}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 继续上次对话按钮 */}
        {savedSession && (
          <div className={styles.resumeSection}>
            <button 
              className={styles.resumeButton}
              onClick={handleResumeSavedSession}
            >
              📂 继续上次对话：第{savedSession.scenario.id}关 - {savedSession.scenario.name}
              <span className={styles.resumeMeta}>
                ({savedSession.messages.length}条消息)
              </span>
            </button>
          </div>
        )}
      </main>
    );
  }

  // 训练视图
  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={handleBack}>
          ← 返回选择
        </button>
        <h1 className={styles.title}>🎯 品才AI学习官</h1>
        <p className={styles.subtitle}>实战陪练 · 深度教练反馈</p>

        <div className={styles.scenarioInfo}>
          <span className={`${styles.badge} ${styles.active}`}>
            {selectedScenario?.icon} 第{selectedScenario?.id}关：{selectedScenario?.name}
          </span>
          <span className={styles.badge}>
            👤 {selectedScenario?.customerRole}
          </span>
          {performance && (
            <span className={`${styles.badge} ${styles.scoreBadge}`}>
              🏆 分数: {performance.score} | 等级: {performance.level}
            </span>
          )}
        </div>
      </header>

      <div className={styles.tip}>
        <p>💡 训练重点：{selectedScenario?.trainingPoints?.join(' · ')}</p>
        <div className={styles.strategySwitch}>
          <button
            className={`${styles.strategyBtn} ${strategy === 'linear' ? styles.active : ''}`}
            onClick={() => setStrategy('linear')}
          >
            📏 线性解决模式
          </button>
          <button
            className={`${styles.strategyBtn} ${strategy === 'random' ? styles.active : ''}`}
            onClick={() => setStrategy('random')}
          >
            🎲 随机了解模式
          </button>
        </div>
      </div>

      <div className={styles.chatArea} ref={chatAreaRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`${styles.message} ${styles[msg.role]}`}>
            {msg.role !== "employee" && (
              <div className={styles.avatar}>
                {msg.role === "customer" ? "👤" : "🎓"}
              </div>
            )}

            <div className={styles.bubble}>
              {msg.role === "coach" ? (
                <>
                  <div className={styles.coachLabel}>🎓 教练反馈</div>
                  <div
                    className={styles.coachContent}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </>
              ) : (
                msg.content
              )}
            </div>

            {msg.role === "employee" && (
              <div className={styles.avatar}>👩‍💼</div>
            )}
          </div>
        ))}

        {loading && (
          <div className={`${styles.message} ${styles.customer}`}>
            <div className={styles.avatar}>👤</div>
            <div className={styles.bubble}>
              <div className={styles.loading}>
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        {coachLoading && (
          <div className={`${styles.message} ${styles.coach}`}>
            <div className={styles.avatar}>🎓</div>
            <div className={styles.bubble}>
              <div className={styles.coachLabel}>🎓 教练正在分析...</div>
              <div className={styles.loading}>
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的回复..."
            disabled={loading || coachLoading}
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!input.trim() || loading || coachLoading}
          >
            发送 ➤
          </button>
          <button
            className={styles.coachButton}
            onClick={handleCoachFeedback}
            disabled={loading || coachLoading || !messages.some(m => m.role === "employee")}
          >
            🎓 请教练指导
          </button>
        </div>
      </div>
    </main>
  );
}
