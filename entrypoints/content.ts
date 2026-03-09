export default defineContentScript({
  // TODO: 根据你的实际测试环境域名/路径进行调整
  // 示例：测试环境职位列表页 / 订阅页
  matches: [
    '*://www.v2ny.de/*', // 奈云 dashboard 等页面
    '*://v2ny.de/*',
    '*://naiun.adfgawidhioawjd.site/*',
  ],
  main() {
    console.log('[memo-extension] content script loaded');

    chrome.runtime.onMessage.addListener(
      (message: { type: 'CLICK_SUBSCRIBE_COPY' }, _sender, sendResponse) => {
        if (message.type === 'CLICK_SUBSCRIBE_COPY') {
          const ok = clickCopyButtonOnSubscribePage();
          sendResponse({ ok });
          return;
        }
        return undefined;
      },
    );
  },
});

/** 针对订阅页面：自动查找并点击“复制”按钮 */
function clickCopyButtonOnSubscribePage(): boolean {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, [role="button"], .btn, .button',
    ),
  );

  const target = candidates.find(
    (el) =>
      typeof el.innerText === 'string' && el.innerText.trim().includes('复制'),
  );

  if (!target) {
    console.warn('[memo-extension] 未找到包含“复制”文案的按钮');
    return false;
  }

  target.click();
  console.log('[memo-extension] 已点击订阅页复制按钮:', target);
  return true;
}
