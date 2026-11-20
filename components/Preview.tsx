"use client";
import { useState } from "react";
import styles from "./Preview.module.css";

export function Preview({
  initialSource,
}: {
  initialSource: "draft" | "published";
}) {
  const [source, setSource] = useState(initialSource);
  function select(next: "draft" | "published") {
    setSource(next);
    const url = new URL(window.location.href);
    url.searchParams.set("source", next);
    window.history.replaceState(null, "", url);
  }
  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <a href="/admin" className={styles.back}>
          返回後台
        </a>
        <strong>看板預覽</strong>
        <div className={styles.sources} role="group" aria-label="預覽內容來源">
          <button
            type="button"
            aria-pressed={source === "draft"}
            onClick={() => select("draft")}
          >
            草稿
          </button>
          <button
            type="button"
            aria-pressed={source === "published"}
            onClick={() => select("published")}
          >
            已發布
          </button>
        </div>
        <span className={styles.description} role="status">
          {source === "draft" ? "預覽已儲存草稿" : "預覽電視目前的發布內容"}
        </span>
      </header>
      <iframe
        className={styles.player}
        key={source}
        title="看板播放預覽"
        src={`/admin/preview?player=1&source=${source}`}
        allow="fullscreen"
      />
    </div>
  );
}
