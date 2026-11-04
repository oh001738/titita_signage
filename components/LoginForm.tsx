"use client";
import { useState } from "react";
import { ArrowRight, Music2, LockKeyhole } from "lucide-react";
export function LoginForm() {
  const [form, setForm] = useState({ username: "admin", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.href = "/admin";
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗");
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-art">
        <div className="login-wordmark">
          <Music2 /> TITITA <span>SIGNAGE</span>
        </div>
        <div className="login-message">
          <p className="eyebrow">A LITTLE MUSIC, EVERY DAY.</p>
          <h1>
            讓每一次等待，
            <br />
            都有美好的旋律。
          </h1>
          <p>
            從一則公告到一場演出，
            <br />
            把教室裡的美好，分享給每個家庭。
          </p>
        </div>
        <img src="/concert-art.png" alt="孩子們一起演奏音樂的插畫" />
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="icon-tile">
            <LockKeyhole size={22} />
          </span>
          <p className="eyebrow">CONTENT STUDIO</p>
          <h2>歡迎回來</h2>
          <p>登入獨立看板管理，編排今天的音樂日常。</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="username">管理員帳號</label>
            <input
              id="username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <label htmlFor="password">密碼</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={isLoading}>
              {isLoading ? "登入中…" : "進入管理後台"}
              <ArrowRight size={18} />
            </button>
          </form>
          <a className="subtle-link" href="/demo">
            先看看大廳展示畫面 ↗
          </a>
          <small>獨立內容管理 · OneCloud 課表整合</small>
        </div>
      </section>
    </main>
  );
}
