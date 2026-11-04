import { ZodError } from "zod";
import { HttpError } from "./auth";
import { ConflictError } from "./store";
export function ok<T>(data: T, status = 200) {
  return Response.json(
    { data, error: null },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function fail(error: unknown) {
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof ConflictError
        ? 409
        : error instanceof ZodError || error instanceof SyntaxError
          ? 400
          : 500;
  const message =
    error instanceof ZodError
      ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("；")
      : status === 500
        ? "服務暫時無法使用，請檢查伺服器設定與連線"
        : error instanceof Error
          ? error.message
          : "請求失敗";
  return Response.json(
    { data: null, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function jsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "缺少請求資料");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 128 * 1024) {
      await reader.cancel();
      throw new HttpError(413, "資料超過大小限制");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
