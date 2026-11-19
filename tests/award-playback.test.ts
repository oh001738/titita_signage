import { describe, expect, it } from "vitest";
import { awardEffect, awardPages, planAwardRun } from "@/lib/award-pages";
import { defaultContent } from "@/lib/defaults";
import { contentSchema } from "@/lib/validation";
import type { Award } from "@/types";

const now = new Date("2026-11-19T16:00:00+08:00");
const award = (count = 10): Award => ({
  id: "competition",
  layout: "competition",
  competition: "音樂大賽",
  sharedPrize: "特優",
  image: "",
  enabled: true,
  duration: 15,
  startsAt: "",
  endsAt: "",
  recipients: Array.from({ length: count }, (_, i) => ({
    id: `student-${i}`,
    name: `學生${i}`,
    category: "鋼琴",
    prize: "特優獎",
  })),
});

describe("award playback", () => {
  it("keeps old records valid without materializing optional playback settings", () => {
    const parsed = contentSchema.parse({
      ...defaultContent(),
      awards: [award()],
    });
    expect(parsed.awards[0].effect).toBeUndefined();
    expect(parsed.awards[0].playbackMode).toBeUndefined();
    expect(parsed.awards[0].segmentDuration).toBeUndefined();
    expect(awardEffect(award())).toBe("reveal");
    expect(awardEffect({ ...award(1), layout: "individual" })).toBe("classic");
    expect(awardEffect({ ...award(), layout: "group" })).toBe("classic");
  });

  it("shows one student per spotlight and three per reveal, with classic group sizing preserved", () => {
    expect(
      awardPages([{ ...award(4), effect: "spotlight" }], now).map(
        (page) => page.recipients.length,
      ),
    ).toEqual([1, 1, 1, 1]);
    expect(
      awardPages([{ ...award(7), layout: "group", effect: "reveal" }], now).map(
        (page) => page.recipients.length,
      ),
    ).toEqual([3, 3, 1]);
    expect(
      awardPages(
        [{ ...award(7), layout: "group", effect: "classic" }],
        now,
      ).map((page) => page.recipients.length),
    ).toEqual([6, 1]);
  });

  it("plays a continuous competition from the beginning without a total-duration cap", () => {
    const record = {
      ...award(60),
      effect: "spotlight" as const,
      playbackMode: "continuous" as const,
      duration: 60,
      segmentDuration: 15,
    };
    const run = planAwardRun(record, now, 40);
    expect(run.pages).toHaveLength(60);
    expect(run.pages[0].page).toBe(0);
    expect(run.pages[59].page).toBe(59);
    expect(run.nextPage).toBe(0);
  });

  it("resumes segmented runs without skipping, repeating, or wrapping into the first page", () => {
    const record = { ...award(14), segmentDuration: 30 };
    const first = planAwardRun(record, now);
    const second = planAwardRun(record, now, first.nextPage);
    const third = planAwardRun(record, now, second.nextPage);
    expect(first.pages.map((page) => page.page)).toEqual([0, 1]);
    expect(second.pages.map((page) => page.page)).toEqual([2, 3]);
    expect(third.pages.map((page) => page.page)).toEqual([4]);
    expect(third.nextPage).toBe(0);
    expect(
      [...first.pages, ...second.pages, ...third.pages].flatMap((page) =>
        page.recipients.map((recipient) => recipient.id),
      ),
    ).toEqual(record.recipients.map((recipient) => recipient.id));
  });

  it("defaults to segmented playback with a 45-second target", () => {
    const run = planAwardRun(award(14), now);
    expect(run.pages.map((page) => page.page)).toEqual([0, 1, 2]);
    expect(run.nextPage).toBe(3);
  });

  it("never cuts a student page short when its duration exceeds the segment target", () => {
    const run = planAwardRun(
      { ...award(), duration: 60, segmentDuration: 15 },
      now,
    );
    expect(run.pages.map((page) => page.page)).toEqual([0]);
    expect(run.nextPage).toBe(1);
  });

  it("normalizes resumed page offsets after a content change", () => {
    expect(
      planAwardRun({ ...award(10), segmentDuration: 15 }, now, 9).pages[0].page,
    ).toBe(1);
    expect(
      planAwardRun({ ...award(10), segmentDuration: 15 }, now, -1).pages[0]
        .page,
    ).toBe(3);
    expect(planAwardRun(award(), now, Number.NaN).pages[0].page).toBe(0);
  });

  it("does not plan empty, disabled, upcoming, or expired competitions", () => {
    const excluded: Award[] = [
      award(0),
      { ...award(), enabled: false },
      { ...award(), startsAt: "2026-11-20T00:00:00+08:00" },
      { ...award(), endsAt: now.toISOString() },
    ];
    for (const record of excluded)
      expect(planAwardRun(record, now, 9)).toEqual({ pages: [], nextPage: 0 });
  });

  it("accepts supported playback settings and rejects invalid effects, modes, and durations", () => {
    const parse = (changes: Record<string, unknown>) =>
      contentSchema.safeParse({
        ...defaultContent(),
        awards: [{ ...award(), ...changes }],
      });
    expect(
      parse({ effect: "spotlight", duration: 7, playbackMode: "continuous" })
        .success,
    ).toBe(true);
    expect(
      parse({
        effect: "reveal",
        playbackMode: "segmented",
        segmentDuration: 180,
      }).success,
    ).toBe(true);
    for (const changes of [
      { effect: "scroll" },
      { playbackMode: "infinite" },
      { duration: 4 },
      { duration: 61 },
      { duration: 7.5 },
      { segmentDuration: 14 },
      { segmentDuration: 181 },
      { segmentDuration: 30.5 },
    ])
      expect(parse(changes).success).toBe(false);
  });
});
