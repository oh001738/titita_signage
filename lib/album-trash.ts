import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { dataDir, mutateState, readState } from "@/lib/store";
import type { ActivityAlbum, AlbumTrashItem, CmsState } from "@/types";
import { HttpError } from "@/lib/auth";
const RETENTION = 30 * 24 * 60 * 60 * 1000;
export function collectDeletedAlbums(
  oldAlbums: ActivityAlbum[],
  nextAlbums: ActivityAlbum[],
  now = Date.now(),
): AlbumTrashItem[] {
  const stamp = () => ({
    id: randomUUID(),
    deletedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RETENTION).toISOString(),
  });
  return oldAlbums.flatMap((album, index): AlbumTrashItem[] => {
    const next = nextAlbums.find((x) => x.id === album.id);
    if (!next) return [{ ...stamp(), kind: "album", album, index }];
    return album.photos.flatMap((photo, photoIndex): AlbumTrashItem[] =>
      next.photos.some((x) => x.id === photo.id)
        ? []
        : [
            {
              ...stamp(),
              kind: "photo",
              albumId: album.id,
              albumTitle: album.title,
              photo,
              index: photoIndex,
            },
          ],
    );
  });
}
export function restoreTrashItem(state: CmsState, id: string) {
  const item = (state.albumTrash ?? []).find((x) => x.id === id);
  if (!item) throw new HttpError(404, "回收站項目不存在");
  if (Date.parse(item.expiresAt) <= Date.now())
    throw new HttpError(400, "已超過保留期限");
  const albums = (state.draft.albums ??= []);
  if (item.kind === "album") {
    if (albums.some((a) => a.id === item.album.id))
      throw new HttpError(409, "相簿已存在");
    albums.splice(Math.min(item.index, albums.length), 0, item.album);
  } else {
    const album = albums.find((a) => a.id === item.albumId);
    if (!album) throw new HttpError(409, "請先還原所屬相簿");
    if (album.photos.some((p) => p.id === item.photo.id))
      throw new HttpError(409, "照片已存在");
    album.photos.splice(
      Math.min(item.index, album.photos.length),
      0,
      item.photo,
    );
  }
  state.albumTrash = (state.albumTrash ?? []).filter((x) => x.id !== id);
}

function itemMedia(item: AlbumTrashItem): string[] {
  const photos = item.kind === "album" ? item.album.photos : [item.photo];
  return photos.flatMap((photo) =>
    [photo.image, photo.original].filter((x): x is string => Boolean(x)),
  );
}
function collectMediaUrls(
  value: unknown,
  out = new Set<string>(),
): Set<string> {
  if (typeof value === "string") {
    if (/^\/api\/media\/[a-f0-9-]+\.(?:png|jpg|webp)$/.test(value))
      out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectMediaUrls(item, out);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectMediaUrls(item, out);
  }
  return out;
}
/** Reject attempts to reintroduce an image already scheduled for deletion. */
export function ensureNoDeletedAlbumMedia(state: CmsState, content: unknown) {
  const deleted = new Set(state.deletedAlbumMedia ?? []);
  for (const url of collectMediaUrls(content)) {
    if (deleted.has(url))
      throw new HttpError(409, "部分圖片已被永久刪除，請重新上傳");
  }
}
/** Remove trash metadata and queue its files; this function performs no file I/O. */
export function purgeAlbumTrash(state: CmsState, ids: string[]) {
  const trash = state.albumTrash ?? [];
  const removing = trash.filter((item) => ids.includes(item.id));
  state.albumTrash = trash.filter((item) => !ids.includes(item.id));
  state.pendingAlbumMedia = [
    ...new Set([
      ...(state.pendingAlbumMedia ?? []),
      ...removing.flatMap(itemMedia),
    ]),
  ];
}
/** Mark unreferenced paths in the same atomic state update that protects references. */
export function markUnreferencedAlbumMedia(state: CmsState) {
  const referenced = collectMediaUrls({
    draft: state.draft,
    published: state.published,
    previous: state.previous,
    albumTrash: state.albumTrash,
  });
  const pending: string[] = [];
  const marked = new Set(state.deletedAlbumMedia ?? []);
  const unlinks = new Set(state.pendingAlbumUnlinks ?? []);
  for (const url of state.pendingAlbumMedia ?? []) {
    if (!/^\/api\/media\/[a-f0-9-]+\.(?:png|jpg|webp)$/.test(url)) continue;
    if (referenced.has(url)) {
      pending.push(url);
      continue;
    }
    marked.add(url);
    unlinks.add(url);
  }
  state.pendingAlbumMedia = pending;
  state.deletedAlbumMedia = [...marked];
  state.pendingAlbumUnlinks = [...unlinks];
}
const housekeeping = globalThis as typeof globalThis & {
  albumCleanupAt?: number;
  albumCleanupPromise?: Promise<void>;
};
/** Opportunistic housekeeping: the durable deletion marker is committed before any file is unlinked. */
export async function maybeCleanupAlbumTrash(force = false) {
  const now = Date.now();
  if (housekeeping.albumCleanupPromise) return housekeeping.albumCleanupPromise;
  if (!force && now - (housekeeping.albumCleanupAt ?? 0) < 60 * 60_000) return;
  housekeeping.albumCleanupPromise = (async () => {
    const state = await readState();
    const expired = (state.albumTrash ?? [])
      .filter((x) => Date.parse(x.expiresAt) <= now)
      .map((x) => x.id);
    if (expired.length || (state.pendingAlbumMedia ?? []).length)
      await mutateState((current) => {
        const due = (current.albumTrash ?? [])
          .filter((x) => Date.parse(x.expiresAt) <= now)
          .map((x) => x.id);
        purgeAlbumTrash(current, due);
        markUnreferencedAlbumMedia(current);
      });
    const latest = await readState();
    const complete: string[] = [];
    for (const url of latest.pendingAlbumUnlinks ?? []) {
      const match = /^\/api\/media\/([a-f0-9-]+\.(?:png|jpg|webp))$/.exec(url);
      if (!match || !(latest.deletedAlbumMedia ?? []).includes(url)) continue;
      try {
        await unlink(path.join(dataDir(), "uploads", match[1]));
        complete.push(url);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          complete.push(url);
      }
    }
    if (complete.length)
      await mutateState((current) => {
        current.pendingAlbumUnlinks = (
          current.pendingAlbumUnlinks ?? []
        ).filter((url) => !complete.includes(url));
      });
    housekeeping.albumCleanupAt = Date.now();
  })().finally(() => {
    housekeeping.albumCleanupPromise = undefined;
  });
  return housekeeping.albumCleanupPromise;
}
