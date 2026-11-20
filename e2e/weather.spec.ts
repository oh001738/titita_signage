import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { defaultContent } from "../lib/defaults";
import type { DisplayPayload, WeatherKind } from "../types";

test.use({ serviceWorkers: "block" });
test("weather settings load locations, test without saving, and retain edits across navigation", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/admin/weather")).status()).toBe(401);
  const env = await readFile(".env.local", "utf8");
  const password = env
    .match(
      /Initial login password; remove this comment after storing it securely: (.+)/,
    )?.[1]
    ?.trim();
  expect(password).toBeTruthy();
  let settings = {
    revision: 0,
    county: "臺東縣",
    township: "臺東市",
    hasApiKey: false,
  };
  let saves = 0;
  await page.route("**/api/admin/weather", async (route) => {
    const req = route.request();
    const input = req.method() === "GET" ? null : req.postDataJSON();
    let data: unknown = settings;
    if (req.method() === "PUT") {
      saves++;
      settings = {
        revision: saves,
        county: input.county,
        township: input.township,
        hasApiKey: true,
      };
      data = settings;
    } else if (req.method() === "POST") {
      data = {
        townships: ["花蓮市", "吉安鄉"],
        message:
          input.action === "test"
            ? "連線成功：花蓮縣吉安鄉，已取得鄉鎮天氣預報。"
            : undefined,
      };
    }
    await route.fulfill({ json: { data, error: null } });
  });
  await page.goto("/login");
  await page.getByLabel("密碼", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "進入管理後台" }).click();
  await page.waitForURL("**/admin");
  await page.getByRole("button", { name: "天氣設定", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "縣市", exact: true }),
  ).toHaveValue("臺東縣");
  await expect(page.getByRole("button", { name: /儲存草稿/ })).toBeHidden();
  await page.getByLabel("API 授權碼", { exact: true }).fill("CWA-browser-test");
  await page
    .getByRole("combobox", { name: "縣市", exact: true })
    .selectOption("花蓮縣");
  await expect(page.getByRole("button", { name: "測試連線" })).toBeDisabled();
  await page.getByRole("button", { name: "載入鄉鎮地點" }).click();
  await page
    .getByRole("combobox", { name: "鄉鎮市區", exact: true })
    .selectOption("吉安鄉");
  await page.getByRole("button", { name: "測試連線" }).click();
  await expect(page.getByRole("status")).toContainText("連線成功");
  expect(saves).toBe(0);
  await page.getByRole("button", { name: "總覽", exact: true }).click();
  await page.getByRole("button", { name: "天氣設定", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "鄉鎮市區", exact: true }),
  ).toHaveValue("吉安鄉");
  await page.getByRole("button", { name: /儲存天氣設定/ }).click();
  await expect(page.getByRole("status")).toContainText("天氣設定已儲存");
  await expect(page.getByLabel("API 授權碼", { exact: true })).toHaveValue("");
  await page.screenshot({
    path: "test-results/weather-settings.png",
    fullPage: true,
  });
});
function weatherPayload(time: Date): DisplayPayload {
  const content = defaultContent();
  content.awards = [];
  content.albums = [];
  content.announcements[0].body =
    "週六成果發表會開放報名，歡迎洽詢櫃台。".repeat(6);
  return {
    content,
    version: 1,
    serverTime: time.toISOString(),
    schedule: {
      date: "2026-11-20",
      fetchedAt: time.toISOString(),
      source: "mock",
      stale: false,
      error: null,
      lessons: Array.from({ length: 8 }, (_, i) => ({
        id: `weather-lesson-${i}`,
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
        room_name: ["1F-大團體教室", "1琴房", "4琴房", "1F-小團體教室"][i % 4],
        status: "scheduled",
      })),
    },
    weather: {
      township: "臺東市",
      status: "ready",
      kind: "partly",
      description: "晴時多雲",
      temperature: 23,
      rainProbability: 30,
      validUntil: new Date(time.getTime() + 5 * 60000).toISOString(),
    },
  };
}

async function mockDisplay(page: Page, payload: DisplayPayload) {
  await page.route("**/api/display", (route) =>
    route.fulfill({ json: { data: payload, error: null } }),
  );
  await page.route("**/api/sync-time", (route) =>
    route.fulfill({
      json: {
        data: {
          receivedAt: Date.parse(payload.serverTime),
          sentAt: Date.parse(payload.serverTime),
        },
        error: null,
      },
    }),
  );
}

async function expectCenteredTemperature(widget: Locator) {
  const card = (await widget.boundingBox())!;
  const temperature = (await widget
    .locator("[data-weather-temperature]")
    .boundingBox())!;
  expect(
    Math.abs(
      temperature.y + temperature.height / 2 - (card.y + card.height / 2),
    ),
  ).toBeLessThanOrEqual(3);
  const location = (await widget
    .locator("[data-weather-location]")
    .boundingBox())!;
  const precipitation = (await widget
    .locator("[data-weather-precip]")
    .boundingBox())!;
  expect(precipitation.y).toBeGreaterThanOrEqual(
    location.y + location.height - 1,
  );
  for (const box of [location, precipitation]) {
    expect(box.x + box.width).toBeLessThanOrEqual(temperature.x);
  }
}

