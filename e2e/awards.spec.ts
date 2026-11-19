import { test, expect, type Page } from "@playwright/test";
import { defaultContent } from "../lib/defaults";
import type { ActivityAlbum, Award, Content, DisplayPayload } from "../types";

// These tests exercise the player using published API fixtures. They do not
// authenticate, pair a device, or change the CMS database or uploaded media.
test.use({ serviceWorkers: "block" });

const initialTime = new Date("2026-11-19T16:20:00+08:00");

function award(count: number, overrides: Partial<Award> = {}): Award {
  return {
    id: "award-playback",
    layout: "competition",
    competition: "榮耀播放測試音樂比賽",
    sharedPrize: "",
    image: "",
    enabled: true,
    duration: 5,
    effect: "reveal",
    playbackMode: "segmented",
    segmentDuration: 15,
    startsAt: "",
    endsAt: "",
    recipients: Array.from({ length: count }, (_, i) => ({
      id: `student-${i + 1}`,
      name: `得獎同學${i + 1}`,
      category: "鋼琴・國小中年級組",
      prize: "優等獎",
    })),
    ...overrides,
  };
}

async function openPlayer(
  page: Page,
  records: Award | Award[],
  content: Partial<Content> = {},
) {
  const payload: DisplayPayload = {
    content: {
      ...defaultContent(),
      awards: Array.isArray(records) ? records : [records],
      ...content,
      announcements: [
        {
          id: "award-test-notice",
          title: "教室公告",
          body: "得獎畫面播放期間公告持續可見",
          priority: "normal",
          startsAt: "",
          endsAt: "",
        },
      ],
    },
    version: 1,
    serverTime: initialTime.toISOString(),
    schedule: {
      date: "2026-11-19",
      fetchedAt: initialTime.toISOString(),
      source: "mock",
      stale: false,
      lessons: [],
      error: null,
    },
  };
  const fixture = { payload, requests: 0 };
  await page.clock.install({ time: initialTime });
  await page.clock.pauseAt(new Date(initialTime.getTime() + 100));
  await page.route("**/api/display", async (route) => {
    fixture.requests++;
    await route.fulfill({ json: { data: fixture.payload, error: null } });
  });
  await page.route("**/api/sync-time", async (route) => {
    const time = await page.evaluate(() => Date.now());
    await route.fulfill({
      json: { data: { receivedAt: time, sentAt: time }, error: null },
    });
  });
  await page.goto("/display");
  await expect(page.getByRole("heading", { name: "今日課程" })).toBeVisible();
  return fixture;
}

const awardScreen = (page: Page) =>
  page.getByLabel("榮耀時刻", { exact: true });

test("award surface stays opaque during transitions and a single remaining student is centered", async ({
  page,
}) => {
  await openPlayer(page, award(1), { logo: "/school-logo-trial.png" });
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
  const screen = awardScreen(page);
  expect(await screen.evaluate((node) => getComputedStyle(node).opacity)).toBe(
    "1",
  );
  expect(
    await screen.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe("rgb(250, 247, 239)");
  // Measure the settled layout, independent of the card's 3D entry transform.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const card = await screen.locator("[data-recipient-id]").boundingBox();
  expect(Math.abs(card!.x + card!.width / 2 - 800)).toBeLessThan(2);
  const logo = screen.getByRole("img", { name: "TITITA 音樂教室" });
  expect(
    await logo.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({
    path: "test-results/awards-cream-single-student.png",
    animations: "disabled",
  });
  await page.clock.runFor(5_000);
  await expect(screen).toHaveAttribute("data-exiting", "true");
  expect(await screen.evaluate((node) => getComputedStyle(node).opacity)).toBe(
    "1",
  );
});

async function expectStudents(page: Page, expected: number[]) {
  await expect(awardScreen(page)).toBeVisible();
  await expect
    .poll(() =>
      awardScreen(page)
        .locator("[data-recipient-id]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-recipient-id")),
        ),
    )
    .toEqual(expected.map((index) => `student-${index}`));
}

async function finishAwardRun(page: Page, remainingMs = 5_000) {
  await page.clock.runFor(remainingMs);
  // React commits the end-of-page state before its effect schedules this fade.
  // Advance it separately so the clock cannot skip over an uncommitted effect.
  await expect(awardScreen(page)).toHaveClass(/award-display-exit/);
  await page.clock.runFor(500);
  await expect(awardScreen(page)).toHaveCount(0);
}

