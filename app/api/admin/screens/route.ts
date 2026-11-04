import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { hashToken, HttpError, requireAdmin } from "@/lib/auth";
import { fail, jsonBody, ok } from "@/lib/http";
import { mutateState, readState } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    const s = await readState();
    return ok(s.screens.map(({ tokenHash: _, ...screen }) => screen));
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = z
      .object({ name: z.string().trim().min(1).max(40) })
      .parse(await jsonBody(request));
    const code = String(randomInt(100000, 1000000));
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await mutateState((s) => {
      s.pairCodes = s.pairCodes.filter(
        (p) => Date.parse(p.expiresAt) > Date.now(),
      );
      if (s.screens.length >= 20)
        throw new HttpError(400, "第一版最多 20 台螢幕");
      s.screens.push({
        id,
        name: body.name,
        tokenHash: "",
        enabled: true,
        lastSeen: null,
        contentVersion: null,
      });
      s.pairCodes.push({ hash: hashToken(code), screenId: id, expiresAt });
    });
    return ok({ code, expiresAt }, 201);
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = z
      .object({ id: z.uuid(), enabled: z.boolean() })
      .parse(await jsonBody(request));
    await mutateState((s) => {
      const screen = s.screens.find((d) => d.id === body.id);
      if (!screen) throw new HttpError(404, "找不到螢幕");
      screen.enabled = body.enabled;
    });
    return ok({ success: true });
  } catch (e) {
    return fail(e);
  }
}
