import { test, expect } from "@playwright/test";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
const origin = "http://127.0.0.1:3002";
let originalState: string | null = null;
test.beforeEach(async () => {
  const env = await readFile(".env.local", "utf8");
  if (!env.includes("CMS_STORAGE=file") || !env.includes("MOCK_MODE=true"))
    throw new Error("E2E requires local file storage and mock mode");
  try {
    originalState = await readFile("data/cms.json", "utf8");
  } catch {
    originalState = null;
  }
});
test.afterEach(async () => {
  if (originalState !== null) await writeFile("data/cms.json", originalState);
  else await unlink("data/cms.json").catch(() => undefined);
});
test("independent CMS: login, draft, publication, pairing, revocation, responsive display", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  expect((await request.get("/api/admin/content")).status()).toBe(401);
  expect((await request.get("/api/display")).status()).toBe(401);
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "今日課程" })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/lobby-desktop.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/lobby-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const env = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  const password = env
    .match(
      /Initial login password; remove this comment after storing it securely: (.+)/,
    )?.[1]
    ?.trim();
  expect(password).toBeTruthy();
  await page.goto("/login");
  await page.getByLabel("密碼", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "進入管理後台" }).click();
  await expect(
    page.getByRole("heading", { name: "今天，也讓美好被看見。" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/admin-overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "公告管理", exact: true }).click();
  await page
    .getByRole("textbox", { name: "公告內容", exact: true })
    .fill("E2E 公告：歡迎每一個家庭。");
  await page.getByRole("button", { name: /儲存草稿/ }).click();
  await expect(page.getByRole("status")).toHaveText("草稿已儲存");
  let data = (await (await page.request.get("/api/admin/content")).json()).data;
  expect(data.draft.announcements[0].body).toContain("E2E");
  const badOrigin = await page.request.put("/api/admin/content", {
    headers: { Origin: "https://evil.example" },
    data: { revision: data.revision, content: data.draft },
  });
  expect(badOrigin.status()).toBe(403);
  const conflict = await page.request.put("/api/admin/content", {
    headers: { Origin: origin },
    data: { revision: -0 + 999999, content: data.draft },
  });
  expect(conflict.status()).toBe(409);
  await page.getByRole("button", { name: "發布到螢幕", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已發布");
  data = (await (await page.request.get("/api/admin/content")).json()).data;
  const firstVersion = data.published.version;
  const pairResponse = await page.request.post("/api/admin/screens", {
    headers: { Origin: origin },
    data: { name: "E2E 大廳" },
  });
  expect(pairResponse.status()).toBe(201);
  const { code } = (await pairResponse.json()).data;
  const device = await browser.newContext();
  const screen = await device.newPage();
  await screen.goto(origin + "/display");
  await screen.getByLabel("六位數配對碼").fill(code);
  await screen.getByRole("button", { name: "配對這台螢幕" }).click();
  await expect(screen.getByText("E2E 公告：歡迎每一個家庭。")).toBeVisible();
  const reuse = await device.request.post(origin + "/api/pair", {
    headers: { Origin: origin },
    data: { code },
  });
  expect(reuse.status()).toBe(403);
  const payload = (
    await (await device.request.get(origin + "/api/display")).json()
  ).data;
  expect(payload.version).toBe(firstVersion);
  expect(JSON.stringify(payload)).not.toContain("tokenHash");
  // Device heartbeats must not invalidate an editor's draft revision.
  data = (await (await page.request.get("/api/admin/content")).json()).data;
  const saveAfterHeartbeat = await page.request.put("/api/admin/content", {
    headers: { Origin: origin },
    data: {
      revision: data.revision,
      content: { ...data.draft, footer: "測試結束後還原" },
    },
  });
  expect(saveAfterHeartbeat.status()).toBe(200);
  const revision = (await saveAfterHeartbeat.json()).data.revision;
  expect(
    (
      await page.request.post("/api/admin/publish", {
        headers: { Origin: origin },
        data: { action: "publish", revision },
      })
    ).ok(),
  ).toBe(true);
  const newest = (await (await page.request.get("/api/admin/content")).json())
    .data;
  expect(
    (
      await page.request.post("/api/admin/publish", {
        headers: { Origin: origin },
        data: { action: "rollback", revision: newest.revision },
      })
    ).ok(),
  ).toBe(true);
  // A paired production screen must survive an offline reload without caching admin/API responses.
  await screen.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(async () =>
      screen.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await screen.reload();
  await expect(screen.getByRole("heading", { name: "今日課程" })).toBeVisible();
  await device.setOffline(true);
  await screen.reload();
  await expect(screen.getByRole("heading", { name: "今日課程" })).toBeVisible();
  await screen.screenshot({
    path: "docs/screenshots/lobby-offline.png",
    fullPage: true,
  });
  await device.setOffline(false);
  const list = (await (await page.request.get("/api/admin/screens")).json())
    .data;
  const target = list.findLast((s: { name: string }) => s.name === "E2E 大廳");
  expect(target).toBeTruthy();
  expect(
    (
      await page.request.patch("/api/admin/screens", {
        headers: { Origin: origin },
        data: { id: target.id, enabled: false },
      })
    ).ok(),
  ).toBe(true);
  expect((await device.request.get(origin + "/api/display")).status()).toBe(
    403,
  );
  const upload = await page.request.post("/api/admin/upload", {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: "bad.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      },
    },
  });
  expect(upload.status()).toBe(400);
  const image = await readFile("public/concert-art.png");
  const validUpload = await page.request.post("/api/admin/upload", {
    headers: { Origin: origin },
    multipart: {
      file: { name: "concert.png", mimeType: "image/png", buffer: image },
    },
  });
  expect(validUpload.status()).toBe(201);
  const media = (await validUpload.json()).data.image;
  expect((await request.get(media)).headers()["content-type"]).toBe(
    "image/png",
  );
  await unlink(path.join("data", "uploads", path.basename(media)));
  expect(
    (
      await request.get(
        "/api/qr?url=" + encodeURIComponent("https://line.me/example"),
      )
    ).headers()["content-type"],
  ).toBe("image/png");
  expect((await request.get("/api/qr?url=javascript:alert(1)")).status()).toBe(
    400,
  );
  await page.reload();
  await page.getByRole("button", { name: "畫面與課表", exact: true }).click();
  await page.getByLabel("指定教室 ID（逗號分隔，留空顯示全部）").fill("A,B");
  await page.getByRole("button", { name: /儲存草稿/ }).click();
  await expect(page.getByRole("status")).toHaveText("草稿已儲存");
  expect(
    (await (await page.request.get("/api/admin/content")).json()).data.draft
      .roomIds,
  ).toEqual(["A", "B"]);
  await device.close();
  expect(errors).toEqual([]);
});
