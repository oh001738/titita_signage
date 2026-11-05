import { mkdtemp, mkdir, writeFile, access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { defaultState } from "@/lib/defaults";
import { atomicWrite, mutateState, readState } from "@/lib/store";
import {
  collectDeletedAlbums,
  ensureNoDeletedAlbumMedia,
  maybeCleanupAlbumTrash,
  purgeAlbumTrash,
} from "@/lib/album-trash";
import type { ActivityAlbum } from "@/types";
let dir = "";
afterEach(async () => {
  vi.unstubAllEnvs();
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = "";
});
it("retains referenced files and records a deletion marker before unlinking", async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "signage-album-gc-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("CMS_STORAGE", "file");
  vi.stubEnv("MOCK_MODE", "true");
  await mkdir(path.join(dir, "uploads"));
  const filename = "abcdef-1234.png";
  const url = `/api/media/${filename}`;
  const file = path.join(dir, "uploads", filename);
  await writeFile(file, "test");
  const a: ActivityAlbum = {
    id: "a",
    title: "活動",
    date: "",
    description: "",
    enabled: true,
    startsAt: "",
    endsAt: "",
    duration: 8,
    batchSize: 3,
    fit: "contain",
    photos: [{ id: "p", image: url, selected: true, caption: "" }],
  };
  const state = defaultState();
  state.albumTrash = collectDeletedAlbums([a], []);
  const content = { ...state.draft, albums: [a] };
  state.published = {
    version: 1,
    publishedAt: new Date().toISOString(),
    content,
  };
  state.previous = {
    version: 1,
    publishedAt: new Date().toISOString(),
    content,
  };
  purgeAlbumTrash(state, [state.albumTrash[0].id]);
  await atomicWrite(path.join(dir, "cms.json"), state);
  await maybeCleanupAlbumTrash(true);
  await expect(access(file)).resolves.toBeUndefined();
  expect((await readState()).pendingAlbumMedia).toEqual([url]);
  await mutateState((s) => {
    s.published = null;
  });
  await maybeCleanupAlbumTrash(true);
  await expect(access(file)).resolves.toBeUndefined();
  await mutateState((s) => {
    s.previous = null;
  });
  await maybeCleanupAlbumTrash(true);
  await expect(access(file)).rejects.toMatchObject({ code: "ENOENT" });
  const result = await readState();
  expect(result.deletedAlbumMedia).toContain(url);
  expect(result.pendingAlbumUnlinks).toEqual([]);
  expect(() => ensureNoDeletedAlbumMedia(result, { logo: url })).toThrow(
    "重新上傳",
  );
});
it("cleans expired trash on the next housekeeping run without deleting referenced assets", async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "signage-album-expiry-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("CMS_STORAGE", "file");
  vi.stubEnv("MOCK_MODE", "true");
  await mkdir(path.join(dir, "uploads"));
  const filename = "abcdef-5678.jpg";
  const url = `/api/media/${filename}`;
  const file = path.join(dir, "uploads", filename);
  await writeFile(file, "test");
  const album: ActivityAlbum = {
    id: "b",
    title: "活動",
    date: "",
    description: "",
    enabled: true,
    startsAt: "",
    endsAt: "",
    duration: 8,
    batchSize: 3,
    fit: "contain",
    photos: [{ id: "p", image: url, selected: true, caption: "" }],
  };
  const state = defaultState();
  state.albumTrash = collectDeletedAlbums(
    [album],
    [],
    Date.now() - 31 * 24 * 60 * 60 * 1000,
  );
  state.published = {
    version: 1,
    publishedAt: new Date().toISOString(),
    content: { ...state.draft, albums: [album] },
  };
  await atomicWrite(path.join(dir, "cms.json"), state);
  await maybeCleanupAlbumTrash(true);
  expect((await readState()).albumTrash).toEqual([]);
  await expect(access(file)).resolves.toBeUndefined();
  await mutateState((s) => {
    s.published = null;
  });
  await maybeCleanupAlbumTrash(true);
  await expect(access(file)).rejects.toMatchObject({ code: "ENOENT" });
});
