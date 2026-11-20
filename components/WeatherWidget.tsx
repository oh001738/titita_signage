"use client";
import { useEffect, useState } from "react";
import { Cloud, Moon, Snowflake, Sun, Wind } from "lucide-react";
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
  return (
    <div
      className={styles.widget}
      data-weather={kind}
      aria-label={
        ready
          ? `${weather.township}，${weather.description}，預報溫度 ${weather.temperature} 度${weather.rainProbability !== undefined ? `，3小時降雨機率 ${weather.rainProbability}%` : ""}`
          : `${weather.township}，天氣更新中`
      }
    >
      <div className={styles.scene} aria-hidden="true">
        {(kind === "sun" || kind === "partly") &&
          (night ? (
            <Moon className={styles.moon} />
          ) : (
            <Sun className={styles.sun} />
          ))}
        {[
          "partly",
          "cloud",
          "rain",
          "thunder",
          "snow",
          "fog",
          "loading",
        ].includes(kind) && <Cloud className={styles.cloud} />}
        {(kind === "rain" || kind === "thunder") && (
          <div className={styles.drops}>
            <i />
            <i />
            <i />
          </div>
        )}
        {kind === "thunder" && <span className={styles.bolt}>ϟ</span>}
        {kind === "wind" && <Wind className={styles.wind} />}
        {kind === "fog" && (
          <div className={styles.fog}>
            <i />
            <i />
          </div>
        )}
        {kind === "snow" && <Snowflake className={styles.snow} />}
      </div>
      <div className={styles.info}>
        <div className={styles.top}>
          <span>{weather.township}</span>
          <strong>
            {ready ? `${Math.round(weather.temperature!)}°` : "—"}
          </strong>
        </div>
        <span className={styles.condition}>
          {ready ? weather.description : "天氣更新中"}
        </span>
        <small>
          {ready
            ? `預報${weather.rainProbability !== undefined ? ` · 3小時降雨 ${weather.rainProbability}%` : " · 中央氣象署"}`
            : "中央氣象署"}
        </small>
      </div>
    </div>
  );
}
