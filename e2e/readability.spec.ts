import { test, expect } from "@playwright/test";
import { defaultContent } from "../lib/defaults";
import type { DisplayPayload } from "../types";

test.use({ serviceWorkers: "block" });
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`larger schedule text fits four rows at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const time = new Date("2026-11-20T16:30:00+08:00");
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 100));
    const payload: DisplayPayload = {
      content: defaultContent(),
      version: 1,
      serverTime: time.toISOString(),
      schedule: {
        date: "2026-11-20",
        fetchedAt: time.toISOString(),
        source: "mock",
        stale: false,
        error: null,
        lessons: Array.from({ length: 8 }, (_, i) => ({
          id: `lesson-${i}`,
          date: "2026-11-20",
          start_time: "16:20",
          end_time: "17:20",
          course_name: [
            "林小樂（小提琴個別課）",
            "陳小安（鋼琴）",
            "王小美（大提琴個別課）",
            "黃小明（長笛）",
          ][i % 4],
          teacher_name: "王老師",
          room_id: "room",
          room_name: ["1F-大團體教室", "1琴房", "4琴房", "1F-小團體教室"][
            i % 4
          ],
          status: "scheduled",
        })),
      },
    };
    await page.route("**/api/display", (route) =>
      route.fulfill({ json: { data: payload, error: null } }),
    );
    await page.route("**/api/sync-time", (route) =>
      route.fulfill({
        json: {
          data: { receivedAt: time.getTime(), sentAt: time.getTime() },
          error: null,
        },
      }),
    );
    await page.goto("/display");
    const rows = page.locator(".lesson-row");
    await expect(rows).toHaveCount(4);
    for (const row of await rows.all()) {
      const bounds = await row.boundingBox();
      const teacher = await row.locator(".lesson-course > span").boundingBox();
      const room = await row.locator(".lesson-room").boundingBox();
      const status = await row.locator(".lesson-status").boundingBox();
      expect(teacher!.y).toBeGreaterThanOrEqual(bounds!.y);
      expect(teacher!.y + teacher!.height).toBeLessThanOrEqual(
        bounds!.y + bounds!.height,
      );
      expect(room!.x + room!.width).toBeLessThan(status!.x);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (viewport.width > 800) {
      const table = await page.locator(".schedule-table").boundingBox();
      const notice = await page.locator(".announcement-bar").boundingBox();
      expect(table!.y + table!.height).toBeLessThan(notice!.y);
    }
    await page.screenshot({
      path: `test-results/larger-text-${viewport.width}.png`,
      animations: "disabled",
    });
  });

  test(`larger announcement label and marquee fit at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const now = new Date("2026-11-20T16:30:00+08:00");
    const content = defaultContent();
    content.announcements[0].body =
      "週六成果發表會開放報名，歡迎洽詢櫃台。".repeat(8);
    const payload: DisplayPayload = {
      content,
      version: 1,
      serverTime: now.toISOString(),
      schedule: {
        date: "2026-11-20",
        fetchedAt: now.toISOString(),
        source: "mock",
        stale: false,
        error: null,
        lessons: [],
      },
    };
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 100));
    await page.route("**/api/display", (route) =>
      route.fulfill({ json: { data: payload, error: null } }),
    );
    await page.route("**/api/sync-time", (route) =>
      route.fulfill({
        json: {
          data: { receivedAt: now.getTime(), sentAt: now.getTime() },
          error: null,
        },
      }),
    );
    await page.goto("/display");
    const label = page.locator(".announcement-label");
    const text = page.locator(".announcement-text");
    await expect(label).toHaveText("教室公告");
    await expect(text.locator("span")).toHaveClass("announcement-scroll");
    expect(
      await label.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    const labelSize = await label.evaluate((node) =>
      parseFloat(getComputedStyle(node).fontSize),
    );
    const bodySize = await text.evaluate((node) =>
      parseFloat(getComputedStyle(node).fontSize),
    );
    expect(labelSize).toBeGreaterThanOrEqual(
      viewport.width >= 1900 ? 30 : viewport.width >= 1200 ? 20 : 16,
    );
    expect(bodySize).toBeGreaterThanOrEqual(
      viewport.width >= 1900 ? 34 : viewport.width >= 1200 ? 23 : 16,
    );
    const bar = await page.locator(".announcement-bar").boundingBox();
    const textBox = await text.boundingBox();
    expect(textBox!.y).toBeGreaterThanOrEqual(bar!.y);
    expect(textBox!.y + textBox!.height).toBeLessThanOrEqual(
      bar!.y + bar!.height,
    );
    if (viewport.width > 800)
      expect(bar!.y + bar!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