test("segmented reveal resumes the next students after the schedule without replaying early pages", async ({
  page,
}) => {
  const fixture = await openPlayer(page, award(12));
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "管理後台" })).toHaveCount(0);

  // A pointer left on a poster must not pause an unattended screen.
  await page.locator(".poster-card").hover();
  await page.clock.runFor(40_000);
  await expectStudents(page, [1, 2, 3]);
  await expect(awardScreen(page)).toHaveAttribute("data-effect", "reveal");
  await expect.poll(() => fixture.requests).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("得獎畫面播放期間公告持續可見")).toBeVisible();
  await page.clock.runFor(5_000);
  await expectStudents(page, [4, 5, 6]);
  await page.clock.runFor(5_000);
  await expectStudents(page, [7, 8, 9]);
  await page.clock.runFor(1_500);
  await page.screenshot({
    path: "test-results/awards-reveal-desktop.png",
    animations: "disabled",
  });
  await finishAwardRun(page, 3_500);

  await page.clock.runFor(40_000);
  await expectStudents(page, [10, 11, 12]);
  await finishAwardRun(page);
  await page.clock.runFor(40_000);
  await expectStudents(page, [1, 2, 3]);
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("continuous spotlight shows every student before returning to the schedule", async ({
  page,
}) => {
  await openPlayer(
    page,
    award(6, { effect: "spotlight", playbackMode: "continuous" }),
  );
  await page.clock.runFor(40_000);
  await expect(awardScreen(page)).toHaveAttribute("data-effect", "spotlight");
  for (let student = 1; student <= 6; student++) {
    await expectStudents(page, [student]);
    if (student < 6) await page.clock.runFor(5_000);
  }
  await finishAwardRun(page);
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
});

test("reduced motion keeps automatic playback and the mobile screen has no playback controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlayer(page, award(6));
  await page.clock.runFor(40_000);
  await expectStudents(page, [1, 2, 3]);
  await expect(page.getByRole("button")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.clock.runFor(1_500);
  await page.screenshot({
    path: "test-results/awards-reveal-mobile.png",
    animations: "disabled",
  });
  await page.clock.runFor(3_500);
  await expectStudents(page, [4, 5, 6]);
});

