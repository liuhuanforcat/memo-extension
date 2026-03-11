export default defineContentScript({
  matches: ['https://www.zhipin.com/*'],
  main() {
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

    function randomDelay(min: number, max: number): Promise<void> {
      return delay(min + Math.floor(Math.random() * (max - min)));
    }

    function isVisible(el: Element | null): boolean {
      if (!el) return false;
      const html = el as HTMLElement;
      if (html.offsetParent === null && getComputedStyle(html).position !== 'fixed')
        return false;
      const rect = html.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function queryByText(selector: string, text: string | RegExp): HTMLElement[] {
      return (Array.from(document.querySelectorAll(selector)) as HTMLElement[]).filter(
        (el) => {
          const content = el.textContent || '';
          return typeof text === 'string' ? content.includes(text) : text.test(content);
        },
      );
    }

    function queryVisible(selector: string): HTMLElement[] {
      return (Array.from(document.querySelectorAll(selector)) as HTMLElement[]).filter(
        (el) => isVisible(el),
      );
    }

    async function waitForSelector(
      selector: string,
      timeout = 10_000,
    ): Promise<HTMLElement | null> {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector) as HTMLElement;
        if (el && isVisible(el)) return el;
        await delay(200);
      }
      return null;
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

    function getJobCards(): HTMLElement[] {
      const selectors = [
        '.job-card-wrapper',
        '.job-card-body',
        '.job-card-box',
        '[class*="job-card"]',
        '.search-job-result li',
        '.rec-job-list li',
      ];
      for (const sel of selectors) {
        const cards = queryVisible(sel);
        if (cards.length > 0) return cards;
      }
      return [];
    }

    function getJobInfo(card: HTMLElement): { name: string; company: string } {
      const nameSelectors = ['.job-name', '.job-title', '[class*="job-name"]'];
      const companySelectors = ['.company-name', '.info-company', '[class*="company-name"]'];

      let name = '未知职位';
      let company = '未知公司';

      for (const sel of nameSelectors) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { name = el.textContent.trim(); break; }
      }
      for (const sel of companySelectors) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { company = el.textContent.trim(); break; }
      }

      return { name, company };
    }

    function getScrollableParent(el: HTMLElement): HTMLElement {
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const { overflowY } = getComputedStyle(parent);
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          parent.scrollHeight > parent.clientHeight
        ) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return document.documentElement;
    }

    function scrollInContainer(card: HTMLElement) {
      const container = getScrollableParent(card);
      if (container === document.documentElement) {
        scrollInContainer(card);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offsetTop = cardRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({
        top: offsetTop - container.clientHeight / 2 + cardRect.height / 2,
        behavior: 'smooth',
      });
    }

    function findChatButton(): HTMLElement | null {
      const candidates = queryByText('a, button', /立即沟通/);
      return candidates.find((el) => isVisible(el)) || null;
    }

    function findAlreadyChatted(): boolean {
      const tags = queryByText('a, button, span', /继续沟通/);
      return tags.some((el) => isVisible(el));
    }

    function checkLimitDialog(): boolean {
      const dialogs = queryVisible('.dialog-container, .dialog-wrap, [class*="dialog"], [class*="toast"], [class*="modal"]');
      for (const d of dialogs) {
        const text = d.textContent || '';
        if (/上限|限制|次数已[用满]|沟通数/.test(text)) return true;
      }
      return false;
    }

    function closeDialog() {
      const closeBtns = queryVisible(
        '.dialog-container .close, [class*="dialog"] .close, [class*="dialog"] [class*="close"], [class*="modal"] .close',
      );
      if (closeBtns.length > 0) {
        closeBtns[0].click();
        return;
      }
      const okBtns = queryByText('.dialog-container button, [class*="dialog"] button, [class*="modal"] button', /知道了|确定|关闭/);
      if (okBtns.length > 0) okBtns[0].click();
    }

    async function runTest(loopCount: number) {
      running = true;
      shouldStop = false;
      logs = [];
      progress = { current: 0, total: loopCount, chatCount: 0 };

      browser.runtime.sendMessage({ type: 'test-state', running: true }).catch(() => {});
      addLog('正在查找职位列表...');

      await delay(1500);

      let jobCards = getJobCards();

      if (jobCards.length === 0) {
        addLog('❌ 未找到职位卡片');
        addLog('请确认已登录，并在职位推荐/搜索页面上');
        running = false;
        browser.runtime.sendMessage({ type: 'test-state', running: false }).catch(() => {});
        return;
      }

      addLog(`找到 ${jobCards.length} 个职位，开始循环 ${loopCount} 次`);

      for (let i = 0; i < loopCount; i++) {
        if (shouldStop) {
          addLog('⏹ 已手动停止');
          break;
        }

        progress.current = i + 1;

        // 每轮重新获取卡片列表（页面可能动态更新）
        jobCards = getJobCards();
        if (jobCards.length === 0) {
          addLog('❌ 职位列表丢失，中止');
          break;
        }

        const idx = i % jobCards.length;
        const card = jobCards[idx];
        const { name, company } = getJobInfo(card);
        addLog(`[${i + 1}/${loopCount}] ${company} - ${name}`);

        // 滚动到卡片并点击
        scrollInContainer(card);
        await delay(300);
        card.click();
        await randomDelay(500, 1000);

        // 检查是否已沟通过
        if (findAlreadyChatted()) {
          addLog('  ⊘ 已沟通过，跳过');
          await randomDelay(300, 600);
          continue;
        }

        // 查找「立即沟通」按钮
        let chatBtn = findChatButton();
        if (!chatBtn) {
          // 可能需要等一下详情面板加载
          chatBtn = await waitForText('a, button', /立即沟通/, 5_000);
        }

        if (chatBtn) {
          chatBtn.click();
          progress.chatCount++;
          addLog(`  ✓ 已沟通 (${progress.chatCount})`);
          await randomDelay(800, 1500);
        } else {
          addLog('  ⚠ 未找到「立即沟通」按钮，跳过');
          await randomDelay(300, 600);
          continue;
        }

        // 检查是否弹出每日上限提示
        await delay(500);
        if (checkLimitDialog()) {
          addLog('⚠ 达到每日沟通上限，提前结束');
          closeDialog();
          break;
        }

        // 关闭可能出现的弹窗
        closeDialog();

        await randomDelay(800, 2000);
      }

      addLog(`✅ 完成！共执行 ${progress.current} 轮，成功沟通 ${progress.chatCount} 个职位`);
      running = false;
      browser.runtime.sendMessage({ type: 'test-state', running: false }).catch(() => {});
    }
  },
});
