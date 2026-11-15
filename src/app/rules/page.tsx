import {
  RULE_SUMMARY,
  TIEBREAKER_DISCLAIMER,
  TIEBREAKER_NOTES,
} from "@/lib/constants";

export default function RulesPage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>How the pool works</h1>
        <p>
          This is a ranked-order pool rather than a traditional bracket. You are predicting the
          32 teams that reach the round of 32 and how they will rank in the official scoring
          order.
        </p>
      </section>

      <section className="card-grid">
        {RULE_SUMMARY.map((rule) => (
          <article className="panel feature-card" key={rule}>
            <p>{rule}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Official Order</h2>
            <p>
              The official order includes only round-of-32 teams and sorts them by total
              tournament points.
            </p>
          </div>
        </div>
        <div className="score-grid">
          <article className="score-card">
            <strong>3 points</strong>
            <span>Win</span>
          </article>
          <article className="score-card">
            <strong>1 point</strong>
            <span>Group draw</span>
          </article>
          <article className="score-card">
            <strong>0 points</strong>
            <span>Loss</span>
          </article>
        </div>
        <p className="muted-text note-block">
          Entry slots are scored against that official order: 3 points for exact rank, 2 points
          for one slot away, and 1 point for two slots away.
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Tiebreakers</h2>
            <p>
              These compare teams tied on total tournament points. Head-to-head and every
              statistical total include completed matches across the full tournament.
            </p>
          </div>
        </div>
        <ol className="plain-list numbered-list">
          {TIEBREAKER_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
        <p className="muted-text note-block">Note: {TIEBREAKER_DISCLAIMER}</p>
      </section>
    </div>
  );
}
