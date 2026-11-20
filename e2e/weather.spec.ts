import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { defaultContent } from "../lib/defaults";
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
test("animated forecast fits the footer and expires safely", async ({
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
  await page.waitForURL("**/admin");
  await page.clock.install();
  let kind = "sun";
  const validUntil = new Date(Date.now() + 300000).toISOString();
  await page.route("**/api/admin/preview?*", async (route) =>
    route.fulfill({
      json: {
        error: null,
        data: {
          content: { ...defaultContent(), awards: [], albums: [] },
          version: 1,
          schedule: {
            date: "2026-11-20",
            fetchedAt: null,
            source: "mock",
            stale: false,
            lessons: [],
            error: null,
          },
          serverTime: new Date().toISOString(),
          weather: {
            township: "臺東市",
            status: "ready",
            kind,
            description: "多雲短暫雨",
            temperature: 23,
            rainProbability: 30,
            validUntil,
          },
        },
      },
    }),
  );
  for (kind of [
    "sun",
    "partly",
    "cloud",
    "rain",
    "thunder",
    "wind",
    "fog",
    "snow",
  ]) {
    await page.goto("/admin/preview?player=1");
    const widget = page.locator(`[data-weather="${kind}"]`);
    await expect(widget).toBeVisible();
    await expect(widget).toContainText("23°");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "test-results/weather-display.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator("[data-weather] svg")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.clock.fastForward(6 * 60000);
  await expect(page.locator('[data-weather="loading"]')).toContainText(
    "天氣更新中",
  );
});
