import type { CSSProperties } from "react";
import { Trophy, Music2 } from "lucide-react";
import type { Award } from "@/types";
import { awardEffect } from "@/lib/award-pages";
import styles from "./AwardDisplay.module.css";

interface AwardDisplayProps {
  award: Award;
  recipients: Award["recipients"];
  page: number;
  count: number;
  schoolName: string;
  logo?: string;
  fading: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
}

export function AwardDisplay({
  award,
  recipients,
  page,
  count,
  schoolName,
  logo,
  fading,
  paused = false,
  reducedMotion = false,
}: AwardDisplayProps) {
  const effect = awardEffect(award);
  const motionClass = [
    paused ? styles.paused : "",
    reducedMotion ? styles.reducedMotion : "",
  ].join(" ");

  if (effect === "classic") {
    return (
      <section
        className={`award-display ${fading ? "award-display-exit" : ""} ${motionClass}`}
        aria-label="榮耀時刻"
        data-effect="classic"
        data-page={page}
        data-award-id={award.id}
      >
        <div className="award-display-header">
          {logo ? (
            <img className="award-brand-logo" src={logo} alt={schoolName} />
          ) : (
            <span>
              <Music2 size={27} /> {schoolName}
            </span>
          )}
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
            <h1
              data-recipient-id={
                award.layout === "individual" ? recipients[0]?.id : undefined
              }
            >
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
                  <span key={r.id} data-recipient-id={r.id}>
                    {r.name}
                  </span>
                ))}
              </div>
            )}
            {award.layout === "competition" && (
              <div className="award-display-list">
                {recipients.map((r) => (
                  <div key={r.id} data-recipient-id={r.id}>
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

  const frameKey = `${award.id}:${page}:${recipients.map((r) => r.id).join(",")}`;
  const prizeFor = (person: Award["recipients"][number]) =>
    award.layout === "competition" ? person.prize : award.sharedPrize;
  // A long record uses one shared type scale across its cards, so peers retain
  // equal visual weight while all of their information can wrap naturally.
  const compactCards = recipients.some(
    (person) =>
      person.name.length > 10 ||
      prizeFor(person).length > 24 ||
      person.category.length > 30,
  );

  return (
    <section
      className={`award-display ${styles.stage} ${fading ? "award-display-exit" : ""} ${motionClass}`}
      aria-label="榮耀時刻"
      data-effect={effect}
      data-page={page}
      data-award-id={award.id}
    >
      <div className={styles.beam} aria-hidden="true" />
      <div className={styles.floorGlow} aria-hidden="true" />
      <header className={styles.header}>
        {logo ? (
          <img className={styles.logo} src={logo} alt={schoolName} />
        ) : (
          <div className={styles.brand}>
            <Music2 aria-hidden="true" />
            <span>{schoolName}</span>
          </div>
        )}
        <div className={styles.event}>
          <p className={styles.eyebrow}>SHINING MOMENTS · 榮耀時刻</p>
          <h2 className={award.competition.length > 32 ? styles.longEvent : ""}>
            {award.competition}
          </h2>
        </div>
      </header>
      <div className={`${styles.body} ${award.image ? styles.withPhoto : ""}`}>
        {award.image && (
          <div className={styles.photo}>
            <img src={award.image} alt="獲獎活動照片" />
          </div>
        )}
        {effect === "spotlight" ? (
          <div className={styles.hero} key={frameKey}>
            <Trophy
              className={styles.trophy}
              strokeWidth={1.2}
              aria-hidden="true"
            />
            <p className={styles.heroLabel}>恭喜得獎同學</p>
            {recipients.map((person) => (
              <div
                className={styles.heroPerson}
                key={person.id}
                data-recipient-id={person.id}
              >
                <h1
                  className={`${styles.heroName} ${person.name.length > 12 ? styles.longName : ""}`}
                  aria-label={person.name}
                >
                  {Array.from(person.name).map((letter, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      style={
                        { "--letter": Math.min(index, 7) } as CSSProperties
                      }
                    >
                      {letter}
                    </span>
                  ))}
                </h1>
                <div className={styles.heroRule} aria-hidden="true" />
                <p
                  className={`${styles.heroPrize} ${prizeFor(person).length > 24 ? styles.longPrize : ""}`}
                >
                  {prizeFor(person)}
                </p>
                {person.category && (
                  <p className={styles.heroCategory}>{person.category}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.reveal} key={frameKey}>
            <p className={styles.revealCaption}>每一份努力，都值得掌聲。</p>
            <div
              className={`${styles.cards} ${compactCards ? styles.compactCards : ""}`}
              data-compact={compactCards}
            >
              {recipients.map((person, index) => (
                <article
                  className={styles.card}
                  key={person.id}
                  data-recipient-id={person.id}
                  style={{ "--slot": index } as CSSProperties}
                >
                  <Music2
                    className={styles.cardIcon}
                    aria-hidden="true"
                    strokeWidth={1.2}
                  />
                  <h1 className={styles.cardName}>{person.name}</h1>
                  <p className={styles.cardPrize}>{prizeFor(person)}</p>
                  {person.category && (
                    <p className={styles.cardCategory}>{person.category}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={styles.meta}>
        <span>每一次努力，都值得被看見。</span>
        <span>
          第 {page + 1} / {count} 頁 · 共 {award.recipients.length} 位得獎同學
        </span>
      </div>
    </section>
  );
}
