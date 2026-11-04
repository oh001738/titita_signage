import { z } from "zod";
import { requireAdmin, HttpError } from "@/lib/auth";
import { fail, jsonBody, ok } from "@/lib/http";
import { ConflictError, mutateState } from "@/lib/store";
import { contentSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = z
      .object({
        action: z.enum(["publish", "rollback"]),
        revision: z.number().int().nonnegative(),
      })
      .parse(await jsonBody(request));
    const published = await mutateState((s) => {
      if (s.contentRevision !== body.revision)
        throw new ConflictError("內容已更新，請重新載入後再發布");
      if (body.action === "rollback" && !s.previous)
        throw new HttpError(400, "尚無可還原版本");
      const content =
        body.action === "rollback"
          ? s.previous!.content
          : contentSchema.parse(s.draft);
      const publication = {
        version: (s.published?.version ?? 0) + 1,
        publishedAt: new Date().toISOString(),
        content: structuredClone(content),
      };
      s.contentRevision++;
      s.previous = s.published;
      s.published = publication;
      return publication;
    });
    return ok(published);
  } catch (e) {
    return fail(e);
  }
}
