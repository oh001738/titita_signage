"use client";
import { useState } from "react";
import { createContentId } from "@/lib/content-id";
import type { Award } from "@/types";

const localDate = (v: string) =>
  v ? new Date(Date.parse(v) + 8 * 60 * 60_000).toISOString().slice(0, 16) : "";
const isoDate = (v: string) =>
  v ? new Date(`${v}:00+08:00`).toISOString() : "";
const recipient = () => ({
  id: createContentId(),
  name: "",
  category: "",
  prize: "",
});
export function AwardsEditor({
  awards,
  onChange,
}: {
  awards: Award[];
  onChange: (update: (awards: Award[]) => Award[]) => void;
}) {
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const change = (id: string, fn: (item: Award) => Award) =>
    onChange((items) =>
      items.map((item) => (item.id === id ? fn(item) : item)),
    );
  const add = () =>
    onChange((items) => [
      ...items,
      {
        id: createContentId(),
        layout: "individual",
        competition: "",
        sharedPrize: "",
        image: "",
        enabled: false,
        duration: 15,
        startsAt: "",
        endsAt: "",
        recipients: [recipient()],
      },
    ]);
  async function upload(id: string, file: File) {
    setError("");
    setUploading(id);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: data,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "圖片上傳失敗");
      change(id, (item) => ({ ...item, image: body.data.image }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "圖片上傳失敗");
    } finally {
      setUploading("");
    }
  }
  return (
    <section className="editor-section awards-editor">
      <div className="section-toolbar">
        <span>榮耀時刻 · {awards.length} 筆</span>
        <button
          className="secondary"
          onClick={add}
          disabled={awards.length >= 30}
        >
          ＋ 新增獲獎紀錄
        </button>
      </div>
      <p>請於公開姓名及照片前確認已取得家長同意。變更需儲存草稿並發布。</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {awards.length === 0 && (
        <div className="admin-card empty-state">
          尚無獲獎紀錄，新增後可在課表之間播放。
        </div>
      )}
      {awards.map((a, index) => (
        <article className="admin-card editor-card" key={a.id}>
          <div className="editor-card-heading">
            <strong>獲獎紀錄 {index + 1}</strong>
            <div className="item-actions">
              <button
                aria-label="獲獎紀錄向上"
                disabled={index === 0}
                onClick={() =>
                  onChange((all) => {
                    const copy = [...all];
                    [copy[index - 1], copy[index]] = [
                      copy[index],
                      copy[index - 1],
                    ];
                    return copy;
                  })
                }
              >
                ↑
              </button>
              <button
                aria-label="獲獎紀錄向下"
                disabled={index === awards.length - 1}
                onClick={() =>
                  onChange((all) => {
                    const copy = [...all];
                    [copy[index + 1], copy[index]] = [
                      copy[index],
                      copy[index + 1],
                    ];
                    return copy;
                  })
                }
              >
                ↓
              </button>
              <button
                aria-label="刪除獲獎紀錄"
                onClick={() =>
                  onChange((all) => all.filter((item) => item.id !== a.id))
                }
              >
                刪除
              </button>
            </div>
          </div>
          <div className="form-grid">
            <label>
              呈現版型
              <select
                value={a.layout}
                onChange={(e) => {
                  const layout = e.target.value as Award["layout"];
                  change(a.id, (item) => ({
                    ...item,
                    layout,
                  }));
                }}
              >
                <option value="individual">個人獲獎</option>
                <option value="group">團體同獎</option>
                <option value="competition">同場多獎</option>
              </select>
            </label>
            <label>
              比賽名稱
              <input
                maxLength={80}
                value={a.competition}
                onChange={(e) =>
                  change(a.id, (item) => ({
                    ...item,
                    competition: e.target.value,
                  }))
                }
              />
            </label>
          </div>
          {a.layout !== "competition" && (
            <label>
              獎項（可包含組別）
              <input
                maxLength={80}
                value={a.sharedPrize}
                onChange={(e) =>
                  change(a.id, (item) => ({
                    ...item,
                    sharedPrize: e.target.value,
                  }))
                }
              />
            </label>
          )}
          <div className="award-recipient-heading">
            <strong>得獎學生</strong>
            {a.layout !== "individual" && (
              <button
                className="secondary"
                disabled={a.recipients.length >= 60}
                onClick={() =>
                  change(a.id, (item) => ({
                    ...item,
                    recipients: [...item.recipients, recipient()],
                  }))
                }
              >
                ＋ 新增學生
              </button>
            )}
          </div>
          {a.recipients.map((person) => (
            <div className="award-recipient" key={person.id}>
              <label>
                學生顯示名稱
                <input
                  maxLength={30}
                  value={person.name}
                  onChange={(e) =>
                    change(a.id, (item) => ({
                      ...item,
                      recipients: item.recipients.map((r) =>
                        r.id === person.id ? { ...r, name: e.target.value } : r,
                      ),
                    }))
                  }
                />
              </label>
              {a.layout === "competition" && (
                <>
                  <label>
                    組別
                    <input
                      maxLength={50}
                      value={person.category}
                      onChange={(e) =>
                        change(a.id, (item) => ({
                          ...item,
                          recipients: item.recipients.map((r) =>
                            r.id === person.id
                              ? { ...r, category: e.target.value }
                              : r,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    獎項
                    <input
                      maxLength={80}
                      value={person.prize}
                      onChange={(e) =>
                        change(a.id, (item) => ({
                          ...item,
                          recipients: item.recipients.map((r) =>
                            r.id === person.id
                              ? { ...r, prize: e.target.value }
                              : r,
                          ),
                        }))
                      }
                    />
                  </label>
                </>
              )}
              {a.recipients.length > 1 && (
                <button
                  className="secondary"
                  aria-label={`移除${person.name || "學生"}`}
                  onClick={() =>
                    change(a.id, (item) => ({
                      ...item,
                      recipients: item.recipients.filter(
                        (r) => r.id !== person.id,
                      ),
                    }))
                  }
                >
                  移除
                </button>
              )}
            </div>
          ))}
          <label>
            照片（選填，PNG / JPEG / WebP，最大 8 MB）
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!!uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(a.id, file);
                e.target.value = "";
              }}
            />
          </label>
          {uploading === a.id && <p>圖片上傳中…</p>}
          {a.image && (
            <div className="award-upload-preview">
              <img src={a.image} alt="獲獎照片預覽" />
              <button
                className="secondary"
                onClick={() => change(a.id, (item) => ({ ...item, image: "" }))}
              >
                移除照片
              </button>
            </div>
          )}
          <div className="form-grid">
            <label>
              每頁播放秒數（10–60）
              <input
                type="number"
                min={10}
                max={60}
                value={a.duration}
                onChange={(e) =>
                  change(a.id, (item) => ({
                    ...item,
                    duration: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={a.enabled}
                onChange={(e) =>
                  change(a.id, (item) => ({
                    ...item,
                    enabled: e.target.checked,
                  }))
                }
              />
              啟用播放
            </label>
          </div>
          <div className="form-grid">
            <label>
              上架時間（台灣）
              <input
                type="datetime-local"
                value={localDate(a.startsAt)}
                onChange={(e) =>
                  change(a.id, (item) => ({
                    ...item,
                    startsAt: isoDate(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              下架時間（台灣）
              <input
                type="datetime-local"
                value={localDate(a.endsAt)}
                onChange={(e) =>
                  change(a.id, (item) => ({
                    ...item,
                    endsAt: isoDate(e.target.value),
                  }))
                }
              />
            </label>
          </div>
        </article>
      ))}
    </section>
  );
}
