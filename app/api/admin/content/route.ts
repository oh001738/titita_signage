import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { fail, jsonBody, ok } from "@/lib/http";
import { ConflictError, mutateState, readState } from "@/lib/store";
import { contentSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    const s = await readState();
    return ok({
      revision: s.contentRevision,
      draft: s.draft,
      published: s.published,
      previous: s.previous,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    const body = z
      .object({
        revision: z.number().int().nonnegative(),
        content: contentSchema,
      })
      .parse(await jsonBody(request));
    await mutateState((s) => {
      if (s.contentRevision !== body.revision)
        throw new ConflictError("內容已更新，請重新載入後再編輯");
      s.draft = body.content;
      s.contentRevision++;
    });
    const s = await readState();
    return ok({
      revision: s.contentRevision,
      draft: s.draft,
      published: s.published,
      previous: s.previous,
    });
  } catch (e) {
    return fail(e);
  }
}
