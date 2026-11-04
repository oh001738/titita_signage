# OneCloud 看板唯讀 API

## GET /api/internal/signage/schedule?date=YYYY-MM-DD

Header：`X-Internal-Key: <SIGNAGE_API_KEY>`。金鑰只由 CMS 伺服器送出，不能放在 NEXT_PUBLIC 環境變數、前端程式或網址。

省略日期時使用台灣當日，只接受有效日期且距今天最多七日。成功格式：

```json
{
  "data": {
    "date": "2026-11-04",
    "lessons": [{
      "id": "lesson-id",
      "date": "2026-11-04",
      "start_time": "16:00",
      "end_time": "17:00",
      "course_name": "音樂個別課",
      "teacher_name": "林老師",
      "room_id": "room-id",
      "room_name": "A 教室",
      "status": "scheduled"
    }]
  },
  "error": null
}
```

- 服務認證取代使用者 session，與 LINE OA Internal API 的服務分界一致；專屬 SIGNAGE_API_KEY 只授權此路由。
- 端點僅讀取已有 Lesson，無資料寫入、課堂展開或固定週課表重建。
- 取消狀態原樣保留；改期後以實際 Lesson 的日期、老師、教室為準。
- 依業主要求，個別課與團體課皆原樣保留 OneCloud 的 course_name；若原課名含學生姓名，也會一併顯示。
- 團體課名稱視為公開名稱；正式驗收需檢查現有團體課命名不含個資。
- 明確白名單輸出，不讀取／回傳學生、出勤名單、備註、帳單與電話。
- 每日超過 1,000 堂會回 503，避免靜默截斷。
- 錯誤格式 `{data:null,error:string}`：400 日期無效或超界；403 金鑰錯誤；503 未啟用或超量；500 查詢失敗。

## 參考來源

- 本機 LINE OA：`titita-lineoa/titita_lineoa/lib/main-system-client.ts`，server-to-server API Client 與 mock adapter。
- 本機 OneCloud：`lib/internal-auth.ts`、`app/api/internal/users/courses/route.ts`，Internal API 與 Mongoose 查詢風格。
- Next.js 官方：[Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)、[Cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)。
- Docker 官方：[Next.js 容器化](https://docs.docker.com/guides/nextjs/)。