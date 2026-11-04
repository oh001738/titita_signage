import { Trophy, Music2 } from "lucide-react";
import type { Award } from "@/types";
export function AwardDisplay({
  award,
  recipients,
  page,
  count,
  schoolName,
}: {
  award: Award;
  recipients: Award["recipients"];
  page: number;
  count: number;
  schoolName: string;
}) {
  return (
    <section className="award-display" aria-label="榮耀時刻">
      <div className="award-display-header">
        <span>
          <Music2 size={27} /> {schoolName}
        </span>
        <small>SHINING MOMENTS · 榮耀時刻</small>
      </div>
      <div className="award-display-main">
        <div className="award-display-image">
          {award.image ? (
            <img src={award.image} alt="得獎照片" />
          ) : (
            <Trophy size="32%" strokeWidth={1} />
          )}
        </div>
        <div className="award-display-copy">
          <span className="award-display-label">✦ 榮耀時刻 ✦</span>
          <h1>
            {award.layout === "individual"
              ? `恭喜 ${recipients[0]?.name ?? ""}`
              : "恭喜得獎同學"}
          </h1>
          <h2>{award.competition}</h2>
          {award.layout !== "competition" && (
            <div className="award-display-prize">{award.sharedPrize}</div>
          )}
          {award.layout === "group" && (
            <div className="award-display-names">
              {recipients.map((r) => (
                <span key={r.id}>{r.name}</span>
              ))}
            </div>
          )}
          {award.layout === "competition" && (
            <div className="award-display-list">
              {recipients.map((r) => (
                <div key={r.id}>
                  <strong>{r.name}</strong>
                  <span>
                    {[r.category, r.prize].filter(Boolean).join("・")}
                  </span>
                </div>
              ))}
            </div>
          )}
          {count > 1 && (
            <small className="award-display-counter">
              {page + 1} / {count}
            </small>
          )}
          <p>每一次努力，都值得被看見。</p>
        </div>
      </div>
    </section>
  );
}
