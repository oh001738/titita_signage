"use client";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Bell,
  Images,
  Settings2,
  Monitor,
  Music2,
  ArrowUpRight,
  Save,
  Send,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  LogOut,
  RotateCcw,
  CheckCircle2,
  Radio,
  Upload,
  Eye,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import type { Content, Publication, Screen } from "@/types";
type Section =
  "overview" | "announcements" | "posters" | "settings" | "screens";
interface EditorState {
  revision: number;
  draft: Content;
  published: Publication | null;
  previous: Publication | null;
}
const navigation = [
  { id: "overview", label: "總覽", icon: LayoutDashboard },
  { id: "announcements", label: "公告管理", icon: Bell },
  { id: "posters", label: "海報輪播", icon: Images },
  { id: "settings", label: "畫面與課表", icon: Settings2 },
  { id: "screens", label: "螢幕管理", icon: Monitor },
] as const;
async function api<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "操作失敗");
  return body.data as T;
}
function localDate(value: string) {
  return value
    ? new Date(Date.parse(value) + 8 * 60 * 60_000).toISOString().slice(0, 16)
    : "";
}
function isoDate(value: string) {
  return value ? new Date(`${value}:00+08:00`).toISOString() : "";
}
function WindowFields({
  value,
  onChange,
}: {
  value: { startsAt: string; endsAt: string };
  onChange: (key: "startsAt" | "endsAt", value: string) => void;
}) {
  return (
    <div className="form-grid">
      <label>
        上架時間（台灣）
        <input
          type="datetime-local"
          value={localDate(value.startsAt)}
          onChange={(e) => onChange("startsAt", isoDate(e.target.value))}
        />
      </label>
      <label>
        下架時間（留空為持續顯示）
        <input
          type="datetime-local"
          value={localDate(value.endsAt)}
          onChange={(e) => onChange("endsAt", isoDate(e.target.value))}
        />
      </label>
    </div>
  );
}
export function Admin() {
  const [roomText, setRoomText] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [state, setState] = useState<EditorState | null>(null);
  const [form, setForm] = useState<Content | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [name, setName] = useState("大廳電視");
  const [pairCode, setPairCode] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  async function load() {
    const data = await api<EditorState>("/api/admin/content");
    setState(data);
    setForm(data.draft);
    setRoomText(data.draft.roomIds.join(","));
    setIsDirty(false);
  }
  async function loadScreens() {
    setScreens(await api<Screen[]>("/api/admin/screens"));
  }
  useEffect(() => {
    void Promise.all([load(), loadScreens()]).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (section !== "screens") return;
    const timer = setInterval(() => {
      void loadScreens().catch(() => undefined);
    }, 30000);
    return () => clearInterval(timer);
  }, [section]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [isDirty]);
  function update<K extends keyof Content>(key: K, value: Content[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setIsDirty(true);
    setMessage("");
  }
  async function run(action: () => Promise<void>) {
    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setIsLoading(false);
    }
  }
  async function save(): Promise<EditorState> {
    if (!form || !state) throw new Error("內容尚未載入");
    const data = await api<EditorState>("/api/admin/content", "PUT", {
      revision: state.revision,
      content: form,
    });
    setState(data);
    setForm(data.draft);
    setIsDirty(false);
    return data;
  }
  const published = state?.published;
  if (!form || !state)
    return (
      <main className="loading-page">
        <Music2 />
        <p>{error || "正在準備你的內容工作室…"}</p>
        <button onClick={() => window.location.reload()}>重新載入</button>
      </main>
    );
  function move<T>(items: T[], index: number, direction: number): T[] {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="studio-brand" href="/admin">
          <Music2 size={32} />
          <div>
            TITITA<span>CONTENT STUDIO</span>
          </div>
        </a>
        <p className="sidebar-caption">大廳看板管理</p>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "selected" : ""}
              onClick={() => setSection(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {section === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Radio size={18} />
            <strong>每個美好，都值得被看見。</strong>
            <p>
              把教室的日常，
              <br />
              分享給每一個家庭。
            </p>
          </div>
          <a href="/demo" target="_blank" rel="noreferrer">
            展示畫面 <ArrowUpRight size={16} />
          </a>
          <button
            onClick={() =>
              void run(async () => {
                await api("/api/auth/logout", "POST");
                window.location.href = "/login";
              })
            }
          >
            <LogOut size={16} />
            登出管理後台
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <span>
            工作室{" "}
            <span className="crumb">
              / {navigation.find((n) => n.id === section)?.label}
            </span>
          </span>
          <div>
            <span className={`status-dot ${published ? "green" : ""}`} />
            {published ? `已發布 v${published.version}` : "尚未發布"}
            <span className="admin-avatar">T</span>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin-page-heading">
            <div>
              <p className="eyebrow">YOUR LOBBY, BEAUTIFULLY CURATED.</p>
              <h1>
                {section === "overview"
                  ? "今天，也讓美好被看見。"
                  : navigation.find((n) => n.id === section)?.label}
              </h1>
              <p>
                {section === "overview"
                  ? "編排內容、連結家庭，讓大廳成為音樂日常的起點。"
                  : "所有變更先儲存為草稿，確認預覽後再發布到螢幕。"}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                disabled={isLoading}
                onClick={() =>
                  void run(async () => {
                    await save();
                    setMessage("草稿已儲存");
                  })
                }
              >
                <Save size={16} />
                儲存草稿{isDirty ? " *" : ""}
              </button>
              <button
                className="primary"
                disabled={isLoading}
                onClick={() =>
                  void run(async () => {
                    const latest = await save();
                    await api("/api/admin/publish", "POST", {
                      action: "publish",
                      revision: latest.revision,
                    });
                    await load();
                    setMessage("已發布，螢幕會在 30 秒內同步");
                  })
                }
              >
                <Send size={16} />
                {isLoading ? "處理中…" : "發布到螢幕"}
              </button>
            </div>
          </div>
          {(error || message) && (
            <div
              className={error ? "error feedback" : "success feedback"}
              role={error ? "alert" : "status"}
            >
              {error || message}
              {error.includes("重新載入") && (
                <button onClick={() => void run(load)}>重新載入</button>
              )}
            </div>
          )}
          {section === "overview" && (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <span className="stat-icon peach">
                    <Bell size={20} />
                  </span>
                  <div>
                    <span>公告內容</span>
                    <strong>
                      {form.announcements.length}
                      <small>則</small>
                    </strong>
                  </div>
                  <span className="stat-foot">依上架排程自動顯示</span>
                </div>
                <div className="stat-card">
                  <span className="stat-icon sage">
                    <Images size={20} />
                  </span>
                  <div>
                    <span>輪播海報</span>
                    <strong>
                      {form.posters.length}
                      <small>張</small>
                    </strong>
                  </div>
                  <span className="stat-foot">為每個活動留一個位置</span>
                </div>
                <div className="stat-card">
                  <span className="stat-icon yellow">
                    <Monitor size={20} />
                  </span>
                  <div>
                    <span>已配對螢幕</span>
                    <strong>
                      {screens.filter((s) => s.lastSeen).length}
                      <small>/ {screens.length} 台</small>
                    </strong>
                  </div>
                  <span className="stat-foot">前往螢幕管理查看連線狀態</span>
                </div>
              </div>
              <div className="overview-grid">
                <section className="admin-card preview-card">
                  <div className="card-heading">
                    <div>
                      <p className="eyebrow">LOBBY DISPLAY</p>
                      <h2>大廳的今日風景</h2>
                    </div>
                    <span className="tag">草稿預覽</span>
                  </div>
                  <div className="mini-display">
                    <div className="mini-header">
                      <Music2 size={19} />
                      <b>{form.schoolName}</b>
                      <span>16:20</span>
                    </div>
                    <div className="mini-body">
                      <div>
                        <h3>今日課程</h3>
                        {["鋼琴個別課", "兒童音樂班", "小提琴個別課"].map(
                          (text, i) => (
                            <div className="mini-row" key={text}>
                              <span>{16 + i}:00</span>
                              <b>{text}</b>
                              <small>{String.fromCharCode(65 + i)} 教室</small>
                            </div>
                          ),
                        )}
                        <p>{form.welcome}</p>
                      </div>
                      <div className="mini-poster">
                        <img
                          src={form.posters[0]?.image || "/concert-art.png"}
                          alt="海報示意"
                        />
                        <strong>
                          {form.posters[0]?.title || "音樂的日常"}
                        </strong>
                      </div>
                    </div>
                    <div className="mini-footer">
                      {form.announcements[0]?.body || "歡迎來到音樂的日常"}
                    </div>
                  </div>
                  <div className="preview-card-bottom">
                    <span>縮圖使用模擬課程；完整預覽會讀取草稿與課表。</span>
                    <button
                      className="text-button"
                      disabled={isLoading}
                      onClick={() =>
                        void run(async () => {
                          await save();
                          window.open("/admin/preview", "_blank", "noopener");
                        })
                      }
                    >
                      開啟完整預覽 <ArrowUpRight size={16} />
                    </button>
                  </div>
                </section>
                <aside className="admin-card publish-card">
                  <span className="icon-tile">
                    <Send size={22} />
                  </span>
                  <h2>準備好分享了嗎？</h2>
                  <p>
                    先儲存草稿，再預覽畫面。
                    <br />
                    確認內容後，一鍵發布到大廳。
                  </p>
                  <div className="publish-info">
                    <span>目前發布版本</span>
                    <strong>
                      {published ? `Version ${published.version}` : "尚未發布"}
                    </strong>
                    <small>
                      {published
                        ? new Date(published.publishedAt).toLocaleString(
                            "zh-TW",
                            { timeZone: "Asia/Taipei" },
                          )
                        : "第一次發布，從這裡開始。"}
                    </small>
                  </div>
                  <button
                    className="secondary"
                    disabled={!state.previous || isLoading}
                    onClick={() =>
                      void run(async () => {
                        await api("/api/admin/publish", "POST", {
                          action: "rollback",
                          revision: state.revision,
                        });
                        await load();
                        setMessage("已還原上一個發布版本；草稿保留");
                      })
                    }
                  >
                    <RotateCcw size={16} />
                    還原上一個發布版本
                  </button>
                  <div className="tip">
                    <CheckCircle2 size={17} />
                    <span>
                      發布內容與草稿分開保存，編輯期間螢幕持續播放已發布版本。
                    </span>
                  </div>
                </aside>
              </div>
              <div className="quick-links">
                <button onClick={() => setSection("announcements")}>
                  <Bell />
                  <div>
                    <strong>新增一則公告</strong>
                    <span>讓家長掌握最新消息</span>
                  </div>
                  <ArrowUpRight />
                </button>
                <button onClick={() => setSection("posters")}>
                  <Images />
                  <div>
                    <strong>更新活動海報</strong>
                    <span>讓下一場演出被看見</span>
                  </div>
                  <ArrowUpRight />
                </button>
                <button onClick={() => setSection("screens")}>
                  <Monitor />
                  <div>
                    <strong>連接大廳螢幕</strong>
                    <span>讓美好開始播放</span>
                  </div>
                  <ArrowUpRight />
                </button>
              </div>
            </>
          )}
          {section === "announcements" && (
            <section className="editor-section">
              <div className="section-toolbar">
                <span>
                  <FileText size={18} /> {form.announcements.length} 則公告 ·
                  最上方優先顯示
                </span>
                <button
                  className="secondary"
                  onClick={() =>
                    update("announcements", [
                      ...form.announcements,
                      {
                        id: crypto.randomUUID(),
                        title: "教室公告",
                        body: "",
                        priority: "normal",
                        startsAt: "",
                        endsAt: "",
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  新增公告
                </button>
              </div>
              {form.announcements.map((item, index) => (
                <article className="admin-card editor-card" key={item.id}>
                  <div className="editor-card-heading">
                    <span className="item-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong>{item.title || "新公告"}</strong>
                    <div className="item-actions">
                      <button
                        aria-label="公告向上"
                        disabled={index === 0}
                        onClick={() =>
                          update(
                            "announcements",
                            move(form.announcements, index, -1),
                          )
                        }
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        aria-label="公告向下"
                        disabled={index === form.announcements.length - 1}
                        onClick={() =>
                          update(
                            "announcements",
                            move(form.announcements, index, 1),
                          )
                        }
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        aria-label="刪除公告草稿"
                        onClick={() =>
                          update(
                            "announcements",
                            form.announcements.filter((a) => a.id !== item.id),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label>
                      公告標題
                      <input
                        maxLength={40}
                        value={item.title}
                        onChange={(e) =>
                          update(
                            "announcements",
                            form.announcements.map((a) =>
                              a.id === item.id
                                ? { ...a, title: e.target.value }
                                : a,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      顯示優先程度
                      <select
                        value={item.priority}
                        onChange={(e) =>
                          update(
                            "announcements",
                            form.announcements.map((a) =>
                              a.id === item.id
                                ? {
                                    ...a,
                                    priority: e.target.value as
                                      "normal" | "urgent",
                                  }
                                : a,
                            ),
                          )
                        }
                      >
                        <option value="normal">一般公告</option>
                        <option value="urgent">緊急公告・優先顯示</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    公告內容
                    <textarea
                      aria-label="公告內容"
                      rows={3}
                      maxLength={240}
                      value={item.body}
                      onChange={(e) =>
                        update(
                          "announcements",
                          form.announcements.map((a) =>
                            a.id === item.id
                              ? { ...a, body: e.target.value }
                              : a,
                          ),
                        )
                      }
                    />
                  </label>
                  <WindowFields
                    value={item}
                    onChange={(key, value) =>
                      update(
                        "announcements",
                        form.announcements.map((a) =>
                          a.id === item.id ? { ...a, [key]: value } : a,
                        ),
                      )
                    }
                  />
                </article>
              ))}
              {!form.announcements.length && (
                <div className="admin-card empty-state">
                  目前沒有公告，新增一則分享教室日常。
                </div>
              )}
            </section>
          )}
          {section === "posters" && (
            <section className="editor-section">
              <div className="section-toolbar">
                <span>
                  <Images size={18} /> {form.posters.length} 張海報 ·
                  依排列順序輪播
                </span>
                <button
                  className="secondary"
                  onClick={() =>
                    update("posters", [
                      ...form.posters,
                      {
                        id: crypto.randomUUID(),
                        title: "新的音樂活動",
                        subtitle: "",
                        image: "/concert-art.png",
                        duration: 15,
                        startsAt: "",
                        endsAt: "",
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  新增海報
                </button>
              </div>
              {form.posters.map((item, index) => (
                <article className="admin-card poster-editor" key={item.id}>
                  <div className="poster-editor-art">
                    <img src={item.image} alt={item.title} />
                    <label className="upload-button">
                      <Upload size={16} />
                      更換圖片
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={isLoading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void run(async () => {
                            const data = new FormData();
                            data.append("file", file);
                            const response = await fetch("/api/admin/upload", {
                              method: "POST",
                              body: data,
                            });
                            const body = await response.json();
                            if (!response.ok) throw new Error(body.error);
                            update(
                              "posters",
                              form.posters.map((p) =>
                                p.id === item.id
                                  ? { ...p, image: body.data.image }
                                  : p,
                              ),
                            );
                            setMessage("圖片已上傳，請儲存草稿");
                          });
                        }}
                      />
                    </label>
                    <small>PNG / JPEG / WebP，最大 8 MB</small>
                  </div>
                  <div className="poster-editor-fields">
                    <div className="editor-card-heading">
                      <span className="item-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <strong>海報內容</strong>
                      <div className="item-actions">
                        <button
                          aria-label="海報向上"
                          disabled={index === 0}
                          onClick={() =>
                            update("posters", move(form.posters, index, -1))
                          }
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          aria-label="海報向下"
                          disabled={index === form.posters.length - 1}
                          onClick={() =>
                            update("posters", move(form.posters, index, 1))
                          }
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          aria-label="刪除海報草稿"
                          onClick={() =>
                            update(
                              "posters",
                              form.posters.filter((p) => p.id !== item.id),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <label>
                      活動標題
                      <input
                        maxLength={50}
                        value={item.title}
                        onChange={(e) =>
                          update(
                            "posters",
                            form.posters.map((p) =>
                              p.id === item.id
                                ? { ...p, title: e.target.value }
                                : p,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        副標題
                        <input
                          maxLength={80}
                          value={item.subtitle}
                          onChange={(e) =>
                            update(
                              "posters",
                              form.posters.map((p) =>
                                p.id === item.id
                                  ? { ...p, subtitle: e.target.value }
                                  : p,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        停留秒數（8–120）
                        <input
                          type="number"
                          min={8}
                          max={120}
                          value={item.duration}
                          onChange={(e) =>
                            update(
                              "posters",
                              form.posters.map((p) =>
                                p.id === item.id
                                  ? { ...p, duration: Number(e.target.value) }
                                  : p,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <WindowFields
                      value={item}
                      onChange={(key, value) =>
                        update(
                          "posters",
                          form.posters.map((p) =>
                            p.id === item.id ? { ...p, [key]: value } : p,
                          ),
                        )
                      }
                    />
                  </div>
                </article>
              ))}
            </section>
          )}
          {section === "settings" && (
            <div className="settings-grid">
              <section className="admin-card editor-card">
                <div className="card-heading">
                  <h2>品牌與畫面</h2>
                  <Music2 />
                </div>
                <label>
                  品牌名稱
                  <input
                    value={form.schoolName}
                    maxLength={40}
                    onChange={(e) => update("schoolName", e.target.value)}
                  />
                </label>
                <label>
                  歡迎文字
                  <input
                    value={form.welcome}
                    maxLength={50}
                    onChange={(e) => update("welcome", e.target.value)}
                  />
                </label>
                <label>
                  課表下方提醒
                  <input
                    value={form.footer}
                    maxLength={120}
                    onChange={(e) => update("footer", e.target.value)}
                  />
                </label>
                <label>
                  版面配色
                  <select
                    value={form.theme}
                    onChange={(e) =>
                      update("theme", e.target.value as "cream" | "mint")
                    }
                  >
                    <option value="cream">奶油白 × 暖橘</option>
                    <option value="mint">薄荷綠 × 暖橘</option>
                  </select>
                </label>
              </section>
              <section className="admin-card editor-card">
                <div className="card-heading">
                  <h2>LINE 與課表</h2>
                  <LinkIcon />
                </div>
                <label>
                  LINE 或活動報名連結
                  <input
                    type="url"
                    value={form.lineUrl}
                    placeholder="https://line.me/…"
                    onChange={(e) => update("lineUrl", e.target.value)}
                  />
                </label>
                <p className="field-hint">
                  填入網址後，播放頁自動產生可掃描 QR Code。
                </p>
                <label>
                  QR Code 說明
                  <input
                    value={form.qrLabel}
                    maxLength={50}
                    onChange={(e) => update("qrLabel", e.target.value)}
                  />
                </label>
                <label>
                  指定教室 ID（逗號分隔，留空顯示全部）
                  <input
                    value={roomText}
                    onChange={(e) => {
                      setRoomText(e.target.value);
                      update(
                        "roomIds",
                        e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      );
                    }}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.hideEnded}
                    onChange={(e) => update("hideEnded", e.target.checked)}
                  />
                  隱藏已結束課程
                </label>
                <div className="tip">
                  <Eye size={18} />
                  <span>
                    課表由 OneCloud 唯讀 API
                    同步；金鑰只在伺服器設定，不在此頁顯示。
                  </span>
                </div>
              </section>
            </div>
          )}
          {section === "screens" && (
            <div className="screens-layout">
              <section className="admin-card editor-card">
                <h2>連接一台螢幕</h2>
                <p className="muted">
                  建立配對碼後，在電視瀏覽器開啟{" "}
                  <a href="/display" target="_blank" rel="noreferrer">
                    /display
                  </a>
                  ，輸入配對碼。
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const code = await api<{
                        code: string;
                        expiresAt: string;
                      }>("/api/admin/screens", "POST", { name });
                      setPairCode(code);
                      await loadScreens();
                    });
                  }}
                >
                  <label>
                    螢幕名稱
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                      required
                    />
                  </label>
                  <button className="primary" disabled={isLoading}>
                    <Plus size={16} />
                    產生配對碼
                  </button>
                </form>
                {pairCode && (
                  <div className="pair-code">
                    <span>一次性配對碼</span>
                    <strong>{pairCode.code}</strong>
                    <small>
                      有效至{" "}
                      {new Date(pairCode.expiresAt).toLocaleTimeString(
                        "zh-TW",
                        { timeZone: "Asia/Taipei" },
                      )}
                      （台灣時間）
                    </small>
                  </div>
                )}
              </section>
              <section className="admin-card editor-card">
                <div className="card-heading">
                  <h2>螢幕狀態</h2>
                  <button
                    className="text-button"
                    onClick={() => void run(loadScreens)}
                  >
                    重新整理
                  </button>
                </div>
                {screens.map((screen) => (
                  <div className="screen-item" key={screen.id}>
                    <span className="icon-tile">
                      <Monitor size={22} />
                    </span>
                    <div>
                      <strong>{screen.name}</strong>
                      <p>
                        {!screen.enabled
                          ? "已停用"
                          : !screen.lastSeen
                            ? "等待配對或連線"
                            : Date.now() - Date.parse(screen.lastSeen) < 90_000
                              ? "最近有連線"
                              : "連線逾時"}
                      </p>
                      <small>
                        內容版本 {screen.contentVersion ?? "—"} · 最後回報{" "}
                        {screen.lastSeen
                          ? new Date(screen.lastSeen).toLocaleString("zh-TW", {
                              timeZone: "Asia/Taipei",
                            })
                          : "尚無回報"}
                      </small>
                    </div>
                    <button
                      className="secondary"
                      disabled={isLoading}
                      onClick={() =>
                        void run(async () => {
                          await api("/api/admin/screens", "PATCH", {
                            id: screen.id,
                            enabled: !screen.enabled,
                          });
                          await loadScreens();
                        })
                      }
                    >
                      {screen.enabled ? "停用" : "啟用"}
                    </button>
                  </div>
                ))}
                {!screens.length && (
                  <div className="empty-state">
                    尚未連接螢幕，讓第一台看板開始播放。
                  </div>
                )}
              </section>
            </div>
          )}
          <footer className="admin-footer">
            <span>TITITA CONTENT STUDIO</span>
            <span>為每一天，譜一點美好。</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
