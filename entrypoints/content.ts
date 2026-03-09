type AutomationMessage =
  | { type: 'START_BUSINESS_PAGE_AUTOMATION' }
  | { type: 'CLICK_SUBSCRIBE_COPY' };

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

    let running = false;

    chrome.runtime.onMessage.addListener(
      (message: AutomationMessage, _sender, sendResponse) => {
        if (message.type === 'CLICK_SUBSCRIBE_COPY') {
          const ok = clickCopyButtonOnSubscribePage();
          sendResponse({ ok });
          return;
        }

        if (message.type === 'START_BUSINESS_PAGE_AUTOMATION') {
          if (running) {
            console.log('[memo-extension] automation already running');
            sendResponse({ ok: false, reason: 'already_running' });
            return;
          }

          running = true;
          console.log('[memo-extension] start automation');

          runAutomation()
            .then(() => {
              console.log('[memo-extension] automation finished');
              sendResponse({ ok: true });
            })
            .catch((error) => {
              console.error('[memo-extension] automation error', error);
              sendResponse({ ok: false, error: String(error) });
            })
            .finally(() => {
              running = false;
            });

          // 异步 sendResponse 需要返回 true
          return true;
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

// =============== 以下是职位列表批量自动操作的通用逻辑（保留可继续用） ===============

async function runAutomation() {
  // ===== 1. 等待页面列表渲染完成（根据你的页面结构调整）=====
  // 例如：列表容器为 .job-list，单行项为 .job-card
  const listSelector = '.list-item'; // TODO: 替换为真实的列表项选择器（测试环境职位行）

  await waitForElement(listSelector, 10000);

  let items = getCurrentItems(listSelector);

  console.log(
    `[memo-extension] 初始列表项数量: ${items.length}（后续滚动时会动态更新）`,
  );

  const targetCount = 200; // 目标处理数量

  for (let index = 0; index < targetCount; index += 1) {
    // 如列表是懒加载/滚动加载，这里每次循环都重新获取一次
    items = getCurrentItems(listSelector);

    const item = items[index];

    if (!item) {
      console.log(
        `[memo-extension] 第 ${index + 1} 项不存在，可能已经没有更多数据，提前结束。`,
      );
      break;
    }

    console.log(`[memo-extension] 开始处理第 ${index + 1} 项`);

    // ===== 2. 将当前项滚动到可视区域 =====
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500); // 视具体页面性能可调节

    // ===== 3. 对当前项执行具体业务操作 =====
    await operateOnItem(item, index);

    console.log(`[memo-extension] 第 ${index + 1} 项处理完成`);

    // 可选：在每个项之间加一点间隔，避免接口过于频繁
    await sleep(200);
  }

  console.log('[memo-extension] 所有项目处理逻辑执行完成');
}

function getCurrentItems(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

async function operateOnItem(item: HTMLElement, index: number) {
  // TODO: 按业务需求实现对单个列表项的操作
  // 下面是一个示例：在每一项中点击一个“操作”按钮，然后点击弹出的确认按钮

  console.log(`[memo-extension] operate item index=${index}`);

  // 示例：找到行内的“操作”按钮
  const actionButton =
    item.querySelector<HTMLElement>('.action-button-selector'); // TODO: 替换为真实按钮选择器

  if (!actionButton) {
    console.warn(
      `[memo-extension] 第 ${index + 1} 项未找到操作按钮，跳过此项。`,
    );
    return;
  }

  actionButton.click();
  await sleep(300);

  // 示例：弹出层中的确认按钮
  const confirmButton = document.querySelector<HTMLElement>(
    '.confirm-button-selector', // TODO: 替换为真实确认按钮选择器
  );

  if (confirmButton) {
    confirmButton.click();
    await sleep(300);
  } else {
    console.warn(
      `[memo-extension] 第 ${index + 1} 项未找到确认按钮，可能无需确认。`,
    );
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForElement(
  selector: string,
  timeoutMs: number,
): Promise<HTMLElement> {
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) return existing;

  return new Promise<HTMLElement>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(
        new Error(
          `waitForElement timeout: selector "${selector}" not found within ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    // 若在超时时间内找到了元素，清理定时器
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      clearTimeout(timer);
      observer.disconnect();
      resolve(el);
    }
  });
}

