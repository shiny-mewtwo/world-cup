import {
  TournamentStandingsTable,
  type TournamentStandingsGame,
} from "@/components/tournament-standings-table";
import { getSiteSnapshot } from "@/lib/data";
import { formatLocalDateTime, formatStageLabel } from "@/lib/formatting";
import { getTeamTournamentMetrics } from "@/lib/tournament";
import {
  CARD_TOTALS_SOURCE,
  getWorldCup2026CardTotals,
} from "@/lib/world-cup-2026-card-totals";

export const dynamic = "force-static";

const GROUP_STAGE_NAMES = new Set(["GROUP_STAGE", "Group Stage"]);

export default async function StandingsPage() {
  const snapshot = await getSiteSnapshot();
  const teamsById = new Map(snapshot.teams.map((team) => [team.id, team]));
  const officialOrderItems = snapshot.officialOrder.flatMap((item) => {
    const team = teamsById.get(item.teamId);
    return team ? [{ ...item, team }] : [];
  });
  const metricsByTeam = getTeamTournamentMetrics(
    snapshot.groupTableRows,
    snapshot.matches,
  );

  const rows = officialOrderItems.flatMap((item) => {
    const metrics = metricsByTeam.get(item.teamId);
    const sourcedCards = getWorldCup2026CardTotals(item.team.code);

    if (!metrics) {
      return [];
    }

    const games = snapshot.matches
      .filter((match) => (
        match.status === "COMPLETED" &&
        (match.homeTeamId === item.teamId || match.awayTeamId === item.teamId) &&
        match.homeTeam &&
        match.awayTeam &&
        match.homeScore !== null &&
        match.awayScore !== null
      ))
      .sort((left, right) => right.kickoffAt.getTime() - left.kickoffAt.getTime())
      .map((match): TournamentStandingsGame => {
        const isHome = match.homeTeamId === item.teamId;
        const goalsFor = isHome ? match.homeScore! : match.awayScore!;
        const goalsAgainst = isHome ? match.awayScore! : match.homeScore!;
        const opponent = isHome ? match.awayTeam! : match.homeTeam!;
        const won = match.winnerTeamId
          ? match.winnerTeamId === item.teamId
          : goalsFor > goalsAgainst;
        const drawn = !match.winnerTeamId && goalsFor === goalsAgainst;
        const outcome = won ? "W" : drawn ? "D" : "L";
        const isGroupStage = GROUP_STAGE_NAMES.has(match.stage);
        const decidedOnPenalties =
          !isGroupStage && goalsFor === goalsAgainst && Boolean(match.winnerTeamId);

        return {
          id: match.id,
          dateLabel: formatLocalDateTime(match.kickoffAt),
          stageLabel: formatStageLabel(match.stage),
          opponent: {
            code: opponent.code,
            name: opponent.name,
          },
          resultLabel: `${outcome} ${goalsFor}–${goalsAgainst}${decidedOnPenalties ? " (pens.)" : ""}`,
          outcome,
          won: won ? 1 : 0,
          drawn: drawn ? 1 : 0,
          lost: !won && !drawn ? 1 : 0,
          goalsFor,
          goalsAgainst,
          goalDiff: goalsFor - goalsAgainst,
          points: won ? 3 : drawn && isGroupStage ? 1 : 0,
        };
      });

    return [{
      rank: item.rank,
      team: {
        code: item.team.code,
        name: item.team.name,
      },
      ...metrics,
      yellowCards: sourcedCards?.yellowCards ?? null,
      redCards: sourcedCards?.redCards ?? null,
      games,
    }];
  });

  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>World Cup standings</h1>
        <p>
          The final and third-place matches determine ranks 1–4. Ranks 5–32 are
          ordered by tournament points, then head-to-head, tournament goal
          difference, goals scored, goals allowed, fewer yellow cards, and fewer
          red cards.
        </p>
      </section>

      <section className="panel">
        <div className="section-heading standings-heading">
          <div>
            <h2>Official scoring order</h2>
            <p>
              Expand any team to see how each completed match contributes to its
              result and goal totals.
            </p>
            <p>
              Team card totals are copied directly from{" "}
              <a href={CARD_TOTALS_SOURCE.url} rel="noreferrer" target="_blank">
                FotMob
              </a>
              , retrieved July 20, 2026.
            </p>
          </div>
          {rows.length > 0 ? <span className="pill">{rows.length} teams ranked</span> : null}
        </div>

        {rows.length > 0 ? (
          <TournamentStandingsTable rows={rows} />
        ) : (
          <div className="standings-empty-state">
            <strong>The 1–32 scoring order is not available yet.</strong>
            <p>It will appear here once group play establishes the 32 qualified teams.</p>
          </div>
        )}
      </section>
    </div>
  );
}
