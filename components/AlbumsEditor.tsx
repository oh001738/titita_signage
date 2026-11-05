"use client";
import { useState } from "react";
import { createContentId } from "@/lib/content-id";
import type { ActivityAlbum, AlbumTrashItem } from "@/types";
async function uploadFile(file: File): Promise<string> {
  const data = new FormData();
  data.append("file", file);
  const response = await fetch("/api/admin/upload", {
    method: "POST",
    body: data,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "上傳失敗");
  return body.data.image as string;
}
async function makePlaybackImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const factor = Math.min(
      1,
      1920 / img.naturalWidth,
      1920 / img.naturalHeight,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * factor));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("無法處理照片");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.84),
    );
    if (!blob) throw new Error("無法產生播放圖片");
    return new File([blob], "playback.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
const isoDate = (v: string) =>
  v ? new Date(`${v}:00+08:00`).toISOString() : "";
const localDate = (v: string) =>
  v ? new Date(Date.parse(v) + 8 * 60 * 60_000).toISOString().slice(0, 16) : "";
export function AlbumsEditor({
  albums,
  trash,
  busy,
  onChange,
  onRestore,
  onPurge,
  onBusyChange,
}: {
  albums: ActivityAlbum[];
  trash: AlbumTrashItem[];
  busy: boolean;
  onChange: (fn: (items: ActivityAlbum[]) => ActivityAlbum[]) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [selectedOnly, setSelectedOnly] = useState<Record<string, boolean>>({});
  const change = (id: string, fn: (a: ActivityAlbum) => ActivityAlbum) =>
    onChange((items) => items.map((a) => (a.id === id ? fn(a) : a)));
  const add = () =>
    onChange((items) => [
      ...items,
      {
        id: createContentId(),
        title: "新活動相簿",
        date: "",
        description: "",
        enabled: false,
        startsAt: "",
        endsAt: "",
        duration: 8,
        batchSize: 3,
        fit: "contain",
        photos: [],
      },
    ]);
  async function upload(id: string, files: File[], ignored: number) {
    setUploading(true);
    onBusyChange(true);
    setError("");
    let failures = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`上傳 ${i + 1} / ${files.length}`);
        try {
          const original = await uploadFile(files[i]);
          let image = original;
          try {
            image = await uploadFile(await makePlaybackImage(files[i]));
          } catch {
            /* Original remains available if optimization fails. */
          }
          const photo = {
            id: createContentId(),
            image,
            original,
            caption: "",
            selected: true,
          };
          change(id, (a) => ({ ...a, photos: [...a.photos, photo] }));
        } catch {
          failures++;
        }
      }
      const messages = [];
      if (failures)
        messages.push(
          `${failures} 張照片上傳失敗，請確認格式及 8 MB 限制後重試。`,
        );
      if (ignored)
        messages.push(`${ignored} 張照片超過每本 100 張的上限，未上傳。`);
      if (messages.length) setError(messages.join(" "));
    } finally {
      setUploading(false);
      onBusyChange(false);
      setProgress("");
    }
  }
  const disabled = busy || uploading;
  return (
    <section className="editor-section album-editor">
      <div className="section-toolbar">
        <span>活動相簿 · {albums.length} 本</span>
        <a
          href="/admin/preview"
          target="_blank"
          rel="noreferrer"
          className="album-preview-link"
        >
          預覽已儲存草稿 ↗
        </a>
        <button
          className="secondary"
          disabled={disabled || albums.length >= 30}
          onClick={add}
        >
          ＋ 新增相簿
        </button>
      </div>
      <p>
        圖片在上傳後儲存在
        NAS；請先儲存草稿再開啟預覽，發布後才會更新螢幕。尚未儲存的新增照片刪除後不會進入回收站。請先確認照片公開播放的同意。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {progress && <p role="status">{progress}</p>}
      {albums.length === 0 && (
        <div className="admin-card empty-state">
          尚無相簿，新增相簿後可批次上傳活動照片。
        </div>
      )}
      {albums.map((a, index) => (
        <article className="admin-card editor-card" key={a.id}>
          <div className="editor-card-heading">
            <strong>{a.title || "新活動相簿"}</strong>
            <div className="item-actions">
              <button
                aria-label="相簿向上"
                disabled={disabled || index === 0}
                onClick={() =>
                  onChange((items) => {
                    const x = [...items];
                    [x[index - 1], x[index]] = [x[index], x[index - 1]];
                    return x;
                  })
                }
              >
                ↑
              </button>
              <button
                aria-label="相簿向下"
                disabled={disabled || index === albums.length - 1}
                onClick={() =>
                  onChange((items) => {
                    const x = [...items];
                    [x[index + 1], x[index]] = [x[index], x[index + 1]];
                    return x;
                  })
                }
              >
                ↓
              </button>
              <button
                disabled={disabled}
                onClick={() => {
                  if (
                    window.confirm(
                      `刪除「${a.title}」？共 ${a.photos.length} 張照片。儲存草稿後會移至回收站，發布後才會從看板移除。`,
                    )
                  )
                    onChange((items) => items.filter((x) => x.id !== a.id));
                }}
              >
                刪除相簿
              </button>
            </div>
          </div>
          <div className="form-grid">
            <label>
              活動名稱
              <input
                maxLength={80}
                value={a.title}
                onChange={(e) => {
                  const v = e.target.value;
                  change(a.id, (x) => ({ ...x, title: v }));
                }}
              />
            </label>
            <label>
              活動日期
              <input
                type="date"
                value={a.date}
                onChange={(e) => {
                  const v = e.target.value;
                  change(a.id, (x) => ({ ...x, date: v }));
                }}
              />
            </label>
          </div>
          <label>
            活動說明（選填）
            <input
              maxLength={160}
              value={a.description}
              onChange={(e) => {
                const v = e.target.value;
                change(a.id, (x) => ({ ...x, description: v }));
              }}
            />
          </label>
          <div className="form-grid">
            <label>
              上架時間（台灣）
              <input
                type="datetime-local"
                value={localDate(a.startsAt)}
                onChange={(e) => {
                  const v = isoDate(e.target.value);
                  change(a.id, (x) => ({ ...x, startsAt: v }));
                }}
              />
            </label>
            <label>
              下架時間（台灣）
              <input
                type="datetime-local"
                value={localDate(a.endsAt)}
                onChange={(e) => {
                  const v = isoDate(e.target.value);
                  change(a.id, (x) => ({ ...x, endsAt: v }));
                }}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              每張照片秒數
              <input
                type="number"
                min={5}
                max={60}
                value={a.duration}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  change(a.id, (x) => ({ ...x, duration: v }));
                }}
              />
            </label>
            <label>
              每次連續播放張數
              <input
                type="number"
                min={1}
                max={10}
                value={a.batchSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  change(a.id, (x) => ({ ...x, batchSize: v }));
                }}
              />
            </label>
            <label>
              照片顯示方式
              <select
                value={a.fit}
                onChange={(e) => {
                  const v = e.target.value as ActivityAlbum["fit"];
                  change(a.id, (x) => ({ ...x, fit: v }));
                }}
              >
                <option value="contain">完整顯示</option>
                <option value="cover">填滿畫面（可能裁切）</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={a.enabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  change(a.id, (x) => ({ ...x, enabled: v }));
                }}
              />
              啟用相簿
            </label>
          </div>
          <div className="section-toolbar">
            <span>
              照片 {a.photos.length} / 100 · 精選{" "}
              {a.photos.filter((p) => p.selected).length} 張
            </span>
            <label className="album-upload">
              ＋ 批次上傳照片
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                disabled={disabled || a.photos.length >= 100}
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  const files = chosen.slice(0, 100 - a.photos.length);
                  e.target.value = "";
                  if (files.length)
                    void upload(a.id, files, chosen.length - files.length);
                }}
              />
            </label>
          </div>
          <div className="album-photo-toolbar">
            <button
              className="secondary"
              disabled={disabled}
              onClick={() =>
                change(a.id, (x) => ({
                  ...x,
                  photos: x.photos.map((p) => ({ ...p, selected: true })),
                }))
              }
            >
              全部選取
            </button>
            <button
              className="secondary"
              disabled={disabled}
              onClick={() =>
                change(a.id, (x) => ({
                  ...x,
                  photos: x.photos.map((p) => ({ ...p, selected: false })),
                }))
              }
            >
              全部取消
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!selectedOnly[a.id]}
                onChange={(e) => {
                  const value = e.target.checked;
                  setSelectedOnly((current) => ({ ...current, [a.id]: value }));
                }}
              />
              只看已精選
            </label>
          </div>
          <div className="album-photo-grid">
            {a.photos.map((p, i) =>
              selectedOnly[a.id] && !p.selected ? null : (
                <div className="album-photo" key={p.id}>
                  <img src={p.image} alt={p.caption || "活動照片"} />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={(e) => {
                        const v = e.target.checked;
                        change(a.id, (x) => ({
                          ...x,
                          photos: x.photos.map((q) =>
                            q.id === p.id ? { ...q, selected: v } : q,
                          ),
                        }));
                      }}
                    />
                    看板播放
                  </label>
                  <input
                    aria-label="照片說明"
                    maxLength={80}
                    placeholder="照片說明（選填）"
                    value={p.caption}
                    onChange={(e) => {
                      const v = e.target.value;
                      change(a.id, (x) => ({
                        ...x,
                        photos: x.photos.map((q) =>
                          q.id === p.id ? { ...q, caption: v } : q,
                        ),
                      }));
                    }}
                  />
                  <a
                    href={p.original || p.image}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看原圖
                  </a>
                  <div className="album-photo-actions">
                    <button
                      disabled={disabled || i === 0}
                      aria-label="照片向前"
                      onClick={() =>
                        change(a.id, (x) => {
                          const photos = [...x.photos];
                          [photos[i - 1], photos[i]] = [
                            photos[i],
                            photos[i - 1],
                          ];
                          return { ...x, photos };
                        })
                      }
                    >
                      ←
                    </button>
                    <button
                      disabled={disabled || i === a.photos.length - 1}
                      aria-label="照片向後"
                      onClick={() =>
                        change(a.id, (x) => {
                          const photos = [...x.photos];
                          [photos[i + 1], photos[i]] = [
                            photos[i],
                            photos[i + 1],
                          ];
                          return { ...x, photos };
                        })
                      }
                    >
                      →
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => {
                        if (
                          window.confirm(
                            "刪除照片？儲存草稿後會移至回收站，發布後才從看板移除。",
                          )
                        )
                          change(a.id, (x) => ({
                            ...x,
                            photos: x.photos.filter((q) => q.id !== p.id),
                          }));
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </article>
      ))}
      <section className="admin-card editor-card">
        <h2>回收站</h2>
        <p>刪除並儲存草稿後可在此還原，保留 30 天；還原後仍需發布。</p>
        {trash.length === 0 && <p>回收站目前沒有項目。</p>}
        {trash.map((item) => (
          <div className="album-trash-row" key={item.id}>
            <span>
              {item.kind === "album"
                ? `相簿：${item.album.title}`
                : `照片：${item.photo.caption || "未命名"}（${item.albumTitle}）`}
              <small>
                保留至{" "}
                {new Date(item.expiresAt).toLocaleDateString("zh-TW", {
                  timeZone: "Asia/Taipei",
                })}
              </small>
            </span>
            <button
              className="secondary"
              disabled={disabled || Date.parse(item.expiresAt) <= Date.now()}
              onClick={() => onRestore(item.id)}
            >
              還原
            </button>
            <button
              className="secondary"
              disabled={disabled}
              onClick={() => {
                if (
                  window.confirm(
                    "永久刪除這個回收站項目？若圖片仍被已發布或還原版本使用，檔案會保留到不再被使用。",
                  )
                )
                  onPurge(item.id);
              }}
            >
              永久刪除
            </button>
          </div>
        ))}
      </section>
    </section>
  );
}
