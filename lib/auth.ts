import { cookies } from "next/headers";
import {
  createHmac,
  createHash,
  timingSafeEqual,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const safeEqual = (a: string, b: string) =>
  timingSafeEqual(
    Buffer.from(hashToken(a), "hex"),
    Buffer.from(hashToken(b), "hex"),
  );
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("SESSION_SECRET 至少需要 32 字元");
  return value;
}
export function createSession(now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", expires: now + 8 * 60 * 60 * 1000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifySession(token: string, now = Date.now()): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    if (
      !safeEqual(
        signature,
        createHmac("sha256", secret()).update(payload).digest("base64url"),
      )
    )
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      data.role === "admin" &&
      Number.isFinite(data.expires) &&
      data.expires > now &&
      data.expires <= now + 8 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}
export async function isAdmin(): Promise<boolean> {
  return verifySession((await cookies()).get("signage_admin")?.value ?? "");
}
export async function verifyPassword(password: string): Promise<boolean> {
  const [salt, expected] = (process.env.ADMIN_PASSWORD_HASH ?? "").split(":");
  if (!salt || !expected || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return safeEqual(actual.toString("hex"), expected);
}
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== "false",
  sameSite: "strict" as const,
  path: "/",
});
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireAdmin(request?: Request) {
  if (!(await isAdmin())) throw new HttpError(401, "請先登入管理後台");
  if (request && request.method !== "GET") requireSameOrigin(request);
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN;
  let valid = false;
  try {
    const parsed = new URL(origin ?? "");
    valid = expected
      ? parsed.origin === expected
      : ["http:", "https:"].includes(parsed.protocol) &&
        parsed.host === request.headers.get("host");
  } catch {
    /* Missing or malformed origin is denied. */
  }
  if (!valid) throw new HttpError(403, "無效的請求來源");
}
/** Pairing may be initiated from a different LAN hostname/IP than the admin
 * URL. It must still originate from the exact host and scheme being requested.
 * Admin mutations continue to use the stricter APP_ORIGIN check above. */
export function requireScreenSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    const parsed = new URL(origin ?? "");
    const requestUrl = new URL(request.url);
    if (
      origin === parsed.origin &&
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.protocol === requestUrl.protocol &&
      parsed.host === request.headers.get("host")
    )
      return;
  } catch {
    /* Missing or malformed origins are rejected. */
  }
  throw new HttpError(403, "無效的請求來源");
}
const globalRate = globalThis as typeof globalThis & {
  signageRates?: Map<string, { count: number; reset: number }>;
};
export function rateLimit(key: string, max = 10, windowMs = 15 * 60 * 1000) {
  const map = (globalRate.signageRates ??= new Map());
  const now = Date.now();
  for (const [id, entry] of map) if (entry.reset <= now) map.delete(id);
  const item = map.get(key) ?? { count: 0, reset: now + windowMs };
  if (item.count >= max) throw new HttpError(429, "嘗試次數過多，請稍後再試");
  item.count++;
  map.set(key, item);
}
