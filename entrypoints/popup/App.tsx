import './App.css';

type ExtensionAPI = {
  runtime: { sendMessage: (msg: unknown, cb?: (r: unknown) => void) => void };
};
const api = ((globalThis as Record<string, unknown>).chrome ?? (globalThis as Record<string, unknown>).browser) as ExtensionAPI | null;

function App() {
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
