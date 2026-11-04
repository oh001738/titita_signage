"use client";
import { useEffect, useState } from "react";
import {
  Bell,
  Music2,
  Maximize2,
  QrCode,
  Pause,
  Play,
  WifiOff,
  ArrowUpRight,
} from "lucide-react";
import type { DisplayPayload, Lesson } from "@/types";
import { defaultContent, mockLessons } from "@/lib/defaults";
import { isActive, taiwanDate, taiwanTime } from "@/lib/time";
function lessonStatus(lesson: Lesson, now: Date) {
  if (lesson.status === "cancelled")
    return { text: "已取消", style: "cancelled" };
  if (lesson.status === "completed" || lesson.end_time <= taiwanTime(now))
    return { text: "已結束", style: "ended" };
  if (lesson.start_time <= taiwanTime(now))
    return { text: "進行中", style: "live" };
  const diff =
    Date.parse(`${lesson.date}T${lesson.start_time}:00+08:00`) - now.getTime();
  return diff <= 60 * 60_000
    ? { text: "即將開始", style: "soon" }
    : { text: "稍後上課", style: "later" };
}
export function Display({ mode }: { mode: "demo" | "preview" | "screen" }) {
  const [payload, setPayload] = useState<DisplayPayload | null>(null);
  const [now, setNow] = useState(new Date());
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [pairRequired, setPairRequired] = useState(false);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [posterIndex, setPosterIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (mode === "demo") {
      const date = taiwanDate();
      setNow(new Date(date + "T16:20:00+08:00"));
      setOffset(Date.parse(date + "T16:20:00+08:00") - Date.now());
      setPayload({
        content: defaultContent(),
        version: 0,
        schedule: {
          date,
          fetchedAt: new Date().toISOString(),
          source: "mock",
          stale: false,
          lessons: mockLessons(date),
          error: null,
        },
        serverTime: new Date().toISOString(),
      });
      return;
    }
    let disposed = false;
    async function load() {
      try {
        const response = await fetch(
          mode === "preview" ? "/api/admin/preview" : "/api/display",
          { cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok) {
          if (disposed) return;
          if ([401, 403].includes(response.status)) {
            setPayload(null);
            localStorage.removeItem("signage-display-cache");
            setPairRequired(mode === "screen");
          }
          throw new Error(body.error || "無法取得看板內容");
        }
        if (disposed) return;
        const data = body.data as DisplayPayload;
        setPayload(data);
        setOffset(Date.parse(data.serverTime) - Date.now());
        setError("");
        setPairRequired(false);
        if (mode === "screen")
          localStorage.setItem("signage-display-cache", JSON.stringify(data));
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "連線中斷");
      }
    }
    if (mode === "screen") {
      try {
        const cached = localStorage.getItem("signage-display-cache");
        if (cached) setPayload(JSON.parse(cached));
      } catch {
        /* Ignore invalid browser cache. */
      }
    }
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [mode]);
  useEffect(() => {
    const timer = setInterval(
      () => setNow(new Date(Date.now() + offset)),
      1000,
    );
    return () => clearInterval(timer);
  }, [offset]);
  useEffect(() => {
    setPaused(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (
      mode === "screen" &&
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, [mode]);
  const content = payload?.content;
  const posters = (content?.posters ?? []).filter((p) => isActive(p, now));
  const poster = posters[posterIndex % Math.max(1, posters.length)];
  useEffect(() => {
    if (paused || posters.length < 2) return;
    const timer = setTimeout(
      () => setPosterIndex((i) => i + 1),
      (poster?.duration ?? 15) * 1000,
    );
    return () => clearTimeout(timer);
  }, [posterIndex, poster?.duration, paused, posters.length]);
  const today = taiwanDate(now);
  const schedule = payload?.schedule;
  const isExpired =
    !!schedule &&
    (schedule.date !== today ||
      (schedule.source !== "mock" &&
        (!schedule.fetchedAt ||
          now.getTime() - Date.parse(schedule.fetchedAt) > 5 * 60_000)));
  const lessons = (isExpired ? [] : (schedule?.lessons ?? [])).filter(
    (l) =>
      (!content?.roomIds.length || content.roomIds.includes(l.room_id)) &&
      (!content?.hideEnded || l.end_time > taiwanTime(now)),
  );
  const pages = Math.max(1, Math.ceil(lessons.length / 4));
  useEffect(() => {
    if (paused || pages < 2) return;
    const timer = setInterval(() => setPage((p) => p + 1), 12_000);
    return () => clearInterval(timer);
  }, [paused, pages]);
  const notices = (content?.announcements ?? []).filter((a) =>
    isActive(a, now),
  );
  const urgent = notices.find((a) => a.priority === "urgent");
  const notice = urgent ?? notices[noticeIndex % Math.max(1, notices.length)];
  useEffect(() => {
    if (paused || notices.length < 2) return;
    const timer = setInterval(() => setNoticeIndex((i) => i + 1), 20_000);
    return () => clearInterval(timer);
  }, [paused, notices.length]);
  async function pair(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "配對失敗");
    } finally {
      setIsLoading(false);
    }
  }
  if (!payload)
    return (
      <main className="pair-page">
        <div className="pair-card">
          <Music2 size={42} />
          <p className="eyebrow">TITITA SIGNAGE</p>
          <h1>
            {pairRequired ? "讓美好的日常，開始播放" : "正在準備音樂日常"}
          </h1>
          <p>請至獨立 CMS 的「螢幕管理」取得配對碼。</p>
          {mode === "screen" && (
            <form onSubmit={pair}>
              <label htmlFor="pair-code">六位數配對碼</label>
              <input
                id="pair-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <button className="primary" disabled={isLoading}>
                {" "}
                {isLoading ? "配對中…" : "配對這台螢幕"}
              </button>
            </form>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <a href="/login">
            管理員登入 <ArrowUpRight size={16} />
          </a>
        </div>
      </main>
    );
  return (
    <main className={`signage ${content?.theme === "mint" ? "mint" : ""}`}>
      <header className="display-header">
        <div className="brand">
          <Music2 className="brand-mark" strokeWidth={1.4} />
          <div>
            <strong>{content?.schoolName.split(" ")[0]}</strong>
            <span>
              {content?.schoolName.split(" ").slice(1).join(" ") || "音樂教室"}
            </span>
          </div>
        </div>
        <div className="display-date">
          {new Intl.DateTimeFormat("zh-TW", {
            timeZone: "Asia/Taipei",
            month: "long",
            day: "numeric",
            weekday: "long",
          }).format(now)}
        </div>
        <time className="display-clock">{taiwanTime(now)}</time>
      </header>
      <div className="display-main">
        <section className="schedule-panel">
          <div className="schedule-heading">
            <div>
              <p className="eyebrow">TODAY AT TITITA</p>
              <h1>
                今日課程<span className="music-note">♪</span>
              </h1>
            </div>
            <span className="welcome-chip">{content?.welcome}</span>
          </div>
          <div className="schedule-table">
            <div className="schedule-columns">
              <span>時間</span>
              <span>課程 / 授課老師</span>
              <span>教室</span>
              <span>狀態</span>
            </div>
            <div className="lesson-rows">
              {lessons
                .slice((page % pages) * 4, (page % pages) * 4 + 4)
                .map((lesson) => {
                  const status = lessonStatus(lesson, now);
                  return (
                    <div
                      className={`lesson-row ${status.style}`}
                      key={lesson.id}
                    >
                      <div className="lesson-time">
                        {lesson.start_time}
                        <span>— {lesson.end_time}</span>
                      </div>
                      <div className="lesson-course">
                        <strong>{lesson.course_name}</strong>
                        <span>{lesson.teacher_name}</span>
                      </div>
                      <div className="lesson-room">{lesson.room_name}</div>
                      <span className={`lesson-status ${status.style}`}>
                        {status.text}
                      </span>
                    </div>
                  );
                })}
              {lessons.length === 0 && (
                <div className="empty-schedule">
                  <Music2 size={42} />
                  <h2>
                    {isExpired || schedule?.stale
                      ? "課表暫停更新"
                      : "此刻，留一點時間給音樂"}
                  </h2>
                  <p>
                    {isExpired || schedule?.stale
                      ? "請洽櫃台確認今日課程"
                      : "目前沒有符合條件的課程，歡迎洽詢櫃台。"}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="schedule-bottom">
            <span>{content?.footer}</span>
            {pages > 1 && (
              <span className="page-counter">
                {(page % pages) + 1} / {pages}
              </span>
            )}
          </div>
          <div className="display-meta">
            {schedule?.source === "mock"
              ? "模擬資料・非正式課表"
              : `課表更新 ${schedule?.fetchedAt ? taiwanTime(new Date(schedule.fetchedAt)) : "尚未同步"}`}
            {(error || schedule?.stale || isExpired) && (
              <span>
                <WifiOff size={13} /> {error || schedule?.error || "課表已過期"}
              </span>
            )}
            {mode === "preview" && <b>草稿預覽</b>}
          </div>
        </section>
        <aside className="display-aside">
          <div
            className="poster-card"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {poster ? (
              <>
                <img
                  className="poster-image"
                  src={poster.image}
                  alt="音樂活動插畫"
                />
                <div className="poster-title">
                  <span className="eyebrow">MUSIC BRINGS US TOGETHER</span>
                  <h2>{poster.title}</h2>
                  <p>{poster.subtitle}</p>
                </div>
                <div className="poster-dots">
                  {posters.map((p, i) => (
                    <button
                      key={p.id}
                      aria-label={`第 ${i + 1} 張海報`}
                      className={
                        i === posterIndex % posters.length ? "active" : ""
                      }
                      onClick={() => setPosterIndex(i)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="poster-placeholder">
                <Music2 size={64} />
                <h2>每一天，都有新的樂章</h2>
                <p>歡迎來到 {content?.schoolName}</p>
              </div>
            )}
          </div>
          <div className="line-card">
            <div>
              <p className="eyebrow">STAY IN TUNE</p>
              <h2>
                把音樂日常
                <br />
                帶回家
              </h2>
              <p>{content?.qrLabel}</p>
            </div>
            {content?.lineUrl ? (
              <img
                className="qr-image"
                src={`/api/qr?url=${encodeURIComponent(content.lineUrl)}`}
                alt="掃描連結 QR Code"
              />
            ) : (
              <div className="qr-empty">
                <QrCode size={46} />
                <span>連結待設定</span>
              </div>
            )}
          </div>
        </aside>
      </div>
      <footer className={`announcement-bar ${urgent ? "urgent" : ""}`}>
        <div className="announcement-label">
          <Bell size={23} />
          {notice?.title || "教室公告"}
        </div>
        <p>{notice?.body || "歡迎來到音樂的日常。"}</p>
        <span className="footer-brand">
          TITITA
          <br />
          <small>MUSIC & EVERYDAY</small>
        </span>
      </footer>
      <div className="display-controls">
        <button
          aria-label={paused ? "繼續輪播" : "暫停輪播"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          aria-label="全螢幕"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen();
          }}
        >
          <Maximize2 size={16} />
        </button>
        <a href="/admin" aria-label="管理後台">
          CMS
        </a>
      </div>
    </main>
  );
}
