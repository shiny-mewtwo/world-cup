"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { TeamLabel } from "@/components/team-label";

export type TournamentStandingsGame = {
  id: string;
  dateLabel: string;
  stageLabel: string;
  opponent: {
    code: string | null;
    name: string;
  };
  resultLabel: string;
  outcome: "W" | "D" | "L";
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

export type TournamentStandingsRow = {
  rank: number;
  team: {
    code: string | null;
    name: string;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
  goalsFor: number;
  goalsAgainst: number;
  yellowCards: number | null;
  redCards: number | null;
  games: TournamentStandingsGame[];
};

export function TournamentStandingsTable({ rows }: { rows: TournamentStandingsRow[] }) {
  const [expandedTeamRank, setExpandedTeamRank] = useState<number | null>(null);

  return (
    <div className="table-wrap">
      <table className="data-table tournament-standings-table">
        <thead>
          <tr>
            <th className="expand-column"><span className="sr-only">Match history</span></th>
            <th className="table-number">Rank</th>
            <th>Team</th>
            <th className="table-number">P</th>
            <th className="table-number">W</th>
            <th className="table-number">D</th>
            <th className="table-number">L</th>
            <th className="table-number">Pts</th>
            <th className="table-number">GD</th>
            <th className="table-number">GF</th>
            <th className="table-number">GA</th>
            <th className="table-number"><abbr title="Yellow cards">YC</abbr></th>
            <th className="table-number"><abbr title="Red cards">RC</abbr></th>
          </tr>
        </thead>
        {rows.map((row) => {
          const isExpanded = expandedTeamRank === row.rank;
          const historyId = `team-match-history-${row.rank}`;

          return (
            <tbody className={isExpanded ? "standings-team-expanded" : undefined} key={row.rank}>
              <tr>
                <td className="expand-column">
                  <button
                    aria-controls={historyId}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Hide" : "Show"} ${row.team.name} match history`}
                    className="standings-expand-button"
                    onClick={() => setExpandedTeamRank(isExpanded ? null : row.rank)}
                    type="button"
                  >
                    <ChevronDown aria-hidden="true" size={17} />
                  </button>
                </td>
                <td className="table-number standings-rank">{row.rank}</td>
                <td><TeamLabel team={row.team} /></td>
                <td className="table-number">{row.played}</td>
                <td className="table-number">{row.won}</td>
                <td className="table-number">{row.drawn}</td>
                <td className="table-number">{row.lost}</td>
                <td className="table-number standings-points">{row.points}</td>
                <td className="table-number">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                <td className="table-number">{row.goalsFor}</td>
                <td className="table-number">{row.goalsAgainst}</td>
                <td className="table-number">{row.yellowCards ?? "—"}</td>
                <td className="table-number">{row.redCards ?? "—"}</td>
              </tr>
              {isExpanded ? (
                <tr className="standings-history-row" id={historyId}>
                  <td colSpan={13}>
                    <div className="standings-history">
                      <div className="standings-history-heading">
                        <strong>Match contributions</strong>
                        <span>Each completed match’s contribution to result and goal totals.</span>
                      </div>
                      {row.games.length > 0 ? (
                        <div className="table-wrap standings-history-table-wrap">
                          <table className="data-table compact-table standings-history-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Stage</th>
                                <th>Opponent</th>
                                <th>Result</th>
                                <th className="table-number">W</th>
                                <th className="table-number">D</th>
                                <th className="table-number">L</th>
                                <th className="table-number">Pts</th>
                                <th className="table-number">GD</th>
                                <th className="table-number">GF</th>
                                <th className="table-number">GA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.games.map((game) => (
                                <tr key={game.id}>
                                  <td>{game.dateLabel}</td>
                                  <td>{game.stageLabel}</td>
                                  <td><TeamLabel team={game.opponent} /></td>
                                  <td><span className={`match-outcome match-outcome-${game.outcome.toLowerCase()}`}>{game.resultLabel}</span></td>
                                  <td className="table-number">{game.won}</td>
                                  <td className="table-number">{game.drawn}</td>
                                  <td className="table-number">{game.lost}</td>
                                  <td className="table-number standings-points">{game.points}</td>
                                  <td className="table-number">{game.goalDiff > 0 ? `+${game.goalDiff}` : game.goalDiff}</td>
                                  <td className="table-number">{game.goalsFor}</td>
                                  <td className="table-number">{game.goalsAgainst}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="standings-history-empty">No completed match details are available yet.</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
