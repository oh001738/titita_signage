import type { Award } from "@/types";
import { isActive } from "@/lib/time";

export interface AwardPage {
  award: Award;
  page: number;
  count: number;
  recipients: Award["recipients"];
}

export function awardEffect(award: Award): NonNullable<Award["effect"]> {
  return (
    award.effect ?? (award.layout === "competition" ? "reveal" : "classic")
  );
}

export function awardPages(awards: Award[], now: Date): AwardPage[] {
  return awards
    .filter((award) => award.enabled && isActive(award, now))
    .flatMap((award) => {
      const effect = awardEffect(award);
      const size =
        effect === "spotlight"
          ? 1
          : effect === "reveal"
            ? 3
            : award.layout === "individual"
              ? 1
              : award.layout === "group"
                ? 6
                : 3;
      const count = Math.ceil(award.recipients.length / size);
      return Array.from({ length: count }, (_, page) => ({
        award,
        page,
        count,
        recipients: award.recipients.slice(page * size, (page + 1) * size),
      }));
    });
}

/** Plan one uninterrupted award interlude, preserving complete student pages. */
export function planAwardRun(
  award: Award,
  now: Date,
  startPage = 0,
): { pages: AwardPage[]; nextPage: number } {
  const pages = awardPages([award], now);
  if (pages.length === 0) return { pages: [], nextPage: 0 };
  if (award.playbackMode === "continuous") return { pages, nextPage: 0 };

  const start = Number.isFinite(startPage)
    ? ((Math.trunc(startPage) % pages.length) + pages.length) % pages.length
    : 0;
  // A slow page still gets a complete turn even when it exceeds the target.
  const pageLimit = Math.max(
    1,
    Math.floor((award.segmentDuration ?? 45) / award.duration),
  );
  const end = Math.min(pages.length, start + pageLimit);
  return {
    pages: pages.slice(start, end),
    nextPage: end === pages.length ? 0 : end,
  };
}
