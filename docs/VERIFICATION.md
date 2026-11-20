# 第一版驗證與自我審查

## 課表字體放大（2026-11-20）

底部公告標籤與走馬燈文字另行放大，文字本身也納入 ResizeObserver，讓滾動時間隨實際字寬重新計算。新增長公告在三種解析度下的檢查；公告與課表合計六項版面測試通過，正式 build 通過，已檢視 1080p 截圖。

放大課程／學生名稱、老師姓名、教室、狀態與時間；加深老師文字、調整欄寬並保留四列課表。正式 build 通過，新增 1920×1080、1280×720、390×844 三項瀏覽器版面檢查，確認老師姓名在列內、教室與狀態不重疊、頁面不橫向溢出，並檢視桌面截圖。

## 看板預覽入口與發布版本切換（2026-11-20）

- 後台「看板預覽」與完整預覽入口會先儲存草稿再開啟預覽，並處理新視窗阻擋及儲存失敗，不跳至固定範例。
- 預覽頁提供草稿／已發布切換，管理員可直接讀取發布快照，無需配對；尚未發布回 404，不將草稿當成已發布內容。首頁改為管理後台，`/demo` 保留獨立模擬範例。
- 預覽工具列在播放區外，共用正式看板的播放元件；切換來源與重新整理、桌面及手機寬度皆已驗證。
- Node.js 24 的正式 build、TypeScript、38 項單元測試與 15 個 Playwright 情境通過。新增 API 測試涵蓋預設草稿、發布快照、未發布、無效來源及管理員授權；新增瀏覽器情境涵蓋自動儲存、版本切換、不需配對及重新整理後保留來源。

## 榮耀時刻舞台效果與連播（2026-11-19）

- 新增聚光登場、三人榮耀揭幕與 CMS 播放設定，既有資料相容；同場可整場連播，或依完整頁分段並接續下一頁。
- 正式 `/display` 移除播放／海報按鈕與 CMS 入口，滑鼠停留不再暫停。減少動態偏好關閉動畫但不停止播放。
- 發布更新以最新內容開播；播放中內容變更、停用或到期會撤下。以穩定項目識別碼推進插播，前方項目到期不會使相簿跳本。
- 使用 Node.js 24.22.3 完成 TypeScript、正式 build 與 10 個 Vitest 檔案共 33 項測試。
- 正式建置的 Playwright 共 13 個情境通過：包含 10 項獲獎播放測試、後台新設定儲存／重載，以及既有登入、發布、配對、撤銷、離線重載與不同 NAS 位址情境。獲獎測試使用攔截 API 的模擬資料，不接觸正式 CMS。
- 已檢視 1600×900 桌面、390×844 手機及 1280×720 含照片／極長姓名獎項的截圖；正式播放沒有操作按鈕，文字與公告無遮擋。現場投影機的觀看距離與動畫流暢度仍需實機驗收。

## 第一版歷史紀錄

日期：2026-11-04（Asia/Taipei）。交付範圍為本機可操作的獨立 CMS 第一版與 OneCloud 介接程式，未部署正式服務。

## 不同區網位址配對修正（2026-11-04）

- 配對碼產生端驗證瀏覽器 Origin 與實際請求 Host、協定相符，允許播放器使用 NAS IP；後台登入及資料修改仍限制 APP_ORIGIN。
- 已執行 TypeScript、Vitest 9 項、正式 build，以及正式建置的 2 個 Playwright 情境；涵蓋後台與電視使用不同主機名稱、跨站拒絕及既有配對流程。
- 修正已在本機驗證；NAS 更新後仍需在 info-beamer 播放器上驗證。
## 螢幕配對流程更新（2026-11-04）

- 螢幕自行產生六位數配對碼，管理員在後台輸入；碼 10 分鐘有效，使用後立即失效。
- 既有 `screens` 記錄及其裝置 Cookie 保持相容；新的待配對記錄為可選欄位。
- 刪除撤銷憑證；停用保留原配對，啟用後恢復。成功配對後 Cookie 的有效期為 365 天，管理員 session 為 8 小時。
- 已執行 TypeScript、Vitest 8 項、正式 build，以及隔離測試資料的 Playwright 端到端測試，涵蓋顯示配對碼、管理員核准、過期／重用拒絕、已核准後避免覆寫憑證、停用／啟用、刪除撤銷與離線播放。
- 實際 NAS 與 info-beamer 播放器尚需更新後驗收；播放端 Persistent Profile 必須開啟以保留 Cookie。
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
