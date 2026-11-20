import { HttpError, requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { fetchSchedule } from "@/lib/main-system-client";
import { readState } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const source = z
      .enum(["draft", "published"])
      .parse(new URL(request.url).searchParams.get("source") ?? "draft");
    const s = await readState();
    if (source === "published" && !s.published)
      throw new HttpError(404, "尚未發布內容，請先發布後再查看已發布畫面");
    return ok({
      content: source === "published" ? s.published!.content : s.draft,
      version: s.published?.version ?? 0,
      schedule: await fetchSchedule(),
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
