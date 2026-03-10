import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';

type Status = 'idle' | 'running' | 'stopped' | 'error' | 'done';

interface Progress {
  current: number;
  total: number;
  chatCount: number;
}

const TARGET_URL = 'https://www.zhipin.com/web/geek/job-recommend';

const STATUS_MAP: Record<Status, { label: string; color: string }> = {
  idle: { label: '待命中', color: '#888' },
  running: { label: '运行中', color: '#52c41a' },
  stopped: { label: '已停止', color: '#faad14' },
  error: { label: '异常', color: '#ff4d4f' },
  done: { label: '已完成', color: '#1890ff' },
};

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(msg: Record<string, unknown>) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('no-tab');
  return browser.tabs.sendMessage(tab.id, msg);
}

function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, chatCount: 0 });
  const [loopCount, setLoopCount] = useState(100);
  const [tabUrl, setTabUrl] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const isOnTarget = tabUrl.includes('zhipin.com');

  const scrollToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const tab = await getActiveTab();
        setTabUrl(tab?.url || '');

        const res = await sendToTab({ action: 'status' });
        if (res?.running != null) {
          setLogs(res.logs || []);
          setProgress(res.progress || { current: 0, total: 0, chatCount: 0 });

          if (res.running && status !== 'running') {
            setStatus('running');
          } else if (!res.running && status === 'running') {
            setStatus('done');
          }
        }
      } catch {
        // content script 未注入，只更新 tab url 不做其他处理
      }
    };

    poll();
    const timer = setInterval(poll, 800);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(scrollToBottom, [logs, scrollToBottom]);

  const handleOpenTarget = async () => {
    const tab = await getActiveTab();
    if (tab?.id) {
      await browser.tabs.update(tab.id, { url: TARGET_URL });
    } else {
      await browser.tabs.create({ url: TARGET_URL });
    }
    setTabUrl(TARGET_URL);
    setLogs([]);
    setStatus('idle');
  };

  const ensureContentScript = async (tabId: number) => {
    await browser.runtime.sendMessage({ type: 'ensure-content-script', tabId });
    await new Promise((r) => setTimeout(r, 500));
  };

  const handleStart = async () => {
    setStatus('idle');
    setLogs(['正在注入脚本...']);
    setProgress({ current: 0, total: loopCount, chatCount: 0 });

    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus('error');
      setLogs(['❌ 未找到活动标签页']);
      return;
    }

    // 先确保 content script 已注入
    await ensureContentScript(tab.id);

    try {
      const res = await browser.tabs.sendMessage(tab.id, { action: 'start', loopCount });
      if (res?.ok) {
        setStatus('running');
        setLogs([]);
      }
    } catch {
      setStatus('error');
      setLogs([
        '❌ 无法连接到页面脚本',
        '',
        '可能的原因：',
        '1. 当前不在 Boss直聘页面',
        '2. 请点击下方「打开目标页面」后重试',
      ]);
    }
  };

  const handleStop = async () => {
    try {
      await sendToTab({ action: 'stop' });
      setStatus('stopped');
    } catch {
      setStatus('error');
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const si = STATUS_MAP[status];

  return (
    <div className="app">
      <header className="header">
        <h1>Boss直聘助手</h1>
        <p className="subtitle">自动打招呼 · 批量沟通</p>
      </header>

      {!isOnTarget && status !== 'running' && (
        <div className="notice">
          <div>当前不在目标页面</div>
          <button className="btn btn-nav" onClick={handleOpenTarget}>
            打开目标页面
          </button>
        </div>
      )}

      <div className="config-row">
        <label htmlFor="loop-count">循环次数</label>
        <input
          id="loop-count"
          type="number"
          min={1}
          max={9999}
          value={loopCount}
          disabled={status === 'running'}
          onChange={(e) => setLoopCount(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>

      <div className="actions">
        <button
          className="btn btn-start"
          disabled={status === 'running'}
          onClick={handleStart}
        >
          ▶ 开始测试
        </button>
        <button
          className="btn btn-stop"
          disabled={status !== 'running'}
          onClick={handleStop}
        >
          ⏹ 结束测试
        </button>
      </div>

      <div className="status-bar">
        <span className="dot" style={{ background: si.color }} />
        <span className="status-label">{si.label}</span>
        {status === 'running' && (
          <span className="status-detail">
            {progress.current}/{progress.total} · 沟通 {progress.chatCount} 次
          </span>
        )}
        {(status === 'done' || status === 'stopped') && progress.current > 0 && (
          <span className="status-detail">
            共 {progress.current} 轮 · 沟通 {progress.chatCount} 次
          </span>
        )}
      </div>

      {progress.total > 0 && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
          <span className="progress-text">{pct}%</span>
        </div>
      )}

      <div className="log-area">
        {logs.length === 0 ? (
          <div className="log-empty">暂无日志</div>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={`log-line${line.startsWith('❌') ? ' log-error' : ''}`}>
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default App;