test("soft weather artwork changes by forecast and night, honors reduced motion, and expires safely", async ({
  page,
}) => {
  const now = new Date("2026-11-20T16:30:00+08:00");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 100));
  const payload = weatherPayload(now);
  await mockDisplay(page, payload);
  const kinds: WeatherKind[] = [
    "sun",
    "partly",
    "cloud",
    "rain",
    "thunder",
    "wind",
    "fog",
    "snow",
  ];
  for (const kind of kinds) {
    payload.weather!.kind = kind;
    await page.goto("/display");
    const widget = page.locator(`[data-weather="${kind}"]`);
    await expect(widget).toBeVisible();
    await expect(widget.locator("[data-weather-scene]")).toBeVisible();
    await expect(widget.locator("[data-weather-temperature]")).toContainText(
      "23",
    );
    await expect(widget).toHaveAttribute("data-weather-night", "false");
  }
  const night = new Date("2026-11-20T20:30:00+08:00");
  await page.clock.setSystemTime(night);
  payload.serverTime = night.toISOString();
  payload.weather!.validUntil = new Date(
    night.getTime() + 5 * 60000,
  ).toISOString();
  for (const kind of ["sun", "partly"] as const) {
    payload.weather!.kind = kind;
    await page.goto("/display");
    const widget = page.locator(`[data-weather="${kind}"]`);
    await expect(widget).toHaveAttribute("data-weather-night", "true");
    await expect(widget).toHaveAttribute(
      "data-icon",
      kind === "sun" ? "night" : "night-cloud",
    );
  }
  const widget = page.locator("[data-weather]");
  const motions = widget.locator("[data-weather-motion]");
  expect(await motions.count()).toBeGreaterThan(0);
  expect(
    await motions.evaluateAll((nodes) =>
      nodes.some((node) => getComputedStyle(node).animationName !== "none"),
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await motions.evaluateAll((nodes) =>
      nodes.every((node) =>
        [node, ...node.querySelectorAll("*")].every(
          (element) => getComputedStyle(element).animationName === "none",
        ),
      ),
    ),
  ).toBe(true);
  await page.clock.fastForward(6 * 60000);
  await expect(page.locator('[data-weather="loading"]')).toContainText(
    "天氣更新中",
  );
  await expect(page.locator("[data-weather-temperature]")).not.toContainText(
    "23",
  );
});

