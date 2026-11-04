# TITITA 大廳看板 CMS

獨立於 OneCloud 的內容管理與大廳播放系統。Next.js 16 / React 19 / TypeScript，正式資料使用獨立 MongoDB，媒體使用持久化目錄。

## 本機開始

```powershell
pnpm install --frozen-lockfile
pnpm run setup
pnpm build
pnpm start
```

也可使用 npm 執行 scripts：`npm run setup`、`npm run build`、`npm start`；套件安裝以版控的 pnpm-lock.yaml 為準。

- 展示版：http://127.0.0.1:3002/demo
- 獨立後台：http://127.0.0.1:3002/admin
- 電視配對／播放：http://127.0.0.1:3002/display
- 帳號為 `admin`；第一次 `setup` 會將隨機初始密碼寫入忽略版控的 `.env.local` 註解。妥善保存後可移除該註解，登入驗證使用 scrypt 雜湊。
- `setup` 不覆蓋既有設定；本機預設為模擬課表及檔案儲存。`/demo` 永遠是明確標示的模擬展示，時鐘從台灣當日 16:20 開始。
- 開發模式：`pnpm dev`。Service Worker 離線重載僅在正式建置啟用。

## 第一版已實作

- 全螢幕橫式看板、響應式手機預覽、課表分頁與狀態、海報輪播、公告輪播與緊急優先。
- 獨立管理員登入、8 小時 HttpOnly session、來源驗證、登入及配對節流。
- 公告新增／編輯／刪除草稿、排序、依台灣時區排程上下架。
- 海報上傳 PNG/JPEG/WebP（8 MB）、排序、停留秒數、排程上下架。
- 品牌文字、預設配色、教室 ID 篩選、隱藏已結束課程、LINE／報名 QR Code。
- 草稿儲存、完整預覽、立即發布、還原上一個發布版本、編輯衝突檢查。
- 螢幕一次性配對碼、啟用／停用、最後回報與內容版本。
- OneCloud 伺服器端唯讀 Client、8 秒逾時、30 秒同步、5 分鐘課表失效處理。
- 正式播放頁的離線重載備援、海報快取；不快取管理頁及 API 回應。
- Dockerfile、Compose、持久化媒體 Volume、健康檢查。

## 連接 OneCloud 與 Docker

詳見 [部署及串接文件](docs/DEPLOYMENT.md) 與 [API 契約](docs/ONECLOUD_API.md)。OneCloud 端新增的來源程式位於相鄰專案 `titita_onecloud/app/api/internal/signage/schedule/route.ts`；須先部署該版本並設定專屬金鑰。

## 驗證

```powershell
pnpm typecheck
pnpm test
# 先 pnpm build 與 pnpm start，再執行瀏覽器測試：
pnpm exec playwright test
```

瀏覽器測試只允許本機模擬設定，結束後還原 CMS 測試前狀態。測試結果與限制見 [驗證紀錄](docs/VERIFICATION.md)。

## 目前邊界

第一版採單一 CMS 實例、單一管理員及全螢幕共用播放清單。未實作自由拖曳排版、影片、直式專屬版型、每台設備不同清單、多人權限或整份草稿預約發布；公告與海報本身可設定生效時間。海報為公開看板素材，不應上傳私人內容。

正式 MongoDB、NAS Docker、實際 OneCloud 與電視需在部署環境完成驗收，本機驗證不代表已連接正式服務。

## 視覺素材

`public/concert-art.png` 為使用內建 imagegen 生成的兒童音樂插畫；生成規格見 [素材紀錄](design/ASSETS.md)。`design/lobby-display-concept.png` 是先前概念圖，實際程式畫面截圖見 `docs/screenshots/`。