"use client";
import { useEffect, useRef, useState } from "react";
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
import type { DisplayPayload, Lesson, Poster } from "@/types";
import { defaultContent, mockLessons } from "@/lib/defaults";
import { isActive, taiwanDate, taiwanTime } from "@/lib/time";
import { selectDisplayLessons } from "@/lib/display-schedule";
import { awardPages } from "@/lib/award-pages";
import { AwardDisplay } from "@/components/AwardDisplay";
import { AlbumDisplay } from "@/components/AlbumDisplay";
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
function PosterArtwork({ poster }: { poster: Poster }) {
  const [shown, setShown] = useState(poster);
  const [previous, setPrevious] = useState<Poster | null>(null);
  useEffect(() => {
    if (poster.id === shown.id && poster.image === shown.image) {
      if (poster.title !== shown.title || poster.subtitle !== shown.subtitle)
        setShown(poster);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setPrevious(shown);
        setShown(poster);
      }
    };
    image.onerror = () => {
      /* Keep the last successfully displayed poster. */
    };
    image.src = poster.image;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [poster.id, poster.image, poster.title, poster.subtitle, shown]);
  useEffect(() => {
    if (!previous) return;
    const timer = setTimeout(() => setPrevious(null), 500);
    return () => clearTimeout(timer);
  }, [previous]);
  const layer = (item: Poster, entering: boolean) => (
    <div
      className={`poster-layer ${entering ? "poster-layer-enter" : ""}`}
      key={`${item.id}:${item.image}`}
    >
      <img className="poster-image" src={item.image} alt="音樂活動插畫" />
      <div className="poster-title">
        <span className="eyebrow">MUSIC BRINGS US TOGETHER</span>
        <h2>{item.title}</h2>
        <p>{item.subtitle}</p>
      </div>
    </div>
  );
  return (
    <>
      {previous && layer(previous, false)}
      {layer(shown, !!previous)}
    </>
  );
}

