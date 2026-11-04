import { cookies } from "next/headers";
import { z } from "zod";
import {
  cookieOptions,
  createSession,
  HttpError,
  rateLimit,
  requireSameOrigin,
  safeEqual,
  verifyPassword,
} from "@/lib/auth";
import { fail, jsonBody, ok } from "@/lib/http";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    rateLimit("admin-login");
    const body = z
      .object({
        username: z.string().max(100),
        password: z.string().min(1).max(256),
      })
      .parse(await jsonBody(request));
    const valid = await verifyPassword(body.password);
    if (
      !valid ||
      !safeEqual(body.username, process.env.ADMIN_USERNAME || "admin")
    )
      throw new HttpError(401, "帳號或密碼不正確");
    (await cookies()).set("signage_admin", createSession(), {
      ...cookieOptions(),
      maxAge: 8 * 60 * 60,
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
