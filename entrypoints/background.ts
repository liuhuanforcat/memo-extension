const bg = (globalThis as Record<string, unknown>).chrome as typeof browser | undefined;

export default defineBackground(() => {
  console.log('Hello background!', { id: bg?.runtime?.id });

  (bg ?? browser).runtime.onMessage.addListener(
    (msg: { type: string }, _sender: unknown, sendResponse: (r: unknown) => void) => {
      if (msg.type !== 'EXECUTE_CLICK_COPY') return;
      (async () => {
        try {
          const api = bg ?? browser;
          const scripting = api?.scripting;
          if (!scripting?.executeScript) {
            sendResponse({ ok: false, error: 'scripting API 不可用，请确认 manifest 中有 "scripting" 权限并重新加载扩展' });
            return;
          }
          const [tab] = await api.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (!tab?.id) {
            sendResponse({ ok: false, error: 'no_tab' });
            return;
          }
          const results = await scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const candidates = Array.from(
                document.querySelectorAll(
                  'button, [role="button"], .btn, .button, span[class*="copy"], div[class*="copy"]',
                ),
              );
              const target = candidates.find(
                (el: Element) =>
                  typeof (el as HTMLElement).innerText === 'string' &&
                  (el as HTMLElement).innerText.trim().includes('复制'),
              );
              if (!target) return { ok: false, reason: 'not_found' };
              (target as HTMLElement).click();
              return { ok: true };
            },
          });
          const result = results?.[0]?.result;
          sendResponse(result ?? { ok: false, reason: 'no_result' });
        } catch (e) {
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })();
      return true; // 异步 sendResponse
    },
  );
});