function AnnouncementText({ body, paused }: { body: string; paused: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState({ text: 0, container: 0 });
  useEffect(() => {
    const measure = () =>
      setWidths({
        text: text.current?.scrollWidth ?? 0,
        container: container.current?.clientWidth ?? 0,
      });
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [body]);
  const isOverflowing = widths.text > widths.container;
  const duration = Math.max(8, (widths.text + widths.container) / 45);
  return (
    <div className="announcement-text" ref={container}>
      <span
        key={body}
        ref={text}
        className={isOverflowing ? "announcement-scroll" : ""}
        style={
          {
            "--scroll-start": `${widths.container}px`,
            "--scroll-end": `-${widths.text}px`,
            "--scroll-duration": `${duration}s`,
            animationPlayState: paused ? "paused" : "running",
          } as React.CSSProperties
        }
      >
        {body}
      </span>
    </div>
  );
}
export function Display({ mode }: { mode: "demo" | "preview" | "screen" }) {
  const [payload, setPayload] = useState<DisplayPayload | null>(null);
  const [now, setNow] = useState(new Date());
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [pairRequired, setPairRequired] = useState(false);
  const [pairCode, setPairCode] = useState("");
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [posterIndex, setPosterIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showAward, setShowAward] = useState(false);
  const [awardFading, setAwardFading] = useState(false);
  const [interludeCursor, setInterludeCursor] = useState(0);
  const [showAlbum, setShowAlbum] = useState(false);
  const [albumFading, setAlbumFading] = useState(false);
  const [albumStep, setAlbumStep] = useState(0);
  const [albumOffsets, setAlbumOffsets] = useState<Record<string, number>>({});
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
          if (mode === "screen" && response.status === 423) {
            setPayload(null);
            localStorage.removeItem("signage-display-cache");
            setPairRequired(false);
            throw new Error(body.error || "螢幕已停用");
          }
          if ([401, 403].includes(response.status)) {
            setPayload(null);
            localStorage.removeItem("signage-display-cache");
            if (mode === "screen") {
              setPairRequired(true);
              setError("");
              return;
            }
          }
          throw new Error(body.error || "無法取得看板內容");
        }
        if (disposed) return;
        const data = body.data as DisplayPayload;
        setPayload(data);
        if (mode === "preview") setOffset(Date.parse(data.serverTime) - Date.now());
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
  // Use short authenticated requests to estimate server time without including
  // the potentially slow OneCloud schedule request in the clock calculation.
  useEffect(() => {
    if (mode !== "screen") return;
    let cancelled = false;
    async function calibrate() {
      let best: { delay: number; offset: number } | undefined;
      for (let i = 0; i < 3; i++) {
        try {
          const start = Date.now();
          const response = await fetch("/api/sync-time", { cache: "no-store" });
          const body = await response.json();
          const end = Date.now();
          if (!response.ok || !body.data) continue;
          const { receivedAt, sentAt } = body.data as { receivedAt: number; sentAt: number };
          const delay = end - start - (sentAt - receivedAt);
          const sample = { delay, offset: ((receivedAt - start) + (sentAt - end)) / 2 };
          if (!best || sample.delay < best.delay) best = sample;
        } catch {
          // Keep the previous estimate when disconnected.
        }
      }
      if (!cancelled && best) setOffset(best.offset);
    }
    void calibrate();
    const timer = setInterval(calibrate, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
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
  const activeAwardPages = awardPages(content?.awards ?? [], now);
  const activeAlbums = (content?.albums ?? []).filter(
    (a) => a.enabled && isActive(a, now) && a.photos.some((p) => p.selected),
  );
  const interludes = [
    ...activeAwardPages.map((page) => ({
      kind: "award" as const,
      page,
      key: `award:${page.award.id}:${page.page}`,
    })),
    ...activeAlbums.map((album) => ({
      kind: "album" as const,
      album,
      key: `album:${album.id}`,
    })),
  ];
  const currentInterlude =
    interludes[interludeCursor % Math.max(1, interludes.length)];
  const currentAwardPage =
    currentInterlude?.kind === "award" ? currentInterlude.page : undefined;
  const currentAlbum =
    currentInterlude?.kind === "album" ? currentInterlude.album : undefined;
  const albumPhotos = currentAlbum?.photos.filter((p) => p.selected) ?? [];
  const albumOffset = currentAlbum ? (albumOffsets[currentAlbum.id] ?? 0) : 0;
  const albumPosition =
    (albumOffset + albumStep) % Math.max(1, albumPhotos.length);
  const currentAlbumPhoto = albumPhotos[albumPosition];
  const batchCount = Math.min(currentAlbum?.batchSize ?? 0, albumPhotos.length);
  const activeInterludesKey = interludes.map((item) => item.key).join(",");
  useEffect(() => {
    if (paused || !activeInterludesKey || awardFading || albumFading) return;
    const seconds = showAward
      ? (currentAwardPage?.award.duration ?? 15)
      : showAlbum
        ? (currentAlbum?.duration ?? 8)
        : 40;
    const timer = setTimeout(() => {
      if (showAward) setAwardFading(true);
      else if (showAlbum) {
        if (albumStep + 1 < batchCount) setAlbumStep((value) => value + 1);
        else {
          setAlbumFading(true);
        }
      } else if (currentInterlude?.kind === "award") setShowAward(true);
      else if (currentInterlude?.kind === "album") {
        setAlbumStep(0);
        setShowAlbum(true);
      }
    }, seconds * 1000);
    return () => clearTimeout(timer);
  }, [
    paused,
    showAward,
    showAlbum,
    awardFading,
    albumFading,
    activeInterludesKey,
    currentAwardPage?.award.duration,
    currentAlbum?.duration,
    currentAlbum?.id,
    currentAlbum?.batchSize,
    albumStep,
    batchCount,
    albumOffset,
    albumPhotos.length,
    currentInterlude?.kind,
  ]);
  useEffect(() => {
    if (!awardFading) return;
    const timer = setTimeout(() => {
      setShowAward(false);
      setAwardFading(false);
      setInterludeCursor((value) => value + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [awardFading]);
  useEffect(() => {
    if (!albumFading) return;
    const timer = setTimeout(() => {
      if (currentAlbum)
        setAlbumOffsets((offsets) => ({
          ...offsets,
          [currentAlbum.id]:
            (albumOffset + batchCount) % Math.max(1, albumPhotos.length),
        }));
      setShowAlbum(false);
      setAlbumFading(false);
      setAlbumStep(0);
      setInterludeCursor((value) => value + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [
    albumFading,
    currentAlbum?.id,
    albumOffset,
    batchCount,
    albumPhotos.length,
  ]);
  const today = taiwanDate(now);
  const schedule = payload?.schedule;
  const isExpired =
    !!schedule &&
    (schedule.date !== today ||
      (schedule.source !== "mock" &&
        (!schedule.fetchedAt ||
          now.getTime() - Date.parse(schedule.fetchedAt) > 5 * 60_000)));
  const eligibleLessons = (isExpired ? [] : (schedule?.lessons ?? [])).filter(
    (lesson) =>
      !content?.roomIds.length || content.roomIds.includes(lesson.room_id),
  );
  const {
    visible: lessons,
    next: nextLesson,
    hasScheduled,
  } = selectDisplayLessons(eligibleLessons, now);
  const pages = Math.max(1, Math.ceil(lessons.length / 4));
  const currentPage = Math.floor(now.getTime() / 12_000) % pages;
  const frozenPage = useRef(0);
  useEffect(() => {
    if (!paused) frozenPage.current = currentPage;
  }, [paused, currentPage]);
  const page = paused ? frozenPage.current : currentPage;
  const notices = (content?.announcements ?? []).filter((a) =>
    isActive(a, now),
  );
  const urgent = notices.find((a) => a.priority === "urgent");
  const notice = urgent ?? notices[noticeIndex % Math.max(1, notices.length)];
  useEffect(() => {
    if (paused || notices.length < 2) return;
    const timer = setTimeout(
      () => setNoticeIndex((i) => i + 1),
      Math.max(20_000, (notice?.body.length ?? 0) * 1500 + 12_000),
    );
    return () => clearTimeout(timer);
  }, [paused, notices.length, notice?.id, notice?.body]);
  useEffect(() => {
    if (mode !== "screen" || !pairRequired) return;
    let cancelled = false;
    let refresh: ReturnType<typeof setTimeout>;
    async function createPairing() {
      try {
        const response = await fetch("/api/pair", { method: "POST" });
        const body = await response.json();
        if (response.status === 409) {
          window.location.reload();
          return;
        }
        if (!response.ok) throw new Error(body.error || "無法產生配對碼");
        if (cancelled) return;
        setPairCode(body.data.code);
        setError("");
        refresh = setTimeout(
          createPairing,
          Math.max(1000, Date.parse(body.data.expiresAt) - Date.now()),
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "無法產生配對碼");
          refresh = setTimeout(createPairing, 30_000);
        }
      }
    }
    void createPairing();
    const poll = setInterval(async () => {
      try {
        const response = await fetch("/api/display", { cache: "no-store" });
        if (
          response.ok ||
          (response.status === 404 &&
            (await response.json()).error === "尚未發布內容，請至管理後台發布")
        )
          window.location.reload();
      } catch {
        /* Retry when the network returns. */
      }
    }, 3_000);
    return () => {
      cancelled = true;
      clearTimeout(refresh);
      clearInterval(poll);
    };
  }, [mode, pairRequired]);
  if (!payload)
    return (
      <main className="pair-page">
        <div className="pair-card">
          <Music2 size={42} />
          <p className="eyebrow">TITITA SIGNAGE</p>
          <h1>{pairRequired ? "請在後台配對這台螢幕" : "正在準備音樂日常"}</h1>
          {pairRequired && (
            <>
              <p>請在 CMS 後台「螢幕管理」輸入以下配對碼：</p>
              <div className="pair-code">
                <span>螢幕配對碼</span>
                <strong aria-label="螢幕配對碼">{pairCode || "產生中…"}</strong>
                <small>有效 10 分鐘，到期自動更新</small>
              </div>
              <p>配對完成後，畫面會自動開始播放。</p>
            </>
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
    <main
      className={`signage ${content?.theme === "mint" ? "mint" : ""} ${(showAward && currentAwardPage) || (showAlbum && currentAlbumPhoto) ? "award-active" : ""}`}
    >
      <header className="display-header">
        <div className="brand">
          {content?.logo ? (
            <img
              className="display-brand-logo"
              src={content.logo}
              alt={content.schoolName}
            />
          ) : (
            <>
              <Music2 className="brand-mark" strokeWidth={1.4} />
              <div>
                <strong>{content?.schoolName.split(" ")[0]}</strong>
                <span>
                  {content?.schoolName.split(" ").slice(1).join(" ") ||
                    "音樂教室"}
                </span>
              </div>
            </>
          )}
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
            <div className="lesson-rows" key={page % pages}>
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
                      <span
                        key={status.style}
                        className={`lesson-status status-enter ${status.style}`}
                      >
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
                      : nextLesson
                        ? "目前一小時內沒有課程"
                        : hasScheduled
                          ? "今日課程已結束"
                          : "今日沒有課程"}
                  </h2>
                  <p>
                    {isExpired || schedule?.stale
                      ? "請洽櫃台確認今日課程"
                      : nextLesson
                        ? `下一堂課：${nextLesson.start_time} ${nextLesson.course_name}・${nextLesson.room_name}`
                        : "感謝今天一起度過的音樂時光"}
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
                <PosterArtwork poster={poster} />
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
        <AnnouncementText
          body={notice?.body || "歡迎來到音樂的日常。"}
          paused={paused}
        />
        <span className="footer-brand">
          TITITA
          <br />
          <small>MUSIC & EVERYDAY</small>
        </span>
      </footer>
      {showAward && currentAwardPage && (
        <AwardDisplay
          {...currentAwardPage}
          fading={awardFading}
          schoolName={content?.schoolName ?? "梯梯塔音樂坊"}
          logo={content?.logo}
        />
      )}
      {showAlbum && currentAlbum && currentAlbumPhoto && (
        <AlbumDisplay
          album={currentAlbum}
          photo={currentAlbumPhoto}
          fading={albumFading}
          position={albumPosition}
          total={albumPhotos.length}
          schoolName={content?.schoolName ?? "梯梯塔音樂坊"}
        />
      )}
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
