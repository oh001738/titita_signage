import { cookies } from "next/headers";
import { hashToken, HttpError } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { readState } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  const receivedAt = Date.now();
  try {
    const token = (await cookies()).get("signage_screen")?.value;
    if (!token) throw new HttpError(401, "請先配對螢幕");
    const state = await readState();
    const screen = state.screens.find(
      (item) => item.tokenHash === hashToken(token),
    );
    if (!screen || !screen.enabled) throw new HttpError(403, "螢幕未啟用");
    return ok({ receivedAt, sentAt: Date.now() });
  } catch (error) {
    return fail(error);
  }
}
