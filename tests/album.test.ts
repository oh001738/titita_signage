import { describe, expect, it, vi } from "vitest";
import { defaultState } from "@/lib/defaults";
import { collectDeletedAlbums, restoreTrashItem } from "@/lib/album-trash";
import { contentSchema } from "@/lib/validation";
import type { ActivityAlbum } from "@/types";
const album: ActivityAlbum = {
  id: "a",
  title: "成果發表",
  date: "2026-05-03",
  description: "",
  enabled: true,
  startsAt: "",
  endsAt: "",
  duration: 8,
  batchSize: 3,
  fit: "contain",
  photos: [
    {
      id: "p1",
      image: "/api/media/abc-1.png",
      caption: "第一張",
      selected: true,
    },
    { id: "p2", image: "/api/media/abc-2.png", caption: "", selected: false },
  ],
};
describe("activity album", () => {
  it("accepts existing content without albums and validates album data", () => {
    const s = defaultState();
    delete s.draft.albums;
    expect(contentSchema.parse(s.draft).albums).toEqual([]);
    expect(
      contentSchema.safeParse({ ...s.draft, albums: [album] }).success,
    ).toBe(true);
    expect(
      contentSchema.safeParse({
        ...s.draft,
        albums: [
          {
            ...album,
            photos: [
              { ...album.photos[0], image: "https://example.com/a.png" },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("captures deleted photos but not reorder or selection changes", () => {
    const items = collectDeletedAlbums(
      [album],
      [{ ...album, photos: [{ ...album.photos[1], selected: true }] }],
      Date.parse("2026-11-05T00:00:00Z"),
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("photo");
    expect(items[0].expiresAt).toBe("2026-12-05T00:00:00.000Z");
  });
  it("restores a photo into its album and preserves position", () => {
    const s = defaultState();
    s.draft.albums = [{ ...album, photos: [album.photos[1]] }];
    s.albumTrash = collectDeletedAlbums([album], s.draft.albums, Date.now());
    restoreTrashItem(s, s.albumTrash[0].id);
    expect(s.draft.albums[0].photos.map((x) => x.id)).toEqual(["p1", "p2"]);
    expect(s.albumTrash).toEqual([]);
  });
  it("does not restore expired trash", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-06T00:00:00Z"));
    try {
      const s = defaultState();
      s.albumTrash = collectDeletedAlbums(
        [album],
        [],
        Date.parse("2026-11-05T00:00:00Z"),
      );
      expect(() => restoreTrashItem(s, s.albumTrash![0].id)).toThrow(
        "已超過保留期限",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
