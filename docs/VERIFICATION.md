# 第一版驗證與自我審查

日期：2026-11-04（Asia/Taipei）。交付範圍為本機可操作的獨立 CMS 第一版與 OneCloud 介接程式，未部署正式服務。

## 執行結果

| 檢查 | 結果 |
|---|---|
| CMS TypeScript：`node node_modules/typescript/bin/tsc --noEmit` | 通過 |
| CMS 正式建置：`node node_modules/next/dist/bin/next build` | 通過，最終建置無警告 |
| CMS Vitest：`node node_modules/vitest/vitest.mjs run` | 3 個檔案，8 個測試通過 |
| OneCloud TypeScript | 通過 |
| OneCloud signage 與 signage-route 測試 | 2 個檔案，5 個測試通過 |
| 正式 standalone 的 Playwright 操作流程 | 1 個端到端情境通過 |
| 桌面 1600×900、手機 390×844 版面 | 已截圖檢視，無橫向溢出 |
| 真正 Docker build／容器啟動 | 未執行：本機沒有 docker 指令 |
| 正式 OneCloud、MongoDB 寫入與現場電視 | 未執行：本次未連接正式環境 |

端到端情境包含：未登入拒絕、真實登入、儲存公告草稿、CSRF 拒絕、版本衝突、發布、一次性螢幕配對、重用配對碼拒絕、設備回報、版本還原、正式播放頁離線重載、停用設備拒絕、拒絕 SVG、成功上傳與讀取 PNG、QR Code、教室篩選儲存。測試結束會還原先前本機 CMS 狀態。

## 系統化審查 checklist

### 1. 檔案與呼叫鏈

- [x] 已確認，無問題：讀取登入／授權、store、validation、Client、所有 route、播放與編輯器程式。型別集中於 `types/index.ts:1`。
- [x] 已確認，無問題：OneCloud 僅新增看板 route、helper、測試及 `.env.example` 金鑰欄位；未修改既有 LINE OA 認證或業務 handler。

### 2. API 存取與驗證

- [x] 已確認，無問題：管理 API 每個 handler 驗證獨立管理員 session；寫入額外驗證 Origin，見 `lib/auth.ts:75`、`app/api/admin/content/route.ts:7`。
- [x] 已確認，無問題：登入／配對採獨立入口與節流，播放 API 要求已啟用設備的憑證，見 `app/api/pair/route.ts:13`、`app/api/display/route.ts:7`。
- [x] 已確認，無問題：OneCloud Internal API 以專屬服務金鑰授權取代使用者 session，符合既有 LINE OA 服務邊界，見相鄰專案 `lib/signage.ts:4`、`app/api/internal/signage/schedule/route.ts:12`。
- [x] 已確認，無問題：圖片、QR 與 health 為刻意公開的看板資源端點，不輸出管理資料；媒體檔名有白名單，見 `app/api/media/[name]/route.ts:4`。
- [x] 已確認，無問題：JSON 內容 Zod 驗證，無效內容回 400；配置不是 ObjectId CRUD，無 ObjectId 參數需驗證，見 `lib/validation.ts:10`、`lib/http.ts:10`。

### 3. 元件與表單

- [x] 已確認，無問題：可重複編輯的公告／海報以固定 id 作 key，使用受控欄位，不靠切換 initialData 重設 state，見 `components/Admin.tsx`。
- [x] 已確認，無問題：登入、配對與管理操作均在 finally 清除 loading，錯誤會顯示；不使用 form action，見 `components/LoginForm.tsx`、`components/Display.tsx`、`components/Admin.tsx`。
- [x] 已確認，無問題：教室篩選使用獨立輸入文字狀態，避免輸入逗號時立即正規化使分隔符消失，見 `components/Admin.tsx:90`。

### 4. 型別與業務正確性

