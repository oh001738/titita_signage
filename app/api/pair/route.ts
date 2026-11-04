import { randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import {
  cookieOptions,
  hashToken,
  HttpError,
  rateLimit,
  requireScreenSameOrigin,
} from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { mutateState } from "@/lib/store";

// A screen creates its own short-lived code. Its long random token never leaves
// the screen's HttpOnly cookie; only an authenticated admin can approve the code.
export async function POST(request: Request) {
  try {
    requireScreenSameOrigin(request);
    rateLimit("screen-pair-create", 120);
    const existingToken = (await cookies()).get("signage_screen")?.value;
    const existingHash = existingToken ? hashToken(existingToken) : null;
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const code = await mutateState((s) => {
      if (
        existingHash &&
        s.screens.some(
          (screen) => screen.enabled && screen.tokenHash === existingHash,
        )
      )
        throw new HttpError(409, "螢幕已配對，請重新載入");
      s.pendingPairings = (s.pendingPairings ?? []).filter(
        (p) =>
          Date.parse(p.expiresAt) > Date.now() && p.tokenHash !== existingHash,
      );
      if (s.pendingPairings.length >= 100)
        throw new HttpError(429, "待配對的螢幕過多，請稍後再試");
      let candidate: string;
      do {
        candidate = String(randomInt(100000, 1000000));
      } while (
        s.pendingPairings.some((p) => p.codeHash === hashToken(candidate))
      );
      s.pendingPairings.push({
        codeHash: hashToken(candidate),
        tokenHash: hashToken(token),
        expiresAt,
      });
      return candidate;
    });
    (await cookies()).set("signage_screen", token, {
      ...cookieOptions(),
      maxAge: 365 * 24 * 60 * 60,
    });
    return ok({ code, expiresAt }, 201);
  } catch (e) {
    return fail(e);
  }
}
