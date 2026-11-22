import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultState } from "@/lib/defaults";
import {
  encryptWeatherKey,
  resolveWeatherKey,
  publicWeatherSettings,
  fetchCountyForecast,
  displayWeather,
} from "@/lib/weather";
import { readState } from "@/lib/store";
import { GET, PUT, POST } from "@/app/api/admin/weather/route";
import { HttpError } from "@/lib/auth";
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requireAdmin: mocks.admin,
}));
let dir = "";
const key = "CWA-test-credential";
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "signage-weather-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("CMS_STORAGE", "file");
  vi.stubEnv("MOCK_MODE", "true");
  mocks.admin.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () =>
      Response.json({
        success: "true",
        records: {
          Locations: [
            {
              LocationsName: "臺東縣",
              Location: [{ LocationName: "臺東市", WeatherElement: [] }],
            },
          ],
        },
      }),
    ),
  );
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  await rm(dir, { recursive: true, force: true });
});
it("keeps the previous valid forecast across refreshes and switches to the next period without using expired values", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-22T11:00:00+08:00"));
  const state = defaultState();
  state.weather = {
    revision: 1,
    county: "臺東縣",
    township: "臺東市",
    encryptedKey: await encryptWeatherKey(key),
  };
  const weather = (start: string, end: string, temp: string) => ({
    success: "true",
    records: {
      Locations: [
        {
          LocationsName: "臺東縣",
          Location: [
            {
              LocationName: "臺東市",
              WeatherElement: [
                {
                  ElementName: "溫度",
                  Time: [
                    { DataTime: start, ElementValue: [{ Temperature: temp }] },
                  ],
                },
                {
                  ElementName: "天氣現象",
                  Time: [
                    {
                      StartTime: start,
                      EndTime: end,
                      ElementValue: [{ Weather: "晴" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  const old = weather(
    "2026-11-22T10:00:00+08:00",
    "2026-11-22T12:00:00+08:00",
    "22",
  );
  const upcoming = weather(
    "2026-11-22T12:00:00+08:00",
    "2026-11-22T15:00:00+08:00",
    "25",
  );
  vi.mocked(fetch).mockImplementation(async () => Response.json(old));
  expect((await displayWeather(state))?.temperature).toBe(22);
  vi.setSystemTime(new Date("2026-11-22T11:20:00+08:00"));
  vi.mocked(fetch).mockImplementation(async () => Response.json(upcoming));
  expect((await displayWeather(state))?.temperature).toBe(22);
  expect((await displayWeather(state))?.temperature).toBe(22);
  vi.setSystemTime(new Date("2026-11-22T12:00:00+08:00"));
  expect((await displayWeather(state))?.temperature).toBe(25);
});
const request = (method: string, body: unknown) =>
  new Request("http://localhost/api/admin/weather", {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
      Host: "localhost",
    },
    body: JSON.stringify(body),
  });
const input = {
  county: "臺東縣",
  township: "臺東市",
  apiKey: key,
  revision: 0,
};
it("encrypts credentials with a persistent key independent from password resets", async () => {
  const encryptedKey = await encryptWeatherKey(key);
  expect(encryptedKey).not.toContain(key);
  const state = defaultState();
  state.weather = {
    revision: 1,
    county: "臺東縣",
    township: "臺東市",
    encryptedKey,
  };
  vi.stubEnv("SESSION_SECRET", "rotated");
  expect(await resolveWeatherKey(state)).toBe(key);
  expect(JSON.stringify(publicWeatherSettings(state))).not.toContain(
    encryptedKey,
  );
  const data = Buffer.from(encryptedKey, "base64");
  data[30] ^= 1;
  state.weather.encryptedKey = data.toString("base64");
  await expect(resolveWeatherKey(state)).rejects.toThrow();
});
it("saves independently, redacts credentials, preserves blank keys and rejects stale revisions", async () => {
  expect((await PUT(request("PUT", input))).status).toBe(200);
  const state = await readState();
  expect(state.contentRevision).toBe(0);
  expect(state.weather?.revision).toBe(1);
  expect(await readFile(path.join(dir, "cms.json"), "utf8")).not.toContain(key);
  const response = await GET();
  expect(await response.json()).toEqual({
    data: {
      revision: 1,
      county: "臺東縣",
      township: "臺東市",
      hasApiKey: true,
    },
    error: null,
  });
  expect(
    (await PUT(request("PUT", { ...input, revision: 1, apiKey: "" }))).status,
  ).toBe(200);
  expect((await PUT(request("PUT", input))).status).toBe(409);
  expect(await resolveWeatherKey(await readState())).toBe(key);
});
it("tests unsaved credentials without storing them and rejects invalid townships", async () => {
  expect(
    (await POST(request("POST", { ...input, action: "test" }))).status,
  ).toBe(200);
  expect((await readState()).weather).toBeUndefined();
  expect(
    (await PUT(request("PUT", { ...input, township: "不存在" }))).status,
  ).toBe(400);
  expect((await readState()).weather).toBeUndefined();
  expect(fetch).toHaveBeenCalledWith(
    expect.not.stringContaining(key),
    expect.objectContaining({
      headers: { Authorization: key },
      redirect: "error",
    }),
  );
});
it("sanitizes upstream errors and rejects unsupported counties without making requests", async () => {
  await expect(fetchCountyForecast("__proto__", key)).rejects.toThrow(
    "無效的縣市",
  );
  expect(fetch).not.toHaveBeenCalled();
  vi.mocked(fetch).mockRejectedValue(new Error(key));
  const response = await POST(request("POST", { ...input, action: "test" }));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain(key);
});
it("requires authentication on reads and origin-aware authentication on mutations", async () => {
  mocks.admin.mockRejectedValue(new HttpError(401, "請先登入"));
  expect((await GET()).status).toBe(401);
  expect((await PUT(request("PUT", input))).status).toBe(401);
  expect(
    (await POST(request("POST", { ...input, action: "test" }))).status,
  ).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
