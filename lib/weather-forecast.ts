import type { DisplayWeather, WeatherKind } from "@/types";
export interface ForecastLocation {
  LocationName: string;
  WeatherElement: {
    ElementName: string;
    Time: {
      DataTime?: string;
      StartTime?: string;
      EndTime?: string;
      ElementValue: Record<string, string>[];
    }[];
  }[];
}
export function weatherKind(text: string, wind: number): WeatherKind {
  if (text.includes("雷")) return "thunder";
  if (text.includes("雪")) return "snow";
  if (text.includes("雨")) return "rain";
  if (text.includes("霧")) return "fog";
  if (wind >= 10.8) return "wind";
  if (text.includes("晴") && text.includes("雲")) return "partly";
  if (text.includes("晴")) return "sun";
  return "cloud";
}
export function selectWeather(
  location: ForecastLocation,
  now = Date.now(),
): DisplayWeather {
  const unavailable: DisplayWeather = {
    township: location.LocationName,
    status: "unavailable",
  };
  const find = (name: string) =>
    location.WeatherElement.find((e) => e.ElementName === name)
      ?.Time.filter((time) => {
        const start = Date.parse(time.StartTime ?? time.DataTime ?? "");
        const end = time.EndTime
          ? Date.parse(time.EndTime)
          : start + 3 * 3600000;
        return start <= now && now < end;
      })
      .sort(
        (a, b) =>
          Date.parse(b.StartTime ?? b.DataTime ?? "") -
          Date.parse(a.StartTime ?? a.DataTime ?? ""),
      )[0];
  const temp = find("溫度"),
    wx = find("天氣現象"),
    rain = find("3小時降雨機率"),
    wind = find("風速");
  const number = (v?: string) =>
    v?.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const temperature = number(temp?.ElementValue[0]?.Temperature);
  const description = wx?.ElementValue[0]?.Weather;
  if (temperature === undefined || !description || !temp || !wx)
    return unavailable;
  const ends = [temp, wx, rain]
    .filter(Boolean)
    .map((t) =>
      t!.EndTime
        ? Date.parse(t!.EndTime!)
        : Date.parse(t!.DataTime!) + 3 * 3600000,
    );
  const probability = number(rain?.ElementValue[0]?.ProbabilityOfPrecipitation);
  return {
    township: location.LocationName,
    status: "ready",
    temperature,
    description,
    kind: weatherKind(
      description,
      number(wind?.ElementValue[0]?.WindSpeed) ?? 0,
    ),
    rainProbability:
      probability !== undefined && probability >= 0 && probability <= 100
        ? probability
        : undefined,
    validUntil: new Date(Math.min(...ends)).toISOString(),
  };
}
