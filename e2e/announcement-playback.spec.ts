import { expect, test, type Page } from "@playwright/test";
import { defaultContent } from "../lib/defaults";
import type { Announcement, DisplayPayload } from "../types";

test.use({ serviceWorkers: "block" });
const start = new Date("2026-11-20T16:00:00+08:00");
function notice(
  id: string,
  body: string,
  options: Partial<Announcement> = {},
): Announcement {
  return {
    id,
    title: "教室公告",
    body,
    priority: "normal",
    startsAt: "",
    endsAt: "",
    ...options,
  };
}
async function openPlayer(
  page: Page,
  announcements: Announcement[],
  reduced = false,
) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const content = defaultContent();
  content.announcements = announcements;
  content.awards = [];
  content.albums = [];
  const payload: DisplayPayload = {
    content,
    version: 1,
    serverTime: start.toISOString(),
    schedule: {
      date: "2026-11-20",
      fetchedAt: start.toISOString(),
      source: "mock",
      stale: false,
      error: null,
      lessons: [],
    },
    weather: {
      township: "臺東市",
      status: "ready",
      temperature: 23,
      description: "晴",
      kind: "sun",
      validUntil: new Date(start.getTime() + 3600000).toISOString(),
    },
  };
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 100));
  await page.route("**/api/display", (route) =>
    route.fulfill({ json: { data: payload, error: null } }),
  );
  await page.route("**/api/sync-time", async (route) => {
    const now = await page.evaluate(() => Date.now());
    await route.fulfill({
      json: { data: { receivedAt: now, sentAt: now }, error: null },
    });
  });
  await page.goto("/display");
  await expect(page.locator(".announcement-text")).toBeVisible();
  return payload;
}
const text = (page: Page) => page.locator(".announcement-text");
async function advance(page: Page, ms: number) {
  await page.clock.runFor(ms);
}

test("short messages remain still for at least ten seconds and rotate in order", async ({
  page,
}) => {
  await openPlayer(page, [
    notice("a", "公告甲"),
    notice("b", "公告乙"),
    notice("c", "公告丙"),
  ]);
  await expect(text(page)).toContainText("公告甲");
  await expect(text(page).locator("span")).not.toHaveClass(
    /announcement-scroll/,
  );
  await advance(page, 9000);
  await expect(text(page)).toContainText("公告甲");
  await advance(page, 1500);
  await expect(text(page)).toContainText("公告乙");
  await advance(page, 10500);
  await expect(text(page)).toContainText("公告丙");
  await advance(page, 10500);
  await expect(text(page)).toContainText("公告甲");
});

test("long message receives a full measured scroll before the next notice", async ({
  page,
}) => {
  const long = "成果發表會開放報名，歡迎家長洽詢櫃台。".repeat(10);
  await openPlayer(page, [notice("long", long), notice("next", "下一則公告")]);
  const moving = text(page).locator(".announcement-scroll");
  await expect(moving).toBeVisible();
  const ms = await moving.evaluate(
    (node) =>
      parseFloat(getComputedStyle(node).getPropertyValue("--scroll-duration")) *
      1000,
  );
  expect(ms).toBeGreaterThan(10000);
  await advance(page, ms - 1000);
  await expect(text(page)).toContainText(long);
  await advance(page, 3500);
  await expect(text(page)).toContainText("下一則公告");
});

test("scheduled urgent notices interrupt, rotate, expire, then restart interrupted general notice", async ({
  page,
}) => {
  const iso = (sec: number) =>
    new Date(start.getTime() + sec * 1000).toISOString();
  await openPlayer(page, [
    notice("a", "一般公告甲"),
    notice("b", "一般公告乙"),
    notice("u1", "緊急公告一", {
      priority: "urgent",
      startsAt: iso(5),
      endsAt: iso(38),
    }),
    notice("u2", "緊急公告二", {
      priority: "urgent",
      startsAt: iso(5),
      endsAt: iso(38),
    }),
  ]);
  await expect(text(page)).toContainText("一般公告甲");
  await advance(page, 6000);
  await expect(text(page)).toContainText("緊急公告一");
  await advance(page, 10500);
  await expect(text(page)).toContainText("緊急公告二");
  await advance(page, 10500);
  await expect(text(page)).toContainText("緊急公告一");
  await advance(page, 12000);
  await expect(text(page)).toContainText("一般公告甲");
  await advance(page, 8000);
  await expect(text(page)).toContainText("一般公告甲");
  await advance(page, 2500);
  await expect(text(page)).toContainText("一般公告乙");
});

test("a single urgent announcement remains visible until its schedule expires", async ({
  page,
}) => {
  const expires = new Date(start.getTime() + 25000).toISOString();
  await openPlayer(page, [
    notice("a", "一般公告"),
    notice("urgent", "立即注意", { priority: "urgent", endsAt: expires }),
  ]);
  await expect(text(page)).toContainText("立即注意");
  await advance(page, 20000);
  await expect(text(page)).toContainText("立即注意");
  await advance(page, 6000);
  await expect(text(page)).toContainText("一般公告");
});

test("reduced motion displays every part of a long notice as readable still pages", async ({
  page,
}) => {
  const long = "成果發表會開放報名，請於十一月三十日前洽櫃台辦理。".repeat(8);
  await openPlayer(
    page,
    [notice("long", long), notice("next", "下一則")],
    true,
  );
  await expect(text(page)).toHaveAttribute("aria-label", long);
  await expect
    .poll(async () =>
      Number(await text(page).getAttribute("data-notice-pages")),
    )
    .toBeGreaterThan(1);
  const count = Number(await text(page).getAttribute("data-notice-pages"));
  let joined = "";
  for (let index = 1; index <= count; index++) {
    await expect(text(page)).toHaveAttribute("data-notice-page", String(index));
    const visible = text(page).locator(":scope > span");
    await expect(visible).toBeVisible();
    expect(
      await visible.evaluate(
        (node) => node.scrollWidth <= node.parentElement!.clientWidth + 1,
      ),
    ).toBe(true);
    const segment = (await visible.textContent()) ?? "";
    expect(segment.length).toBeGreaterThan(0);
    joined += segment;
    await advance(page, 9000);
    await expect(visible).toHaveText(segment);
    await advance(page, 1200);
  }
  expect(joined).toBe(long);
  await expect(text(page)).toHaveAttribute("aria-label", "下一則");
});
