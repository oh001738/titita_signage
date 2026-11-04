import { requireAdmin } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { fetchSchedule } from "@/lib/main-system-client";
import { readState } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    const s = await readState();
    return ok({
      content: s.draft,
      version: s.published?.version ?? 0,
      schedule: await fetchSchedule(),
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
