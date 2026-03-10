export default defineBackground(() => {
  let testRunning = false;

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'test-state') {
      testRunning = msg.running;
      sendResponse({ ok: true });
    } else if (msg.type === 'ensure-content-script') {
      injectContentScript(msg.tabId).then(
        () => sendResponse({ ok: true }),
        () => sendResponse({ ok: false }),
      );
      return true;
    }
    return true;
  });

  async function injectContentScript(tabId: number) {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
    } catch {
      // already injected or tab not accessible
    }
  }

  // 插件安装/更新时，向已打开的匹配页面注入 content script
  browser.runtime.onInstalled.addListener(async () => {
    const tabs = await browser.tabs.query({ url: 'http://101.126.129.76/*' });
    for (const tab of tabs) {
      if (tab.id) await injectContentScript(tab.id);
    }
  });

  // "去沟通"可能打开新标签页，测试期间自动关闭
  browser.tabs.onCreated.addListener(async (tab) => {
    if (testRunning && tab.id) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        await browser.tabs.remove(tab.id);
      } catch {
        /* tab may already be closed */
      }
    }
  });
});
