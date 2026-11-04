import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  cookieOptions,
  hashToken,
  HttpError,
  rateLimit,
  requireSameOrigin,
} from "@/lib/auth";
import { fail, jsonBody, ok } from "@/lib/http";
import { mutateState } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    rateLimit("screen-pair", 20);
    const { code } = z
      .object({ code: z.string().regex(/^\d{6}$/) })
      .parse(await jsonBody(request));
    const token = randomBytes(32).toString("base64url");
    await mutateState((s) => {
      const pair = s.pairCodes.find(
        (p) =>
          p.hash === hashToken(code) && Date.parse(p.expiresAt) > Date.now(),
      );
      const screen =
        pair && s.screens.find((d) => d.id === pair.screenId && d.enabled);
      if (!screen) throw new HttpError(403, "配對碼無效或已過期");
      screen.tokenHash = hashToken(token);
      s.pairCodes = s.pairCodes.filter((p) => p.screenId !== screen.id);
    });
    (await cookies()).set("signage_screen", token, {
      ...cookieOptions(),
      maxAge: 365 * 24 * 60 * 60,
    });
    return ok({ success: true });
  } catch (e) {
    return fail(e);
  }
}
