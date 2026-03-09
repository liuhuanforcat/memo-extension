import './App.css';

type ExtensionAPI = {
  tabs: { query: (q: object) => Promise<{ id?: number }[]>; sendMessage: (tabId: number, msg: unknown) => Promise<unknown> };
  runtime: { sendMessage: (msg: unknown, cb?: (r: unknown) => void) => void };
};
const api = ((globalThis as Record<string, unknown>).chrome ?? (globalThis as Record<string, unknown>).browser) as ExtensionAPI | null;

function App() {
  const sendMessageToActiveTab = (message: unknown) => {
    if (!api) return;
    api.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs: any) => {
        const tab = tabs[0];

        if (!tab || tab.id == null) {
          alert('未找到当前活动标签页');
          return;
        }

        return api.tabs.sendMessage(tab.id, message);
      })
      .then((response: any) => {
        if (response !== undefined) {
          console.log('content script 响应:', response);
        }
      })
      .catch((error: any) => {
        console.error('发送消息失败:', error);
        alert('发送消息到当前页面失败，请确认已在目标页面并已注入 content script。');
      });
  };

  const handleStartAutomation = () => {
    sendMessageToActiveTab({ type: 'START_BUSINESS_PAGE_AUTOMATION' });
    alert('已向当前页面发送“列表自动操作”指令，请切到业务页查看执行情况。');
  };

  const handleClickCopy = async () => {
    try {
      if (!api?.runtime?.sendMessage) {
        alert('扩展 API 不可用，请重新加载扩展。');
        return;
      }
      const result = await new Promise<{ ok?: boolean; error?: string; reason?: string }>((resolve) => {
        api.runtime.sendMessage({ type: 'EXECUTE_CLICK_COPY' }, (r: unknown) => {
          resolve((r as { ok?: boolean; error?: string; reason?: string }) ?? {});
        });
      });
      if (result?.ok) {
        alert('已点击复制按钮，请确认剪贴板是否已更新。');
      } else if (result?.error) {
        alert('执行失败：' + result.error + '\n\n请确认：1) 已打开目标页面；2) 在 chrome://extensions 中点击扩展的「重新加载」；3) 若提示新权限，请同意。');
      } else {
        alert('未找到“复制”按钮，请确认当前页面是否有复制功能。');
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err ?? '未知错误');
      alert('执行失败：' + msg + '\n\n请确认：1) 已打开目标页面；2) 在 chrome://extensions 中点击扩展的「重新加载」；3) 若提示新权限，请同意。');
    }
  };

  return (
    <div style={{ padding: 12, minWidth: 260 }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>测试助手</h2>
      <div
        style={{
          border: '1px solid #eee',
          borderRadius: 6,
          padding: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>业务页面批量操作</div>
        <p style={{ fontSize: 12, marginTop: 0, marginBottom: 8 }}>
          打开测试环境的职位列表页后点击此按钮，将从上到下依次滚动并对每一项执行预设操作。
        </p>
        <button
          style={{
            width: '100%',
            padding: '6px 10px',
            cursor: 'pointer',
          }}
          onClick={handleStartAutomation}
        >
          开始列表自动操作
        </button>
      </div>

      <div
        style={{
          border: '1px solid #eee',
          borderRadius: 6,
          padding: 10,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>订阅页复制按钮</div>
        <p style={{ fontSize: 12, marginTop: 0, marginBottom: 8 }}>
          打开你发的那个订阅链接页面（带复制按钮的），在该标签页激活时点击此按钮，会自动帮你点“复制”。
        </p>
        <button
          style={{
            width: '100%',
            padding: '6px 10px',
            cursor: 'pointer',
          }}
          onClick={handleClickCopy}
        >
          点击订阅页复制按钮
        </button>
      </div>
    </div>
  );
}

export default App;