for (const viewport of [
  { width: 1920, height: 1080, motion: "no-preference" },
  { width: 1920, height: 1080, motion: "reduce" },
  { width: 1280, height: 720, motion: "no-preference" },
  { width: 1280, height: 720, motion: "reduce" },
  { width: 390, height: 844, motion: "reduce" },
] as const) {
  test(`compact weather footer and four lessons fit at ${viewport.width}x${viewport.height} with ${viewport.motion}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: viewport.motion });
    const now = new Date("2026-11-20T16:30:00+08:00");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 100));
    const payload = weatherPayload(now);
    await mockDisplay(page, payload);
    await page.goto("/display");
    const widget = page.locator('[data-weather="partly"]');
    await expect(widget).toBeVisible();
    await expectCenteredTemperature(widget);
    await expect(widget.locator("[data-weather-location]")).toHaveText(
      "臺東市",
    );
    await expect(widget.locator("[data-weather-description]")).toHaveCount(0);
    await expect(widget).toHaveAttribute("aria-label", /晴時多雲/);
    await expect(widget.locator("[data-weather-precip]")).toHaveText(
      "3小時降雨 30%",
    );
    const rows = page.locator(".lesson-row");
    await expect(rows).toHaveCount(4);
    for (const row of await rows.all()) {
      const bounds = (await row.boundingBox())!;
      const teacher = (await row
        .locator(".lesson-course > span")
        .boundingBox())!;
      const room = (await row.locator(".lesson-room").boundingBox())!;
      const status = (await row.locator(".lesson-status").boundingBox())!;
      expect(teacher.y).toBeGreaterThanOrEqual(bounds.y);
      expect(teacher.y + teacher.height).toBeLessThanOrEqual(
        bounds.y + bounds.height + 1,
      );
      expect(room.x + room.width).toBeLessThan(status.x);
    }
    const cardBox = (await widget.boundingBox())!;
    if (viewport.width >= 1900) expect(cardBox.width).toBeLessThanOrEqual(405);
    for (const hook of ["location", "temperature", "precip"]) {
      const text = widget.locator(`[data-weather-${hook}]`);
      const box = (await text.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(box.x + box.width).toBeLessThanOrEqual(
        cardBox.x + cardBox.width + 1,
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        cardBox.y + cardBox.height + 1,
      );
    }
    const notice = page.locator(".announcement-bar");
    const marquee = page.locator(".announcement-text");
    await expect(marquee.locator("span")).toHaveText(
      payload.content.announcements[0].body,
    );
    if (viewport.width > 800) {
      const tableBox = (await page.locator(".schedule-table").boundingBox())!;
      const noticeBox = (await notice.boundingBox())!;
      const marqueeBox = (await marquee.boundingBox())!;
      expect(tableBox.y + tableBox.height).toBeLessThan(noticeBox.y);
      expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(
        viewport.height + 1,
      );
      expect(noticeBox.height).toBeLessThanOrEqual(
        viewport.width >= 1900 ? 110 : 86,
      );
      expect(marqueeBox.x + marqueeBox.width).toBeLessThan(cardBox.x);
      expect(marqueeBox.width).toBeGreaterThan(viewport.width * 0.28);
      const minSizes =
        viewport.width >= 1900
          ? { location: 28, temperature: 46, precip: 22 }
          : { location: 20, temperature: 34, precip: 16 };
      for (const [hook, min] of Object.entries(minSizes)) {
        const size = await widget
          .locator(`[data-weather-${hook}]`)
          .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
        expect(size).toBeGreaterThanOrEqual(min);
        expect(
          await widget
            .locator(`[data-weather-${hook}]`)
            .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
        ).toBe(true);
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/compact-weather-${viewport.width}-${viewport.motion}.png`,
      animations: "disabled",
      fullPage: viewport.width < 800,
    });
  });
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
]) {
  test(`long weather forecast and 100 percent rain fit the compact footer at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const now = new Date("2026-11-20T16:30:00+08:00");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 100));
    const payload = weatherPayload(now);
    payload.weather = {
      ...payload.weather!,
      township: "太麻里鄉",
      kind: "thunder",
      description: "多雲午後短暫雷陣雨",
      rainProbability: 100,
    };
    await mockDisplay(page, payload);
    await page.goto("/display");
    const widget = page.locator('[data-weather="thunder"]');
    await expect(widget).toBeVisible();
    await expect(widget).toHaveAttribute("aria-label", /多雲午後短暫雷陣雨/);
    await expect(widget.locator("[data-weather-location]")).toHaveText(
      "太麻里鄉",
    );
    await expect(widget.locator("[data-weather-precip]")).toContainText("100%");
    await expectCenteredTemperature(widget);
    for (const hook of ["location", "temperature", "precip"]) {
      expect(
        await widget
          .locator(`[data-weather-${hook}]`)
          .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
      ).toBe(true);
    }
    const footer = (await page.locator(".announcement-bar").boundingBox())!;
    expect(footer.height).toBeLessThanOrEqual(
      viewport.width >= 1900 ? 110 : 86,
    );
  });
}

for (const interlude of ["award", "album"] as const) {
  test(`compact weather footer does not cover the ${interlude} interlude`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const now = new Date("2026-11-20T16:30:00+08:00");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 100));
    const payload = weatherPayload(now);
    if (interlude === "award") {
      payload.content.awards = [
        {
          id: "weather-award",
          layout: "competition",
          competition: "兒童音樂比賽",
          sharedPrize: "",
          image: "",
          enabled: true,
          duration: 10,
          effect: "reveal",
          playbackMode: "continuous",
          startsAt: "",
          endsAt: "",
          recipients: ["林小樂", "陳小安", "王小美"].map((name, index) => ({
            id: `weather-award-student-${index}`,
            name,
            category: "鋼琴",
            prize: "優等獎",
          })),
        },
      ];
    } else {
      payload.content.albums = [
        {
          id: "weather-album",
          title: "音樂成果發表會",
          date: "2026-11-20",
          description: "",
          enabled: true,
          startsAt: "",
          endsAt: "",
          duration: 20,
          batchSize: 1,
          fit: "contain",
          photos: [
            {
              id: "weather-album-photo",
              image: "/concert-art.png",
              caption: "一起演奏的美好時刻",
              selected: true,
            },
          ],
        },
      ];
    }
    await mockDisplay(page, payload);
    await page.goto("/display");
    await expect(page.locator('[data-weather="partly"]')).toBeVisible();
    await page.clock.runFor(40_000);
    const screen = page.getByLabel(
      interlude === "award" ? "榮耀時刻" : "活動相簿",
      { exact: true },
    );
    await expect(screen).toBeVisible();
    const footer = (await page.locator(".announcement-bar").boundingBox())!;
    const importantContent = screen.locator(
      interlude === "award"
        ? "[data-recipient-id]"
        : ".activity-image-frame, .activity-caption",
    );
    expect(await importantContent.count()).toBeGreaterThan(0);
    for (const element of await importantContent.all()) {
      const box = (await element.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(footer.y + 1);
    }
    await expect(page.locator('[data-weather="partly"]')).toBeVisible();
    await page.screenshot({
      path: `test-results/soft-weather-${interlude}.png`,
      animations: "disabled",
    });
  });
}
