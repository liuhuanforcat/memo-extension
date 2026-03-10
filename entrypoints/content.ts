export default defineContentScript({
  matches: ['http://101.126.129.76/*'],
  main() {
    // 防止重复注入（programmatic + manifest 同时生效时）
    if ((globalThis as any).__memoExtLoaded) return;
    (globalThis as any).__memoExtLoaded = true;

    let running = false;
    let shouldStop = false;
    let logs: string[] = [];
    let progress = { current: 0, total: 0, chatCount: 0 };

    browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === 'start' && !running) {
        runTest(msg.loopCount || 100);
        sendResponse({ ok: true });
      } else if (msg.action === 'stop') {
        shouldStop = true;
        sendResponse({ ok: true });
      } else if (msg.action === 'status') {
        sendResponse({ running, logs: logs.slice(-200), progress });
      } else {
        sendResponse({ ok: true });
      }
      return true;
    });

    function addLog(message: string) {
      const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      logs.push(`[${time}] ${message}`);
    }

    function delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isVisible(el: Element | null): boolean {
      if (!el) return false;
      const html = el as HTMLElement;
      if (html.offsetParent === null && getComputedStyle(html).position !== 'fixed')
        return false;
      const rect = html.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function queryByText(
      selector: string,
      text: string | RegExp,
    ): HTMLElement[] {
      return (Array.from(document.querySelectorAll(selector)) as HTMLElement[]).filter(
        (el) => {
          const content = el.textContent || '';
          return typeof text === 'string' ? content.includes(text) : text.test(content);
        },
      );
    }

    async function waitForText(
      selector: string,
      text: string | RegExp,
      timeout = 10_000,
    ): Promise<HTMLElement | null> {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const match = queryByText(selector, text).find((el) => isVisible(el));
        if (match) return match;
        await delay(200);
      }
      return null;
    }

    async function waitForHidden(el: HTMLElement, timeout = 10_000): Promise<boolean> {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (!isVisible(el)) return true;
        await delay(200);
      }
      return false;
    }

    async function runTest(loopCount: number) {
      running = true;
      shouldStop = false;
      logs = [];
      progress = { current: 0, total: loopCount, chatCount: 0 };

      browser.runtime.sendMessage({ type: 'test-state', running: true }).catch(() => {});
      addLog('正在查找企业列表...');

      await delay(1500);

      const companies = queryByText('strong', /示例企业/);
      const totalLoaded = companies.length;

      if (totalLoaded === 0) {
        addLog('❌ 未找到包含「示例企业」的列表项');
        addLog('请确认已登录并在正确的页面上');
        running = false;
        browser.runtime.sendMessage({ type: 'test-state', running: false }).catch(() => {});
        return;
      }

      addLog(`找到 ${totalLoaded} 家企业，开始循环 ${loopCount} 次`);

      for (let i = 0; i < loopCount; i++) {
        if (shouldStop) {
          addLog('⏹ 已手动停止');
          break;
        }

        progress.current = i + 1;
        const idx = i % totalLoaded;

        const freshCompanies = queryByText('strong', /示例企业/);
        if (freshCompanies.length === 0) {
          addLog('❌ 企业列表丢失，中止');
          break;
        }
        const companyItem = freshCompanies[idx % freshCompanies.length];
        const name = companyItem.textContent?.trim() || `企业#${idx}`;
        addLog(`[${i + 1}/${loopCount}] 点击: ${name}`);

        // 关闭残留弹窗
        const staleModal = document.querySelector('.ant-modal-root .ant-modal') as HTMLElement;
        if (staleModal && isVisible(staleModal)) {
          const closeBtn = queryByText('.ant-modal-root button', '留在本页')[0];
          if (closeBtn && isVisible(closeBtn)) {
            closeBtn.click();
            await waitForHidden(staleModal, 5000);
          }
        }

        companyItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        await delay(300);
        companyItem.click();

        // 等待「去沟通」按钮
        const goChat = await waitForText('button', '去沟通', 10_000);
        if (!goChat) {
          addLog('  ⚠ 未找到「去沟通」按钮，跳过');
          continue;
        }
        goChat.click();
        progress.chatCount++;

        // 等待「留在本页」按钮
        const stayBtn = await waitForText('.ant-modal-root button', '留在本页', 10_000);
        if (stayBtn) {
          stayBtn.click();
          const modal = document.querySelector('.ant-modal-root .ant-modal') as HTMLElement;
          if (modal) await waitForHidden(modal, 10_000);
        } else {
          addLog('  ⚠ 未找到「留在本页」按钮');
        }

        await delay(300);
      }

      addLog(`✅ 完成！共执行 ${progress.current} 轮，沟通 ${progress.chatCount} 次`);
      running = false;
      browser.runtime.sendMessage({ type: 'test-state', running: false }).catch(() => {});
    }
  },
});
