# OneCloud 整合補丁

本目錄保存本次開發的 OneCloud 唯讀看板端點與測試，讓獨立 CMS 儲存庫包含完整介接來源。補丁不含任何金鑰、帳密或資料庫內容。

在 OneCloud 專案目錄操作，先檢查，再套用：

```powershell
git apply --check C:/path/to/titita_signage/integrations/onecloud-signage.patch
git apply C:/path/to/titita_signage/integrations/onecloud-signage.patch
```

若 OneCloud 已存在相同檔案，請直接核對版本，不要重複套用。這次開發使用的相鄰 OneCloud 工作區已包含這些檔案。

在 OneCloud 的環境設定新增 `SIGNAGE_API_KEY`，使用至少 32 字元的隨機專屬金鑰，並在 CMS 設定相同值。不要沿用 LINE OA 的 INTERNAL_API_KEY。

部署前執行 OneCloud 的 typecheck 與 signage/signage-route 測試。請參閱 [API 契約](../docs/ONECLOUD_API.md) 與 [部署文件](../docs/DEPLOYMENT.md)。