test("spotlight fits long student names and prizes without losing the announcement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const record = award(1, { effect: "spotlight" });
  record.recipients[0] = {
    id: "student-1",
    name: "這是一位需要完整顯示姓名的得獎學生",
    category: "鋼琴・國小中年級組與指定曲目公開演奏組",
    prize: "全國音樂大賽優等暨最佳舞台表現與音樂詮釋特別獎",
  };
  await openPlayer(page, record);
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
  await expect(
    awardScreen(page).getByText(record.recipients[0].name, { exact: true }),
  ).toBeVisible();
  await expect(
    awardScreen(page).getByText(record.recipients[0].prize, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("得獎畫面播放期間公告持續可見")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.clock.runFor(1_500);
  await page.screenshot({
    path: "test-results/awards-spotlight-long-text.png",
    animations: "disabled",
  });
});

test("an award expires while it is playing rather than waiting for its long page duration", async ({
  page,
}) => {
  await openPlayer(
    page,
    award(6, {
      effect: "spotlight",
      duration: 60,
      playbackMode: "continuous",
      endsAt: new Date(initialTime.getTime() + 50_000).toISOString(),
    }),
  );
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
  await page.clock.runFor(11_000);
  await expect(awardScreen(page)).toHaveCount(0);
});

test("an updated award with the same ID is used when its waiting period finishes", async ({
  page,
}) => {
  const fixture = await openPlayer(page, award(3));
  const updated = fixture.payload.content.awards![0];
  updated.recipients[0].name = "發布後更新的學生姓名";
  updated.recipients[0].prize = "發布後更新的特優獎";
  fixture.payload.version++;
  const refreshed = page.waitForResponse("**/api/display");
  await page.clock.runFor(30_000);
  await refreshed;
  await expect.poll(() => fixture.requests).toBeGreaterThanOrEqual(2);
  await page.clock.runFor(10_000);
  await expectStudents(page, [1, 2, 3]);
  await expect(
    awardScreen(page).getByText("發布後更新的學生姓名", { exact: true }),
  ).toBeVisible();
  await expect(
    awardScreen(page).getByText("發布後更新的特優獎", { exact: true }),
  ).toBeVisible();
});

test("an earlier award expiring does not switch away from the album that is playing", async ({
  page,
}) => {
  const album = (id: string, title: string): ActivityAlbum => ({
    id,
    title,
    date: "",
    description: "",
    enabled: true,
    startsAt: "",
    endsAt: "",
    duration: 20,
    batchSize: 2,
    fit: "contain",
    photos: [1, 2].map((index) => ({
      id: `${id}-photo-${index}`,
      image: "/concert-art.png",
      caption: `${title}照片${index}`,
      selected: true,
    })),
  });
  await openPlayer(
    page,
    award(1, {
      endsAt: new Date(initialTime.getTime() + 95_000).toISOString(),
    }),
    {
      albums: [
        album("album-a", "第一本活動相簿"),
        album("album-b", "第二本活動相簿"),
      ],
    },
  );
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
  await finishAwardRun(page);
  await page.clock.runFor(40_000);
  const albumScreen = page.getByLabel("活動相簿", { exact: true });
  await expect(
    albumScreen.getByRole("heading", { name: "第一本活動相簿" }),
  ).toBeVisible();
  await expect(albumScreen.getByText(/第一本活動相簿照片1/)).toBeVisible();

  // The earlier award expires at 95s, shrinking the interlude list while album A
  // is still on its first photo. A numeric cursor alone would now select B.
  await page.clock.runFor(11_000);
  await expect(
    albumScreen.getByRole("heading", { name: "第一本活動相簿" }),
  ).toBeVisible();
  await expect(
    albumScreen.getByRole("heading", { name: "第二本活動相簿" }),
  ).toHaveCount(0);
  await page.clock.runFor(9_000);
  await expect(albumScreen.getByText(/第一本活動相簿照片2/)).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(albumScreen).toHaveClass(/activity-display-exit/);
  await page.clock.runFor(500);
  await expect(albumScreen).toHaveCount(0);
  await page.clock.runFor(40_000);
  await expect(
    albumScreen.getByRole("heading", { name: "第二本活動相簿" }),
  ).toBeVisible();
});

test("a publication that disables the current award removes it on the next content refresh", async ({
  page,
}) => {
  const fixture = await openPlayer(
    page,
    award(6, { effect: "spotlight", duration: 60, playbackMode: "continuous" }),
  );
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
  fixture.payload.content.awards![0].enabled = false;
  fixture.payload.version++;
  await page.clock.runFor(21_000);
  await expect.poll(() => fixture.requests).toBeGreaterThanOrEqual(3);
  await expect(awardScreen(page)).toHaveCount(0);
});

test("720p reveal keeps maximum-length records and a photo above the announcement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const record = award(3, {
    image: "/concert-art.png",
    competition: "音樂大賽".repeat(20),
  });
  record.recipients = record.recipients.map((person) => ({
    ...person,
    name: "同".repeat(30),
    category: "組".repeat(50),
    prize: "獎".repeat(80),
  }));
  await openPlayer(page, record);
  await page.clock.runFor(40_000);
  await expectStudents(page, [1, 2, 3]);
  const notice = await page.locator(".announcement-bar").boundingBox();
  expect(notice).not.toBeNull();
  for (const card of await awardScreen(page)
    .locator("[data-recipient-id]")
    .all()) {
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(notice!.y - 8);
  }
  await page.screenshot({
    path: "test-results/awards-reveal-720p-long-text.png",
    animations: "disabled",
  });
});

test("a changed publication interrupts a long run and the next run uses its new students", async ({
  page,
}) => {
  const fixture = await openPlayer(
    page,
    award(6, { effect: "spotlight", duration: 60, playbackMode: "continuous" }),
  );
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
  fixture.payload.content.awards![0].recipients[0].name = "更新後的得獎同學";
  fixture.payload.version++;
  await page.clock.runFor(21_000);
  await expect(awardScreen(page)).toHaveCount(0);
  await page.clock.runFor(40_000);
  await expectStudents(page, [1]);
  await expect(
    awardScreen(page).getByRole("heading", {
      name: "更新後的得獎同學",
      exact: true,
    }),
  ).toBeVisible();
});
