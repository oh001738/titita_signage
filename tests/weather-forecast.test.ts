import { expect, it } from "vitest";
import {
  selectWeather,
  weatherKind,
  type ForecastLocation,
} from "@/lib/weather-forecast";
const start = "2026-11-20T18:00:00+08:00",
  end = "2026-11-20T21:00:00+08:00";
const fixture = (): ForecastLocation => ({
  LocationName: "臺東市",
  WeatherElement: [
    {
      ElementName: "溫度",
      Time: [{ DataTime: start, ElementValue: [{ Temperature: "23" }] }],
    },
    {
      ElementName: "天氣現象",
      Time: [
        {
          StartTime: start,
          EndTime: end,
          ElementValue: [{ Weather: "多雲短暫雨" }],
        },
      ],
    },
    {
      ElementName: "3小時降雨機率",
      Time: [
        {
          StartTime: start,
          EndTime: end,
          ElementValue: [{ ProbabilityOfPrecipitation: "30" }],
        },
      ],
    },
  ],
});
it("selects the currently valid forecast and drops expired and future values", () => {
  expect(selectWeather(fixture(), Date.parse(start) + 60000)).toMatchObject({
    status: "ready",
    temperature: 23,
    rainProbability: 30,
    kind: "rain",
    validUntil: new Date(end).toISOString(),
  });
  expect(selectWeather(fixture(), Date.parse(end)).status).toBe("unavailable");
  expect(selectWeather(fixture(), Date.parse(start) - 1).status).toBe(
    "unavailable",
  );
});
it("uses the latest temperature and does not turn missing precipitation into zero", () => {
  const data = fixture();
  data.WeatherElement[0].Time.push({
    DataTime: "2026-11-20T19:00:00+08:00",
    ElementValue: [{ Temperature: "24" }],
  });
  data.WeatherElement[2].Time[0].ElementValue[0].ProbabilityOfPrecipitation =
    "-";
  expect(
    selectWeather(data, Date.parse("2026-11-20T19:30:00+08:00")),
  ).toMatchObject({ temperature: 24, rainProbability: undefined });
});
it("maps forecast wording to animations with dangerous weather taking precedence", () => {
  for (const [text, expected] of [
    ["晴", "sun"],
    ["晴時多雲", "partly"],
    ["陰", "cloud"],
    ["陣雨", "rain"],
    ["多雲午後短暫雷陣雨", "thunder"],
    ["霧", "fog"],
    ["雪", "snow"],
  ])
    expect(weatherKind(text, 0)).toBe(expected);
  expect(weatherKind("晴", 12)).toBe("wind");
  expect(weatherKind("雷雨", 12)).toBe("thunder");
});
