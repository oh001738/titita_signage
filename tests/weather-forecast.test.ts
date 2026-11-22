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
it("uses a coherent upcoming forecast only within three hours", () => {
  const data = fixture();
  const before = Date.parse(start) - 30 * 60000;
  expect(selectWeather(data, before).status).toBe("unavailable");
  expect(selectWeather(data, before, true)).toMatchObject({
    status: "ready",
    temperature: 23,
    rainProbability: 30,
    forecastStart: new Date(start).toISOString(),
  });
  expect(
    selectWeather(data, Date.parse(start) - 3 * 3600000 - 1, true).status,
  ).toBe("unavailable");
});
it("only provides the second page when all fields are valid for the chosen period", () => {
  const data = fixture();
  data.WeatherElement.push(
    {
      ElementName: "體感溫度",
      Time: [
        { DataTime: start, ElementValue: [{ ApparentTemperature: "27" }] },
      ],
    },
    {
      ElementName: "相對濕度",
      Time: [{ DataTime: start, ElementValue: [{ RelativeHumidity: "70" }] }],
    },
    {
      ElementName: "舒適度指數",
      Time: [
        {
          DataTime: start,
          ElementValue: [
            { ComfortIndex: "21", ComfortIndexDescription: "舒適" },
          ],
        },
      ],
    },
  );
  expect(selectWeather(data, Date.parse(start))).toMatchObject({
    apparentTemperature: 27,
    relativeHumidity: 70,
    comfortDescription: "舒適",
  });
  data.WeatherElement[4].Time[0].ElementValue[0].RelativeHumidity = "-";
  expect(
    selectWeather(data, Date.parse(start)).apparentTemperature,
  ).toBeUndefined();
});
