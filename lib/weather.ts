import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { HttpError, hashToken } from "./auth";
import { selectWeather, type ForecastLocation } from "./weather-forecast";
import { dataDir } from "./store";
import { weatherCounties } from "./weather-locations";
import type { CmsState, DisplayWeather } from "@/types";

export const weatherInput = z.object({
  county: z
    .string()
    .refine((v) => Object.hasOwn(weatherCounties, v), "請選擇有效縣市"),
  township: z.string().trim().min(1).max(30),
  apiKey: z
    .string()
    .trim()
    .max(100)
    .regex(/^(CWA-[A-Za-z0-9-]+)?$/, "授權碼格式不正確")
    .optional(),
});
// Independent of SESSION_SECRET, which changes when the admin password is reset.
async function encryptionKey() {
  await mkdir(dataDir(), { recursive: true });
  const file = path.join(dataDir(), "weather.key");
  try {
    return await readKey(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, randomBytes(32), { mode: 0o600 });
  try {
    try {
      await link(temp, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  } finally {
    await unlink(temp);
  }
  return readKey(file);
}
async function readKey(file: string) {
  const key = await readFile(file);
  if (key.length !== 32) throw new Error("Invalid weather encryption key");
  return key;
}
export async function encryptWeatherKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export async function resolveWeatherKey(state: CmsState, input?: string) {
  if (input) return input;
  if (!state.weather?.encryptedKey)
    throw new HttpError(400, "請先輸入 API 授權碼");
  const value = Buffer.from(state.weather.encryptedKey, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    await readKey(path.join(dataDir(), "weather.key")),
    value.subarray(0, 12),
  );
  cipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([
    cipher.update(value.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export function publicWeatherSettings(state: CmsState) {
  return {
    revision: state.weather?.revision ?? 0,
    county: state.weather?.county ?? "臺東縣",
    township: state.weather?.township ?? "臺東市",
    hasApiKey: Boolean(state.weather?.encryptedKey),
  };
}
const forecastSchema = z.object({
  success: z.union([z.literal("true"), z.literal(true)]),
  records: z.object({
    Locations: z.array(
      z.object({
        LocationsName: z.string(),
        Location: z.array(
          z.object({
            LocationName: z.string(),
            WeatherElement: z.array(
              z.object({
                ElementName: z.string(),
                Time: z.array(
                  z.object({
                    DataTime: z.string().optional(),
                    StartTime: z.string().optional(),
                    EndTime: z.string().optional(),
                    ElementValue: z.array(z.record(z.string(), z.string())),
                  }),
                ),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
});
export async function fetchCountyForecast(county: string, apiKey: string) {
  if (!Object.hasOwn(weatherCounties, county))
    throw new HttpError(400, "無效的縣市");
  try {
    const response = await fetch(
      `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-${weatherCounties[county]}?format=JSON`,
      {
        headers: { Authorization: apiKey },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (response.status === 401 || response.status === 403)
      throw new HttpError(400, "授權碼無效或尚未啟用，請至氣象署確認");
    if (!response.ok) throw new Error("CWA unavailable");
    const data = forecastSchema.parse(await response.json());
    const locations = data.records.Locations.find(
      (item) => item.LocationsName === county,
    )?.Location;
    if (!locations?.length) throw new Error("No locations");
    return locations;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Never return upstream response bodies, URLs or credential-bearing errors.
    throw new HttpError(502, "無法取得氣象署資料，請檢查授權碼或稍後重試");
  }
}
type WeatherCacheEntry = {
  until: number;
  data: Promise<ForecastLocation[]>;
  previous?: ForecastLocation[];
  latest?: ForecastLocation[];
};
const cache = globalThis as typeof globalThis & {
  signageWeather?: Map<string, WeatherCacheEntry>;
};
export async function displayWeather(
  state: CmsState,
): Promise<DisplayWeather | null> {
  if (!state.weather?.encryptedKey) return null;
  const { county, township, encryptedKey } = state.weather;
  const id = `${county}:${hashToken(encryptedKey)}`;
  const entries: NonNullable<typeof cache.signageWeather> =
    (cache.signageWeather ??= new Map());
  let entry = entries.get(id);
  if (!entry || entry.until <= Date.now()) {
    const previous = entry?.latest ?? entry?.previous;
    entries.clear();
    entry = {
      until: Date.now() + 15 * 60000,
      previous,
      data: Promise.resolve([]),
    };
    const current = entry;
    entry.data = resolveWeatherKey(state)
      .then((key) => fetchCountyForecast(county, key))
      .then((data) => {
        current.latest = data;
        return data;
      })
      .catch(() => {
        current.until = Date.now() + 60000;
        console.warn("[weather] forecast fetch failed; retrying in one minute");
        return [];
      });
    entries.set(id, entry);
  }
  const previous = entry.previous;
  const data = await entry.data;
  const latest = data.find((item) => item.LocationName === township);
  const old = previous?.find((item) => item.LocationName === township);
  const latestCurrent = latest && selectWeather(latest);
  if (latestCurrent?.status === "ready") return latestCurrent;
  const oldCurrent = old && selectWeather(old);
  if (oldCurrent?.status === "ready") return oldCurrent;
  const future =
    (latest && selectWeather(latest, Date.now(), true)) ||
    (old && selectWeather(old, Date.now(), true));
  const next =
    future?.status === "ready"
      ? future
      : old && selectWeather(old, Date.now(), true);
  if (next?.status === "ready") {
    console.info(
      "[weather] no current forecast; using next forecast within three hours",
    );
    return next;
  }
  console.warn("[weather] no current or upcoming forecast available");
  return { township, status: "unavailable" };
}
