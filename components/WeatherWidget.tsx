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
        ready
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
      <div className={styles.readout}>
        <div className={styles.copy}>
          <span className={styles.city} data-weather-location>
            {weather.township}
          </span>
          <div className={styles.details}>
            {!ready && (
              <span className={styles.condition} data-weather-description>
                天氣更新中
              </span>
            )}
            <span className={styles.precip} data-weather-precip>
              {ready
                ? weather.rainProbability !== undefined
                  ? `3小時降雨 ${weather.rainProbability}%`
                  : "氣象署預報"
                : "中央氣象署"}
            </span>
          </div>
        </div>
        <strong className={styles.temp}>
          <span className={styles.value} data-weather-temperature>
            {ready ? Math.round(weather.temperature!) : "—"}
          </span>
          {ready && <span className={styles.unit}>°C</span>}
        </strong>
      </div>
    </div>
  );
}
