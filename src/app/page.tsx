import Link from "next/link";

import { LeaderboardTable } from "@/components/leaderboard-table";
import { TIEBREAKER_DISCLAIMER, TIEBREAKER_NOTES } from "@/lib/constants";
import { getLeaderboard, getSiteSnapshot } from "@/lib/data";

const HOME_MECHANICS = [
  {
    title: "Rank the scoring 32",
    detail:
      "Predict the teams that reach the round of 32 and where they land in the official scoring order.",
  },
  {
    title: "Use tournament points",
    detail:
      "The official order adds group-stage points and knockout wins, then applies tournament-wide tiebreakers.",
  },
  {
    title: "Score by distance",
    detail:
      "Each slot scores 3 points for exact, 2 points for one away, and 1 point for two away.",
  },
  {
    title: "Lock at kickoff",
    detail:
      "Entries were locked at the first World Cup kickoff. Saved predictions are preserved here.",
  },
];

export default async function Home() {
  const [{ rows }, snapshot] = await Promise.all([
    getLeaderboard(),
    getSiteSnapshot(),
  ]);

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">2026 men&apos;s World Cup</span>
          <h1>Honest Scottie&apos;s 12th World Cup Pool.</h1>
          <p>
            An archive of Scottie&apos;s 2026 World Cup pool. Browse the saved
            predictions, standings, and match results.
          </p>
          <div className="button-row">
            <Link className="button" href="/leaderboard">
              View the leaderboard
            </Link>
            <Link className="button button-secondary" href="/rules">
              Read the rules
            </Link>
          </div>
        </div>

        <aside className="hero-aside">
          <div className="hero-status-card">
            <span className="eyebrow">2026 archive</span>
            <strong>Read-only archive</strong>
            <p>
              Sign-in and editing are closed. The saved records remain available to explore.
            </p>
          </div>

          <div className="hero-facts">
            <article>
              <span>32 ranked slots</span>
              <p>
                Each entry ranked the teams expected to reach the round of 32.
              </p>
            </article>
            <article>
              <span>3-2-1 scoring</span>
              <p>Exact official-order picks score highest, and near misses still matter.</p>
            </article>
            <article>
              <span>Saved standings</span>
              <p>Browse scores based on the saved official order.</p>
            </article>
          </div>
        </aside>
      </section>

      <section className="card-grid">
        {HOME_MECHANICS.map((item) => (
          <article className="panel feature-card" key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Tiebreakers</h2>
            <p>These are used if entries end on the same score.</p>
          </div>
        </div>
        <ol className="plain-list numbered-list">
          {TIEBREAKER_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
        <p className="muted-text note-block">Note: {TIEBREAKER_DISCLAIMER}</p>
      </section>

      <LeaderboardTable rows={rows.slice(0, 10)} showScoring={snapshot.lockInfo.isLocked} />
    </div>
  );
}
