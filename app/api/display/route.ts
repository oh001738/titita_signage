import { cookies } from "next/headers";
import { hashToken, HttpError } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { fetchSchedule } from "@/lib/main-system-client";
import { mutateState, readState } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const token = (await cookies()).get("signage_screen")?.value;
    if (!token) throw new HttpError(401, "請先配對螢幕");
    const state = await readState();
    const screen = state.screens.find(
      (d) => d.enabled && d.tokenHash === hashToken(token),
    );
    if (!screen) throw new HttpError(403, "螢幕已停用或配對失效");
    if (!state.published)
      throw new HttpError(404, "尚未發布內容，請至管理後台發布");
    const schedule = await fetchSchedule();
    if (
      !screen.lastSeen ||
      Date.now() - Date.parse(screen.lastSeen) > 60_000 ||
      screen.contentVersion !== state.published.version
    ) {
      await mutateState((s) => {
        const current = s.screens.find((d) => d.id === screen.id);
        if (current) {
          current.lastSeen = new Date().toISOString();
          current.contentVersion = state.published!.version;
        }
      });
    }
    return ok({
      content: state.published.content,
      version: state.published.version,
      schedule,
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
