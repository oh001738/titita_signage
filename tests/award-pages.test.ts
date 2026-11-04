import { describe, expect, it } from "vitest";
import { defaultContent } from "@/lib/defaults";
import { contentSchema } from "@/lib/validation";
import { awardPages } from "@/lib/award-pages";
import type { Award } from "@/types";
const now = new Date("2026-11-05T12:00:00+08:00");
const award = (count: number): Award => ({
  id: "award-1",
  layout: "competition",
  competition: "音樂比賽",
  sharedPrize: "",
  image: "",
  enabled: true,
  duration: 15,
  startsAt: "",
  endsAt: "",
  recipients: Array.from({ length: count }, (_, i) => ({
    id: `person-${i}`,
    name: `學生${i}`,
    category: "鋼琴",
    prize: `獎項${i}`,
  })),
});
describe("award content", () => {
  it("accepts old content without awards", () => {
    const content = defaultContent();
    delete content.awards;
    expect(contentSchema.parse(content).awards).toEqual([]);
  });
  it("splits multi-award lists into pages and excludes disabled or expired records", () => {
    const pages = awardPages(
      [
        award(7),
        { ...award(1), id: "disabled", enabled: false },
        { ...award(1), id: "expired", endsAt: "2026-11-04T00:00:00+08:00" },
      ],
      now,
    );
    expect(pages.map((p) => p.recipients.length)).toEqual([3, 3, 1]);
    expect(pages.map((p) => p.page)).toEqual([0, 1, 2]);
    expect(pages.every((p) => p.count === 3)).toBe(true);
  });
  it("validates recipient names and prizes and accepts all three layouts", () => {
    const record = award(1);
    for (const layout of ["individual", "group", "competition"] as const) {
      expect(
        contentSchema.safeParse({
          ...defaultContent(),
          awards: [{ ...record, layout, sharedPrize: "第一名" }],
        }).success,
      ).toBe(true);
    }
    expect(
      contentSchema.safeParse({
        ...defaultContent(),
        awards: [
          { ...record, recipients: [{ ...record.recipients[0], prize: "" }] },
        ],
      }).success,
    ).toBe(false);
    expect(
      contentSchema.safeParse({
        ...defaultContent(),
        awards: [{ ...award(2), layout: "individual", sharedPrize: "第一名" }],
      }).success,
    ).toBe(false);
  });
});
