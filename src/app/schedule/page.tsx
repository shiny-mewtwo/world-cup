import { getSiteSnapshot } from "@/lib/data";
import { LocalDateTime } from "@/components/local-date-time";
import { LockInfoLabel } from "@/components/lock-info-label";
import { TeamLabel } from "@/components/team-label";
import { formatMatchStatus, formatStageLabel } from "@/lib/formatting";

export default async function SchedulePage() {
  const snapshot = await getSiteSnapshot();

  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>Match schedule</h1>
        <p>
          Kickoff times, venues, scores, and match states flow through the results provider.
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Match schedule</h2>
            <p>
              <LockInfoLabel lockAt={snapshot.lockInfo.lockAt} />
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table schedule-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Kickoff</th>
                <th>Stage</th>
                <th>Venue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.matches.map((match) => (
                <tr key={match.id}>
                  <td>
                    <div className="match-pairing">
                      {match.homeTeam ? <TeamLabel team={match.homeTeam} /> : "TBD"}
                      <span className="match-divider">vs</span>
                      {match.awayTeam ? <TeamLabel team={match.awayTeam} /> : "TBD"}
                    </div>
                  </td>
                  <td>
                    <LocalDateTime
                      isoDate={match.kickoffAt.toISOString()}
                      includeWeekday
                    />
                  </td>
                  <td>{match.groupName ? `Group ${match.groupName}` : formatStageLabel(match.stage)}</td>
                  <td>{match.venue ?? "TBD"}</td>
                  <td>{formatMatchStatus(match.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
