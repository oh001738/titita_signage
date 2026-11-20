import { z } from "zod";
import { HttpError, rateLimit, requireAdmin } from "@/lib/auth";
import { fail, jsonBody, ok } from "@/lib/http";
import { ConflictError, mutateState, readState } from "@/lib/store";
import {
  encryptWeatherKey,
  fetchCountyForecast,
  publicWeatherSettings,
  resolveWeatherKey,
  weatherInput,
} from "@/lib/weather";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    return ok(publicWeatherSettings(await readState()));
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    rateLimit("weather-test", 30, 60000);
    const body = weatherInput
      .extend({ action: z.enum(["locations", "test"]) })
      .parse(await jsonBody(request, 4096));
    const key = await resolveWeatherKey(await readState(), body.apiKey);
    const locations = await fetchCountyForecast(body.county, key);
    const townships = locations.map((item) => item.LocationName);
    if (body.action === "locations") return ok({ townships });
    const location = locations.find(
      (item) => item.LocationName === body.township,
    );
    if (!location)
      throw new HttpError(400, "此縣市沒有選擇的鄉鎮市區，請重新載入地點");
    return ok({
      townships,
      message: `連線成功：${body.county}${location.LocationName}，已取得鄉鎮天氣預報。`,
    });
  } catch (error) {
    return fail(error);
  }
}
export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    rateLimit("weather-save", 15, 60000);
    const body = weatherInput
      .extend({ revision: z.number().int().nonnegative() })
      .parse(await jsonBody(request, 4096));
    const state = await readState();
    const key = await resolveWeatherKey(state, body.apiKey);
    const locations = await fetchCountyForecast(body.county, key);
    if (!locations.some((item) => item.LocationName === body.township))
      throw new HttpError(400, "請選擇此縣市的鄉鎮市區");
    const encryptedKey = body.apiKey
      ? await encryptWeatherKey(body.apiKey)
      : state.weather!.encryptedKey;
    const result = await mutateState((s) => {
      if ((s.weather?.revision ?? 0) !== body.revision)
        throw new ConflictError("天氣設定已更新，請重新載入");
      s.weather = {
        revision: body.revision + 1,
        county: body.county,
        township: body.township,
        encryptedKey,
      };
      return publicWeatherSettings(s);
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
