"use client";
import { useEffect, useState } from "react";
import type { DisplayWeather } from "@/types";
import styles from "./WeatherWidget.module.css";
export function WeatherWidget({
  weather,
}: {
  weather?: DisplayWeather | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const [page, setPage] = useState(0);
  const secondary =
    weather?.apparentTemperature !== undefined &&
    weather?.relativeHumidity !== undefined &&
    !!weather?.comfortDescription;
  useEffect(() => {
    if (!secondary || weather?.status !== "ready") {
      setPage(0);
      return;
    }
    const timer = setInterval(() => setPage((value) => 1 - value), 10000);
    return () => clearInterval(timer);
  }, [secondary, weather?.status, weather?.township]);
  if (!weather) return null;
  const ready =
    weather.status === "ready" && Date.parse(weather.validUntil ?? "") > now;
  const kind = ready ? (weather.kind ?? "cloud") : "loading";
  const night = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5].includes(
    new Date(now + 8 * 3600000).getUTCHours(),
  );
  const icon =
    night && kind === "sun"
      ? "night"
      : night && kind === "partly"
        ? "night-cloud"
        : kind;
  return (
    <div
      className={styles.widget}
      data-weather={kind}
      data-weather-night={night}
      data-icon={icon}
      aria-label={
        ready && secondary && page === 1
          ? `${weather.township}，預報體感溫度 ${weather.apparentTemperature} 度，相對濕度 ${weather.relativeHumidity}%，${weather.comfortDescription}`
          : ready
            ? `${weather.township}，${weather.description}，預報溫度 ${weather.temperature} 度${weather.rainProbability !== undefined ? `，3小時降雨機率 ${weather.rainProbability}%` : ""}`
            : `${weather.township}，天氣更新中`
      }
    >
      <div className={styles.visual}>
        <div className={styles.scene} data-weather-scene aria-hidden="true">
          <div className={styles.sun} data-weather-motion>
            <div className={styles.rays}>
              {Array.from({ length: 8 }, (_, index) => (
                <i key={index} />
              ))}
            </div>
            <div className={styles.sphere} />
          </div>
          <div className={styles.moon} data-weather-motion />
          <div className={styles.stars}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.cloudBack} data-weather-motion />
          <div className={styles.cloud} data-weather-motion />
          <div className={styles.rain}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.lightning} />
          <div className={styles.mist}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.wind} data-weather-motion>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.snow}>
            <i>✦</i>
            <i>✦</i>
            <i>✦</i>
          </div>
        </div>
      </div>
      <div
        className={styles.readout}
        data-weather-page={ready && secondary ? page + 1 : 1}
        key={ready && secondary ? page : 0}
      >
        <div className={styles.copy}>
          <div className={styles.cityRow}>
            <span className={styles.city} data-weather-location>
              {weather.township}
            </span>
            {ready && page === 1 && secondary && (
              <small className={styles.tempLabel}>體感</small>
            )}
          </div>
          <div className={styles.details}>
            {!ready && (
              <span className={styles.condition} data-weather-description>
                天氣更新中
              </span>
            )}
            <span className={styles.precip} data-weather-precip>
              {ready
                ? page === 1 && secondary
                  ? `濕度 ${weather.relativeHumidity}% · ${weather.comfortDescription}`
                  : weather.rainProbability !== undefined
                    ? `3小時降雨 ${weather.rainProbability}%`
                    : "氣象署預報"
                : "中央氣象署"}
            </span>
          </div>
        </div>
        <strong className={styles.temp}>
          <span className={styles.value} data-weather-temperature>
            {ready
              ? Math.round(
                  page === 1 && secondary
                    ? weather.apparentTemperature!
                    : weather.temperature!,
                )
              : "—"}
          </span>
          {ready && <span className={styles.unit}>°C</span>}
        </strong>
      </div>
    </div>
  );
}
