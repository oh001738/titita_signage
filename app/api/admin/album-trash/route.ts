import { z } from "zod";
import { HttpError, requireAdmin } from "@/lib/auth";
import { fail, jsonBody, ok } from "@/lib/http";
import { ConflictError, mutateState, readState } from "@/lib/store";
import {
  purgeAlbumTrash,
  restoreTrashItem,
  maybeCleanupAlbumTrash,
} from "@/lib/album-trash";
import { contentSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = z
      .object({
        id: z.uuid(),
        action: z.enum(["restore", "purge"]).default("restore"),
        revision: z.number().int().nonnegative(),
      })
      .parse(await jsonBody(request));
    await mutateState(async (state) => {
      if (state.contentRevision !== body.revision)
        throw new ConflictError("內容已更新，請重新載入");
      if (!(state.albumTrash ?? []).some((item) => item.id === body.id))
        throw new HttpError(404, "回收站項目不存在");
      if (body.action === "restore") {
        restoreTrashItem(state, body.id);
        state.draft = contentSchema.parse(state.draft);
      } else await purgeAlbumTrash(state, [body.id]);
      state.contentRevision++;
    });
    if (body.action === "purge")
      await maybeCleanupAlbumTrash(true).catch(() => undefined);
    const state = await readState();
    return ok({
      revision: state.contentRevision,
      draft: state.draft,
      published: state.published,
      previous: state.previous,
      albumTrash: state.albumTrash ?? [],
    });
  } catch (error) {
    return fail(error);
  }
}
