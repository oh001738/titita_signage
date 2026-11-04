import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { HttpError, requireAdmin } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { dataDir } from "@/lib/store";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const length = Number(request.headers.get("content-length"));
    if (
      !Number.isFinite(length) ||
      length <= 0 ||
      length > 8 * 1024 * 1024 + 8192
    )
      throw new HttpError(413, "圖片大小限制為 8 MB");
    const body = await request.formData();
    const file = body.get("file");
    if (!(file instanceof File) || file.size > 8 * 1024 * 1024)
      throw new HttpError(400, "請選擇 8 MB 以內圖片");
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? "jpg"
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : null;
    if (!ext) throw new HttpError(400, "僅支援 PNG、JPEG、WebP 圖片");
    const name = `${randomUUID()}.${ext}`;
    const dir = path.join(dataDir(), "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes, { flag: "wx" });
    return ok({ image: `/api/media/${name}` }, 201);
  } catch (e) {
    return fail(e);
  }
}
