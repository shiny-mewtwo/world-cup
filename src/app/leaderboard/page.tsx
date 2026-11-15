import { LeaderboardTable } from "@/components/leaderboard-table";
import { LockInfoLabel } from "@/components/lock-info-label";
import { getLeaderboard, getSiteSnapshot } from "@/lib/data";

export default async function LeaderboardPage() {
  const [leaderboard, snapshot] = await Promise.all([getLeaderboard(), getSiteSnapshot()]);

  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>Official standings</h1>
        <p>
          Saved entries and scores from the 2026 pool. Sign-in and editing are closed.
        </p>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Entries ranked</span>
          <strong>{leaderboard.rows.length}</strong>
          <small>submitted boards on the leaderboard</small>
        </article>
        <article className="metric-card">
          <span>Entry lock</span>
          <strong>Closed</strong>
          <small>
            <LockInfoLabel lockAt={snapshot.lockInfo.lockAt} />
          </small>
        </article>
      </section>

      <LeaderboardTable rows={leaderboard.rows} showScoring={snapshot.lockInfo.isLocked} />
    </div>
  );
}
