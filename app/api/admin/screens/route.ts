import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashToken, HttpError, rateLimit, requireAdmin } from "@/lib/auth";
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
    rateLimit("screen-pair-approve", 30);
    const body = z
      .object({
        name: z.string().trim().min(1).max(40),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(await jsonBody(request));
    const screen = await mutateState((s) => {
      const pending = (s.pendingPairings ?? []).find(
        (p) =>
          p.codeHash === hashToken(body.code) &&
          Date.parse(p.expiresAt) > Date.now(),
      );
      if (!pending)
        throw new HttpError(400, "配對碼無效或已過期，請查看螢幕上的新配對碼");
      if (s.screens.length >= 20)
        throw new HttpError(
          400,
          "第一版最多 20 台螢幕，請先刪除不再使用的螢幕",
        );
      const screen = {
        id: randomUUID(),
        name: body.name,
        tokenHash: pending.tokenHash,
        enabled: true,
        lastSeen: null,
        contentVersion: null,
      };
      s.screens.push(screen);
      s.pendingPairings = (s.pendingPairings ?? []).filter(
        (p) => p.tokenHash !== pending.tokenHash,
      );
      const { tokenHash: _, ...publicScreen } = screen;
      return publicScreen;
    });
    return ok(screen, 201);
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
export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const body = z.object({ id: z.uuid() }).parse(await jsonBody(request));
    await mutateState((s) => {
      const index = s.screens.findIndex((d) => d.id === body.id);
      if (index === -1) throw new HttpError(404, "找不到螢幕");
      const [screen] = s.screens.splice(index, 1);
      s.pairCodes = (s.pairCodes ?? []).filter((p) => p.screenId !== screen.id);
      s.pendingPairings = (s.pendingPairings ?? []).filter(
        (p) => p.tokenHash !== screen.tokenHash,
      );
    });
    return ok({ success: true });
  } catch (e) {
    return fail(e);
  }
}
