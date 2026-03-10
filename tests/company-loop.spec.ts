import { test, expect } from "@playwright/test";

const LOOP_COUNT = 100;

test("循环点击企业 → 去沟通 → 留在本页 ×100", async ({ page, context }) => {
  // 自动关闭「去沟通」可能打开的新标签页
  context.on("page", async (newPage) => {
    console.log("  ↳ 检测到新标签页，关闭:", newPage.url());
    await newPage.close();
  });

  await page.goto("/company-master-detail");
  await page.waitForLoadState("networkidle");

  // 登录（前置步骤）
  const loginBtn = page.getByText("登 录");
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.locator("input").first().fill("admin");
    await page.locator('input[type="password"]').fill("123456");
    await loginBtn.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.goto("/company-master-detail");
    await page.waitForLoadState("networkidle");
  }

  // 等待企业列表渲染
  const companyNames = page.locator("strong").filter({ hasText: /示例企业/ });
  await companyNames.first().waitFor({ state: "visible", timeout: 15_000 });
  const totalLoaded = await companyNames.count();
  console.log(`已加载 ${totalLoaded} 家企业，开始循环 ${LOOP_COUNT} 次`);
  expect(totalLoaded).toBeGreaterThan(0);

  for (let i = 0; i < LOOP_COUNT; i++) {
    const idx = i % totalLoaded;
    const companyItem = companyNames.nth(idx);
    const name = await companyItem.textContent();
    console.log(`[${i + 1}/${LOOP_COUNT}] 点击: ${name}`);

    // 确保没有残留弹窗遮挡
    const modal = page.locator(".ant-modal-root .ant-modal");
    if (await modal.isVisible({ timeout: 300 }).catch(() => false)) {
      const closeBtn = page.locator(".ant-modal-root button").filter({ hasText: "留在本页" });
      if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await closeBtn.click();
        await modal.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
      }
    }

    await companyItem.scrollIntoViewIfNeeded();
    await companyItem.click();

    const goChat = page.locator("button").filter({ hasText: "去沟通" });
    await goChat.waitFor({ state: "visible", timeout: 10_000 });
    await goChat.click();

    const stayBtn = page.locator(".ant-modal-root button").filter({ hasText: "留在本页" });
    await stayBtn.waitFor({ state: "visible", timeout: 10_000 });
    await stayBtn.click();

    await modal.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  console.log(`✅ 全部 ${LOOP_COUNT} 轮操作完成`);
});
