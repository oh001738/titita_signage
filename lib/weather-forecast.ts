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
  allowFuture = false,
): DisplayWeather {
  const unavailable: DisplayWeather = {
    township: location.LocationName,
    status: "unavailable",
  };
  const startOf = (
    time: ForecastLocation["WeatherElement"][number]["Time"][number],
  ) => Date.parse(time.StartTime ?? time.DataTime ?? "");
  const endOf = (
    time: ForecastLocation["WeatherElement"][number]["Time"][number],
  ) => (time.EndTime ? Date.parse(time.EndTime) : startOf(time) + 3 * 3600000);
  const find = (name: string, at: number) =>
    location.WeatherElement.find((e) => e.ElementName === name)
      ?.Time.filter((t) => startOf(t) <= at && at < endOf(t))
      .sort((a, b) => startOf(b) - startOf(a))[0];
  let at = now;
  if (allowFuture && (!find("溫度", at) || !find("天氣現象", at))) {
    const candidates =
      location.WeatherElement.find((e) => e.ElementName === "天氣現象")
        ?.Time.map(startOf)
        .filter((t) => t > now && t <= now + 3 * 3600000)
        .sort((a, b) => a - b) ?? [];
    const next = candidates.find((t) => find("溫度", t) && find("天氣現象", t));
    if (next !== undefined) at = next;
  }
  const temp = find("溫度", at),
    wx = find("天氣現象", at),
    rain = find("3小時降雨機率", at),
    wind = find("風速", at);
  const apparent = find("體感溫度", at),
    humidity = find("相對濕度", at),
    comfort = find("舒適度指數", at);
  const number = (v?: string) =>
    v?.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const temperature = number(temp?.ElementValue[0]?.Temperature);
  const description = wx?.ElementValue[0]?.Weather;
  if (temperature === undefined || !description || !temp || !wx)
    return unavailable;
  const probability = number(rain?.ElementValue[0]?.ProbabilityOfPrecipitation);
  const relativeHumidity = number(humidity?.ElementValue[0]?.RelativeHumidity);
  const apparentTemperature = number(
    apparent?.ElementValue[0]?.ApparentTemperature,
  );
  const comfortDescription =
    comfort?.ElementValue[0]?.ComfortIndexDescription?.trim();
  const hasSecondary =
    apparentTemperature !== undefined &&
    relativeHumidity !== undefined &&
    relativeHumidity >= 0 &&
    relativeHumidity <= 100 &&
    !!comfortDescription;
  const used = [
    temp,
    wx,
    rain,
    ...(hasSecondary ? [apparent, humidity, comfort] : []),
  ].filter((v): v is NonNullable<typeof v> => !!v);
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
    ...(hasSecondary
      ? { apparentTemperature, relativeHumidity, comfortDescription }
      : {}),
    forecastStart: new Date(at).toISOString(),
    validUntil: new Date(Math.min(...used.map(endOf))).toISOString(),
  };
}
