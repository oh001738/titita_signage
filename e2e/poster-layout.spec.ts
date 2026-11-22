import { test, expect } from "@playwright/test";
import { defaultContent } from "../lib/defaults";
import { readFile } from "node:fs/promises";
test.use({ serviceWorkers: "block" });
for (const size of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
]) {
  test(`poster display preserves its area and does not cover image at ${size.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const content = defaultContent();
    content.awards = [];
    content.albums = [];
    const poster = {
      ...content.posters[0],
      title: "成果發表會",
      subtitle: "歡迎家長參加",
      startsAt: "",
      endsAt: "",
      fit: "contain" as const,
      showCaption: false,
    };
    content.posters = [poster];
    const now = new Date();
    const payload = {
      content,
      version: 1,
      serverTime: now.toISOString(),
      schedule: {
        date: "2026-11-22",
        fetchedAt: now.toISOString(),
        source: "mock",
        stale: false,
        lessons: [],
        error: null,
      },
    };
    await page.route("**/api/display", (route) =>
      route.fulfill({ json: { data: payload, error: null } }),
    );
    await page.goto("/display");
    await expect(page.locator(".poster-image")).toBeVisible();
    await expect(page.locator(".poster-title")).toHaveCount(0);
    expect(
      await page
        .locator(".poster-image")
        .evaluate((el) => getComputedStyle(el).objectFit),
    ).toBe("contain");
    const initial = (await page.locator(".poster-card").boundingBox())!;
    const line = (await page.locator(".line-card").boundingBox())!;
    payload.content.posters[0] = { ...poster, showCaption: true, fit: "cover" };
    await page.reload();
    await expect(page.locator(".poster-title h2")).toHaveText("成果發表會");
    expect(
      await page
        .locator(".poster-image")
        .evaluate((el) => getComputedStyle(el).objectFit),
    ).toBe("cover");
    const image = (await page.locator(".poster-artwork").boundingBox())!;
    const caption = (await page.locator(".poster-title").boundingBox())!;
    const after = (await page.locator(".poster-card").boundingBox())!;
    const lineAfter = (await page.locator(".line-card").boundingBox())!;
    expect(image.y + image.height).toBeLessThanOrEqual(caption.y + 1);
    expect(after.height).toBeCloseTo(initial.height, 0);
    expect(lineAfter.y).toBeCloseTo(line.y, 0);
    await page.screenshot({
      path: `test-results/poster-layout-${size.width}.png`,
    });
  });
}
test("admin keeps one preview entry and offers per-poster layout options", async ({
  page,
}) => {
  const env = await readFile(".env.local", "utf8");
  const password = env
    .match(
      /Initial login password; remove this comment after storing it securely: (.+)/,
    )?.[1]
    ?.trim();
  await page.goto("/login");
  await page.getByLabel("密碼", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "進入管理後台" }).click();
  await page.getByRole("button", { name: "活動相簿", exact: true }).click();
  await expect(page.getByText("預覽已儲存草稿", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /看板預覽/ })).toBeVisible();
  await page.getByRole("button", { name: "海報輪播", exact: true }).click();
  await expect(page.getByLabel("圖片顯示方式").first()).toHaveValue("contain");
  await expect(
    page.getByLabel("在圖片下方顯示標題與副標題").first(),
  ).not.toBeChecked();
});