- [x] 已確認，無問題：CMS 程式無 any；API Client 使用 Zod 檢查上游並去除非白名單欄位，見 `lib/main-system-client.ts:21`。
- [x] 已確認，無問題：草稿 contentRevision 與設備回報 revision 分開，設備輪詢不使編輯器產生虛假版本衝突，見 `app/api/admin/content/route.ts:31`。
- [x] 已確認，無問題：排程採台灣時區、到期即停止顯示；日期、時間及快取過期測試通過，見 `lib/time.ts:1`、`tests/core.test.ts`、`tests/integration-client.test.ts`。

### 5. 安全性

- [x] 已確認，無問題：無硬編碼正式金鑰或密碼，無殘留 debug log、dangerouslySetInnerHTML；本機憑證隨機生成且忽略版控，見 `scripts/setup.mjs:1`、`.gitignore:1`。
- [x] 已確認，無問題：管理員簽章金鑰與 OneCloud 服務金鑰分離；session 為 HttpOnly、SameSite Strict，正式預設 Secure，見 `lib/auth.ts:18`、`lib/auth.ts:61`。
- [x] 已確認，無問題：上傳限定大小與 PNG/JPEG/WebP 檔頭、禁止 SVG；網址只接受 http/https，見 `app/api/admin/upload/route.ts:7`、`lib/validation.ts:10`。
- [x] 已確認，無問題：OneCloud 不回傳學生 ID／出勤名單／備註等欄位；依業主要求保留所有原始課名（包括其中的學生姓名），見相鄰專案 `lib/signage.ts:31`。

### 6. 資料持久化與副作用

- [x] 已確認，無問題：正式資料透過 Mongoose、快取連線、lean 查詢與樂觀版本檢查；單一配置文件不需要 findByIdAndUpdate／ObjectId 軟刪除，見 `lib/store.ts:10`。
- [x] 已確認，無問題：檔案模式僅供本機模擬，序列化更新及原子替換已有測試，見 `lib/store.ts:33`、`tests/store.test.ts`。
- [x] 已確認，無問題：公告／海報從草稿移除後仍可由上一個發布快照還原；媒體不隨容器重建刪除，見 `app/api/admin/publish/route.ts:6`、`docker-compose.yml:1`。
- [x] 已確認，無問題：API Client 失敗不切換成假課表；過期與跨日課表清除，見 `lib/main-system-client.ts:69`、`components/Display.tsx:133`。
- [x] 已確認，無問題：離線備援不快取管理頁與 API JSON，見 `public/sw.js:1`；完全離線設備的撤銷需待重新連線，已在部署文件明列。

## 已修正的驗證問題

- Next.js 將本機 Request URL 正規化為 localhost，Origin 為 127.0.0.1 時誤擋：已以 APP_ORIGIN 或有效 Host 比對處理，跨站拒絕測試仍通過。
- 公告 textarea 增加明確無障礙名稱；瀏覽器測試以 textbox role 存取。
- 編輯器測試在直接 API 修改發布版本後先重新載入，再繼續新編輯情境；符合樂觀鎖的預期行為。
- 動態資料路徑導致建置追蹤整個專案：已將執行期資料目錄排除於 Turbopack tracing，最終建置無此警告。

## 截圖

- `screenshots/lobby-desktop.png`：實際桌面看板。
- `screenshots/lobby-mobile.png`：實際手機版面。
- `screenshots/admin-overview.png`：獨立 CMS 總覽。
- `screenshots/lobby-offline.png`：正式播放頁離線重新整理。

## 上線前剩餘驗收

- [ ] NAS 實際 Docker 建置、Volume 權限與反向代理 HTTPS。
- [ ] 獨立 MongoDB 帳號權限、資料保存與容器重建。
- [ ] 部署 OneCloud 新端點、設定專屬金鑰，核對真實取消／改期／教室資訊與團體課公開名稱。
- [ ] 現場電視觀看距離、瀏覽器自動啟動及重新開機測試。

以上是部署環境驗收，未在本機測試中冒充通過。