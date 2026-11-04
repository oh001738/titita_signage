import type { Award } from "@/types";
import { isActive } from "@/lib/time";
export function awardPages(awards: Award[], now: Date) {
  return awards
    .filter((award) => award.enabled && isActive(award, now))
    .flatMap((award) => {
      const size =
        award.layout === "individual" ? 1 : award.layout === "group" ? 6 : 3;
      const count = Math.ceil(award.recipients.length / size);
      return Array.from({ length: count }, (_, page) => ({
        award,
        page,
        count,
        recipients: award.recipients.slice(page * size, (page + 1) * size),
      }));
    });
}
