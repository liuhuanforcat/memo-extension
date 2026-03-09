export default defineContentScript({
  // 在所有页面注入，具体行为由内部逻辑决定
  matches: ['*://*/*'],
  main() {
    console.log('[memo-extension] content script loaded');

    chrome.runtime.onMessage.addListener(
      (
        message: { type: 'CLICK_SUBSCRIBE_COPY' | 'SCROLL_TO_BOTTOM' },
        _sender,
        sendResponse,
      ) => {
        if (message.type === 'CLICK_SUBSCRIBE_COPY') {
          const ok = clickCopyButtonOnSubscribePage();
          sendResponse({ ok });
          return;
        }

        if (message.type === 'SCROLL_TO_BOTTOM') {
          console.log('[memo-extension] receive SCROLL_TO_BOTTOM');
          scrollToBottom()
            .then(() => sendResponse({ ok: true }))
            .catch((error) => {
              console.error('[memo-extension] scrollToBottom error', error);
              sendResponse({ ok: false, error: String(error) });
            });

          return true; // 异步 sendResponse
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

async function scrollToBottom(step = 400, delay = 100): Promise<void> {
  return new Promise<void>((resolve) => {
    function tick() {
      const docEl = document.documentElement;
      const body = document.body;
      const scrollTop = window.scrollY || docEl.scrollTop || body.scrollTop || 0;
      const scrollHeight =
        docEl.scrollHeight || body.scrollHeight || window.innerHeight;
      const clientHeight = window.innerHeight || docEl.clientHeight;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 5;

      if (atBottom) {
        // 给一个明显的结束信号，方便确认扩展生效
        console.log('[memo-extension] 已滚动到页面底部');
        try {
          alert('已尝试滚动到页面底部');
        } catch {
          // 某些环境可能禁止 alert，忽略即可
        }
        resolve();
        return;
      }

      window.scrollBy(0, step);
      setTimeout(tick, delay);
    }

    tick();
  });
}
