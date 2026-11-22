"use client";
import { useEffect, useState } from "react";
import { weatherCounties, taitungTownships } from "@/lib/weather-locations";
interface Settings {
  revision: number;
  county: string;
  township: string;
  hasApiKey: boolean;
}
async function api<T>(method: string, data?: unknown): Promise<T> {
  const response = await fetch("/api/admin/weather", {
    method,
    cache: "no-store",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "操作失敗");
  return body.data;
}
export function WeatherSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [townships, setTownships] = useState<string[]>(taitungTownships);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const data = await api<Settings>("GET");
    setSettings(data);
    setApiKey("");
    setTownships(data.county === "臺東縣" ? taitungTownships : [data.township]);
    setDirty(false);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  async function run(action: "locations" | "test" | "save") {
    if (!settings) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const input = {
        ...settings,
        apiKey,
        township: settings.township || "待選擇",
      };
      if (action === "save") {
        const saved = await api<Settings>("PUT", input);
        setSettings(saved);
        setApiKey("");
        setDirty(false);
        setMessage("天氣設定已儲存，授權碼已加密保存。");
      } else {
        const result = await api<{ townships: string[]; message?: string }>(
          "POST",
          { ...input, action },
        );
        setTownships(result.townships);
        if (!result.townships.includes(settings.township)) {
          setSettings({ ...settings, township: result.townships[0] });
          setDirty(true);
        }
        setMessage(result.message || "已載入鄉鎮市區，請選擇地點後儲存。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card editor-card">
      <h2>中央氣象署天氣設定</h2>
      <p className="field-hint">
        選擇教室所在地，儲存後看板右下角會在 30
        秒內同步天氣與動畫。顯示資料為鄉鎮預報；時段交接時可能顯示未來 3
        小時內最近的預報。
      </p>
      {error && (
        <p className="error feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success feedback" role="status">
          {message}
        </p>
      )}
      {!settings ? (
        <button
          className="secondary"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          重新載入設定
        </button>
      ) : (
        <>
          <fieldset disabled={busy} className="weather-fields">
            <label>
              API 授權碼
              <input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={apiKey}
                placeholder={
                  settings.hasApiKey
                    ? "已設定；留白沿用，輸入新碼即可更換"
                    : "請輸入 CWA- 開頭的授權碼"
                }
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setDirty(true);
                  setMessage("");
                }}
              />
            </label>
            <p className="field-hint">
              {settings.hasApiKey
                ? "已儲存授權碼，不會顯示原文。"
                : "尚未設定授權碼。"}{" "}
              不需要另外填寫 Secret。測試連線不會儲存變更。
            </p>
            <div className="form-grid">
              <label>
                縣市
                <select
                  value={settings.county}
                  onChange={(e) => {
                    const county = e.target.value;
                    setSettings({
                      ...settings,
                      county,
                      township: county === "臺東縣" ? "臺東市" : "",
                    });
                    setTownships(county === "臺東縣" ? taitungTownships : []);
                    setDirty(true);
                    setMessage("");
                  }}
                >
                  {Object.keys(weatherCounties).map((county) => (
                    <option key={county}>{county}</option>
                  ))}
                </select>
              </label>
              <label>
                鄉鎮市區
                <select
                  value={settings.township}
                  onChange={(e) => {
                    setSettings({ ...settings, township: e.target.value });
                    setDirty(true);
                    setMessage("");
                  }}
                >
                  <option value="" disabled>
                    請先載入此縣市地點
                  </option>
                  {townships.map((town) => (
                    <option key={town}>{town}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                onClick={() => void run("locations")}
                disabled={!apiKey && !settings.hasApiKey}
              >
                載入鄉鎮地點
              </button>
              <button
                className="secondary"
                onClick={() => void run("test")}
                disabled={
                  !settings.township || (!apiKey && !settings.hasApiKey)
                }
              >
                測試連線
              </button>
              <button
                className="primary"
                onClick={() => void run("save")}
                disabled={
                  !dirty ||
                  !settings.township ||
                  (!apiKey && !settings.hasApiKey)
                }
              >
                {busy ? "處理中…" : `儲存天氣設定${dirty ? " *" : ""}`}
              </button>
            </div>
          </fieldset>
        </>
      )}
    </section>
  );
}
