import './App.css';

type ExtensionAPI = {
  tabs: {
    query: (q: object) => Promise<{ id?: number }[]>;
    sendMessage: (tabId: number, msg: unknown) => Promise<unknown>;
  };
};
const api = ((globalThis as Record<string, unknown>).chrome ??
  (globalThis as Record<string, unknown>).browser) as ExtensionAPI | null;

function App() {
  const handleClickCopy = async () => {
    if (!api?.tabs) {
      alert('扩展 API 不可用，请重新加载扩展。');
      return;
    }

    try {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab || tab.id == null) {
        alert('未找到当前活动标签页');
        return;
      }

      const response = (await api.tabs.sendMessage(tab.id, {
        type: 'CLICK_SUBSCRIBE_COPY',
      })) as { ok?: boolean } | undefined;

      if (response?.ok) {
        alert('已点击复制按钮，请确认剪贴板是否已更新。');
      } else {
        alert('未找到“复制”按钮，请确认当前页面是否有复制功能，且已在目标页面。');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      alert('发送消息到当前页面失败，请确认已在目标页面并已注入 content script。');
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
