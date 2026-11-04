# 部署與操作

## 服務分界

沿用 LINE OA 的 server-to-server 介接概念：`MAIN_SYSTEM_URL` + `X-Internal-Key` + 有界逾時 + `{data,error}` 回應。CMS 不直接連接教務資料庫，也不使用 LINE OA 的金鑰、帳號或 session。

CMS 管理後台及播放頁由 `titita-signage` 單一容器提供；透過外部 Docker network `titita_onecloud` 存取 `titita-onecloud:3000`。

## 正式環境設定

1. OneCloud 部署新增的 `app/api/internal/signage/schedule/route.ts`、`lib/signage.ts`，在 OneCloud 設定新的 `SIGNAGE_API_KEY`（至少 32 個隨機字元）。不要沿用 LINE OA 的 `INTERNAL_API_KEY`。未設定時新端點回 503，既有端點不受影響。
2. CMS 先執行 `pnpm run setup` 產生隨機初始帳密雜湊與獨立 session secret；妥善保存登入密碼。
3. 修改 CMS `.env.local`：

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<setup 產生的 scrypt salt:hash>
SESSION_SECRET=<CMS 專屬、至少 32 字元的隨機值>
APP_ORIGIN=https://你的看板網域
COOKIE_SECURE=true
CMS_STORAGE=mongo
MONGODB_URI=<獨立 titita_signage 資料庫連線字串>
MOCK_MODE=false
MAIN_SYSTEM_URL=http://titita-onecloud:3000
SIGNAGE_API_KEY=<與 OneCloud 的 SIGNAGE_API_KEY 相同>
DATA_DIR=/app/data
```

正式資料庫應使用只獲授權存取 CMS 資料庫的帳號。CMS 只有一個 state 文件，透過 Mongoose 與樂觀版本檢查保存。媒體與課表快取在 `/app/data`。

4. 確認既有外部 network 存在，再執行：

```powershell
docker compose build
docker compose up -d
docker compose logs --tail 50 signage
```

Compose 強制 `MOCK_MODE=false` 與 `CMS_STORAGE=mongo`，避免誤將本機模擬設定部署為正式模式。HTTPS 終結建議由現有 NAS 反向代理處理，將對外網域轉至 3002，並保留 Host。Compose 的 `COOKIE_SECURE` 預設 true；只有明確的內網 HTTP 測試才設 false。瀏覽器對 HTTP 內網 IP 不提供 Service Worker，正式離線重載需要 HTTPS（localhost 本機例外）。

## 初次使用

1. 登入 `/admin`，在「畫面與課表」填入品牌、LINE 連結和教室篩選。
2. 編輯公告與海報；點「儲存草稿」，再開啟完整預覽。
3. 點「發布到螢幕」。發布為內容快照，後續編輯不立即影響播放。
4. 「螢幕管理」輸入名稱，產生六位配對碼（10 分鐘內有效、僅能使用一次）。
5. 在電視或迷你電腦瀏覽器開啟 `/display`，輸入配對碼；按全螢幕。
6. 檢查最後回報時間、內容版本與真實課表，安排電視開機自動開啟瀏覽器的作業系統設定。

第一版提供全螢幕按鈕；設備開機自動執行瀏覽器需依現場播放器系統另設，網站不能單獨控制電視開機。

## 斷線與撤銷行為

- 配對播放頁每 30 秒讀取 CMS。CMS 每 30 秒刷新當日 OneCloud 課表，平行請求共用一次同步。
- OneCloud 失敗時明確標示連線暫停；同日快取最多保留 5 分鐘，跨日或超時即隱藏課程。
- 已完成第一次載入與離線準備的正式播放頁，可在離線時重新整理，繼續使用瀏覽器已快取的版面、海報和發布內容；未快取的圖片仍需要網路。
- CMS、管理員 session、API JSON 不存入 Service Worker cache。發布內容另以 localStorage 儲存供配對螢幕備援。
- 停用設備於下一次成功連線時生效並清除瀏覽器內容快取；完全離線中的設備無法即時收到撤銷指令。
- 公告與海報到期由播放端持續按時間判斷。不要在公開媒體中上傳個資；已下載的公開海報不具遠端收回保證。

## 持久化與備份

備份獨立 MongoDB，以及 Compose 的 `signage-data` Volume。重建容器不需重配設備，前提是資料庫、Volume、網域與 cookie 均保留。不要執行 `docker compose down -v`，除非明確要刪除媒體 Volume。

本機檔案模式只供單一服務模擬測試，資料位於 `data/cms.json`。本機內容不會自動移到正式 MongoDB；正式上線時需重新設定／發布內容。

## 維運邊界

健康檢查只代表 HTTP 程序存活，不代表 MongoDB 或 OneCloud 可用。使用後台讀取／儲存與草稿預覽驗證下游服務。登入節流存於單一程序記憶體，第一版不支援多副本共用節流。