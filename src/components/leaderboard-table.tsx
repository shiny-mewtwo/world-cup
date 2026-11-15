import Link from "next/link";

type LeaderboardRow = {
  id: string;
  rank: number;
  entrantName: string;
  ro32QualifiedCount: number;
  score: {
    points: number;
    officialSlotsPublished: number;
  };
};

export function LeaderboardTable({
  rows,
  showScoring,
}: {
  rows: LeaderboardRow[];
  showScoring: boolean;
}) {
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <h2>Official leaderboard</h2>
          <p>Saved entries ranked against the archived official order.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Entrant</th>
              <th>RO32</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{showScoring ? row.rank : "—"}</td>
                <td>
                  <Link href={`/entries/${row.id}`}>
                    <strong>{row.entrantName}</strong>
                  </Link>
                </td>
                <td>{showScoring ? `${row.ro32QualifiedCount}/32` : "—"}</td>
                <td>{showScoring ? row.score.points : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
