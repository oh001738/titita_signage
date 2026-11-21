import { describe, expect, it } from "vitest";
import type { Announcement } from "@/types";
import {
  advanceAnnouncement,
  initialAnnouncementPlayback,
  reconcileAnnouncements,
} from "@/lib/announcement-scheduler";

const a = (
  id: string,
  priority: "normal" | "urgent" = "normal",
): Announcement => ({
  id,
  priority,
  title: id,
  body: id,
  startsAt: "",
  endsAt: "",
});
const A = a("A"),
  B = a("B"),
  C = a("C"),
  U = a("U", "urgent"),
  V = a("V", "urgent");

describe("announcement playback by ID", () => {
  it("rotates normal notices in configured order and leaves a singleton stable", () => {
    let s = reconcileAnnouncements(initialAnnouncementPlayback(), [A, B, C]);
    expect(s.currentId).toBe("A");
    for (const id of ["B", "C", "A"]) {
      s = advanceAnnouncement(s, [A, B, C]);
      expect(s.currentId).toBe(id);
    }
    s = reconcileAnnouncements(s, [A]);
    const generation = s.generation;
    s = advanceAnnouncement(s, [A]);
    expect(s.currentId).toBe("A");
    expect(s.generation).toBe(generation);
  });
  it("interrupts immediately, rotates all urgent notices, resumes interrupted normal notice from start", () => {
    let s = reconcileAnnouncements(initialAnnouncementPlayback(), [A, B]);
    s = advanceAnnouncement(s, [A, B]);
    expect(s.currentId).toBe("B");
    s = reconcileAnnouncements(s, [A, B, U, V]);
    expect(s).toMatchObject({ currentId: "U", resumeId: "B", mode: "urgent" });
    s = advanceAnnouncement(s, [A, B, U, V]);
    expect(s.currentId).toBe("V");
    s = advanceAnnouncement(s, [A, B, U, V]);
    expect(s.currentId).toBe("U");
    const previous = s.generation;
    s = reconcileAnnouncements(s, [A, B]);
    expect(s).toMatchObject({
      currentId: "B",
      mode: "normal",
      resumeId: null,
      generation: previous + 1,
    });
  });
  it("keeps the current notice on insertion and reorder, then advances according to new order", () => {
    let s = reconcileAnnouncements(initialAnnouncementPlayback(), [A, B]);
    const generation = s.generation;
    s = reconcileAnnouncements(s, [C, A, B]);
    expect(s.currentId).toBe("A");
    expect(s.generation).toBe(generation);
    s = reconcileAnnouncements(s, [B, A, C]);
    expect(s.currentId).toBe("A");
    expect(s.generation).toBe(generation);
    s = advanceAnnouncement(s, [B, A, C]);
    expect(s.currentId).toBe("C");
  });
  it("chooses surviving successor after removal, including when interrupted notice expires", () => {
    let s = reconcileAnnouncements(initialAnnouncementPlayback(), [A, B, C]);
    s = advanceAnnouncement(s, [A, B, C]);
    s = reconcileAnnouncements(s, [A, B, C, U]);
    s = reconcileAnnouncements(s, [A, C, U]);
    s = reconcileAnnouncements(s, [A, C]);
    expect(s.currentId).toBe("C");
    s = reconcileAnnouncements(s, [A]);
    expect(s.currentId).toBe("A");
  });
  it("ignores an obsolete timer when its notice became inactive", () => {
    const s = reconcileAnnouncements(initialAnnouncementPlayback(), [A, B, C]);
    const after = advanceAnnouncement(s, [B, C]);
    expect(after.currentId).toBe("B");
  });
  it("returns a stable reference when the active list is unchanged", () => {
    const s = reconcileAnnouncements(initialAnnouncementPlayback(), [A, B]);
    expect(reconcileAnnouncements(s, [A, B])).toBe(s);
    const empty = reconcileAnnouncements(s, []);
    expect(empty).toMatchObject({ currentId: null, mode: null });
    expect(reconcileAnnouncements(empty, [])).toBe(empty);
  });
  it("handles priority edits without retaining a stale urgent notice", () => {
    let s = reconcileAnnouncements(initialAnnouncementPlayback(), [A, B]);
    s = reconcileAnnouncements(s, [a("A", "urgent"), B]);
    expect(s).toMatchObject({ currentId: "A", mode: "urgent" });
    s = reconcileAnnouncements(s, [A, B]);
    expect(s).toMatchObject({ currentId: "A", mode: "normal" });
  });
});
