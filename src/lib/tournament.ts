import {
  EntryStatus,
  type Entry,
  type GroupTableSnapshot,
  type OfficialQualifiedOrder,
  type TournamentMatch,
  type User,
} from "@prisma/client";

import { ENTRY_SIZE, FIELD_SIZE, OPENING_MATCH_LABEL } from "@/lib/constants";
import { formatLocalDateTime } from "@/lib/formatting";
import { getWorldCup2026CardTotals } from "@/lib/world-cup-2026-card-totals";

export type LockInfo = {
  lockAt: Date | null;
  isLocked: boolean;
  label: string;
};

export function getLockInfo(matches: Pick<TournamentMatch, "kickoffAt">[], now = new Date()): LockInfo {
  const firstMatch = matches
    .slice()
    .sort((left, right) => left.kickoffAt.getTime() - right.kickoffAt.getTime())[0];

  if (!firstMatch) {
    return {
      lockAt: null,
      isLocked: false,
      label: `${OPENING_MATCH_LABEL} not scheduled`,
    };
  }

  return {
    lockAt: firstMatch.kickoffAt,
    isLocked: now >= firstMatch.kickoffAt,
    label: `${OPENING_MATCH_LABEL}: ${formatLocalDateTime(firstMatch.kickoffAt, {
      includeWeekday: true,
    })}`,
  };
}

export function shouldRevealEntry({
  viewerId,
  ownerId,
  viewerRole,
  lockInfo,
}: {
  viewerId?: string | null;
  ownerId: string;
  viewerRole?: User["role"] | null;
  lockInfo: LockInfo;
}) {
  if (lockInfo.isLocked) {
    return true;
  }

  if (viewerRole === "ADMIN") {
    return true;
  }

  return viewerId === ownerId;
}

export function getEntryStatusLabel(entry: Pick<Entry, "status">) {
  if (entry.status === EntryStatus.INVALIDATED) {
    return "Invalidated";
  }

  if (entry.status === EntryStatus.DRAFT) {
    return "Draft";
  }

  if (entry.status === EntryStatus.LOCKED) {
    return "Locked";
  }

  return "Submitted";
}

export function buildEmptyRanks() {
  return Array.from({ length: ENTRY_SIZE }, (_, index) => ({
    rank: index + 1,
    teamId: "",
  }));
}

export function normalizeRanks(ranks: Array<{ rank: number; teamId: string }>) {
  return ranks
    .filter((item) => item.teamId)
    .sort((left, right) => left.rank - right.rank)
    .slice(0, ENTRY_SIZE);
}

export function getActiveOrder(order: (OfficialQualifiedOrder & {
  items: Array<{ rank: number; teamId: string }>;
}) | null) {
  return normalizeRanks(order?.items ?? []);
}

export function getEffectiveOfficialOrder(
  order: (OfficialQualifiedOrder & {
    items: Array<{ rank: number; teamId: string }>;
  }) | null,
  rows: GroupStandingRow[],
  matches: TournamentPointsMatch[],
) {
  const storedOrder = getActiveOrder(order);

  if (order?.source === "admin-override") {
    return storedOrder;
  }

  const computedOrder = buildQualifiedOrderFromStandings(rows, matches);
  return computedOrder.length >= ENTRY_SIZE ? computedOrder : storedOrder;
}

export type GroupStandingRow = Pick<
  GroupTableSnapshot,
  | "groupName"
  | "teamId"
  | "played"
  | "won"
  | "drawn"
  | "lost"
  | "points"
  | "goalsFor"
  | "goalsAgainst"
  | "goalDiff"
  | "yellowCards"
  | "redCards"
  | "rank"
> & {
  team?: { code: string | null } | null;
};

export type TournamentPointsMatch = Pick<
  TournamentMatch,
  "stage" | "status" | "homeTeamId" | "awayTeamId" | "homeScore" | "awayScore"
> & Partial<Pick<TournamentMatch, "winnerTeamId">>;

export type TeamTournamentStatus = {
  currentRank: number | null;
  currentRankLabel: string;
  status: "pending" | "dnq" | "active" | "eliminated";
  statusLabel: string;
};

const GROUP_STAGE_NAMES = new Set(["GROUP_STAGE", "Group Stage"]);
const FINAL_STAGE_NAMES = new Set(["FINAL", "Final"]);
const THIRD_PLACE_STAGE_NAMES = new Set([
  "THIRD_PLACE",
  "Third place",
  "Third Place",
]);

function compareTableRows(left: GroupStandingRow, right: GroupStandingRow) {
  return (
    right.points - left.points ||
    right.goalDiff - left.goalDiff ||
    right.goalsFor - left.goalsFor ||
    left.goalsAgainst - right.goalsAgainst ||
    left.yellowCards - right.yellowCards ||
    left.redCards - right.redCards ||
    left.groupName.localeCompare(right.groupName) ||
    left.rank - right.rank
  );
}

function isKnockoutMatch(match: TournamentPointsMatch) {
  return !GROUP_STAGE_NAMES.has(match.stage);
}

function getKnockoutPointsByTeam(matches: TournamentPointsMatch[]) {
  const pointsByTeam = new Map<string, number>();

  for (const match of matches) {
    if (
      match.status !== "COMPLETED" ||
      !isKnockoutMatch(match) ||
      !match.homeTeamId ||
      !match.awayTeamId ||
      match.homeScore === null ||
      match.awayScore === null
    ) {
      continue;
    }

    const winnerId = getMatchWinnerAndLoser(match)?.winnerId;

    if (!winnerId) {
      continue;
    }

    pointsByTeam.set(winnerId, (pointsByTeam.get(winnerId) ?? 0) + 3);
  }

  return pointsByTeam;
}

function getDecisiveCompletedMatch(
  matches: TournamentPointsMatch[],
  stageNames: Set<string>,
) {
  return matches.find((match) => (
    stageNames.has(match.stage) &&
    match.status === "COMPLETED" &&
    Boolean(match.homeTeamId) &&
    Boolean(match.awayTeamId) &&
    match.homeScore !== null &&
    match.awayScore !== null &&
    Boolean(getMatchWinnerAndLoser(match))
  ));
}

function getMatchWinnerAndLoser(match?: TournamentPointsMatch) {
  if (
    !match ||
    !match.homeTeamId ||
    !match.awayTeamId ||
    match.homeScore === null ||
    match.awayScore === null ||
    (match.homeScore === match.awayScore && !match.winnerTeamId)
  ) {
    return null;
  }

  if (match.winnerTeamId === match.homeTeamId) {
    return { winnerId: match.homeTeamId, loserId: match.awayTeamId };
  }

  if (match.winnerTeamId === match.awayTeamId) {
    return { winnerId: match.awayTeamId, loserId: match.homeTeamId };
  }

  return match.homeScore > match.awayScore
    ? { winnerId: match.homeTeamId, loserId: match.awayTeamId }
    : { winnerId: match.awayTeamId, loserId: match.homeTeamId };
}

function getFinalFourOrder(matches: TournamentPointsMatch[]) {
  const finalResult = getMatchWinnerAndLoser(
    getDecisiveCompletedMatch(matches, FINAL_STAGE_NAMES),
  );
  const thirdPlaceResult = getMatchWinnerAndLoser(
    getDecisiveCompletedMatch(matches, THIRD_PLACE_STAGE_NAMES),
  );

  if (!finalResult || !thirdPlaceResult) {
    return null;
  }

  const teamIds = [
    finalResult.winnerId,
    finalResult.loserId,
    thirdPlaceResult.winnerId,
    thirdPlaceResult.loserId,
  ];

  return new Set(teamIds).size === 4 ? teamIds : null;
}

export function getTeamTournamentPointTotals(
  rows: GroupStandingRow[],
  matches: TournamentPointsMatch[] = [],
) {
  const knockoutPointsByTeam = getKnockoutPointsByTeam(matches);
  const totalsByTeam = new Map<string, number>();

  for (const row of rows) {
    totalsByTeam.set(
      row.teamId,
      row.points + (knockoutPointsByTeam.get(row.teamId) ?? 0),
    );
  }

  return totalsByTeam;
}

export type TeamTournamentMetrics = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  yellowCards: number;
  redCards: number;
};

export function getTeamTournamentMetrics(
  rows: GroupStandingRow[],
  matches: TournamentPointsMatch[] = [],
) {
  const metricsByTeam = new Map<string, TeamTournamentMetrics>();

  for (const row of rows) {
    const sourcedCards = getWorldCup2026CardTotals(row.team?.code);

    metricsByTeam.set(row.teamId, {
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDiff: row.goalDiff,
      yellowCards: sourcedCards?.yellowCards ?? row.yellowCards,
      redCards: sourcedCards?.redCards ?? row.redCards,
    });
  }

  for (const match of matches) {
    if (
      match.status !== "COMPLETED" ||
      !isKnockoutMatch(match) ||
      !match.homeTeamId ||
      !match.awayTeamId ||
      match.homeScore === null ||
      match.awayScore === null
    ) {
      continue;
    }

    const declaredWinnerId = getMatchWinnerAndLoser(match)?.winnerId;

    for (const [teamId, goalsFor, goalsAgainst] of [
      [match.homeTeamId, match.homeScore, match.awayScore],
      [match.awayTeamId, match.awayScore, match.homeScore],
    ] as const) {
      const metrics = metricsByTeam.get(teamId);

      if (!metrics) {
        continue;
      }

      const won = declaredWinnerId ? declaredWinnerId === teamId : goalsFor > goalsAgainst;
      const drawn = !declaredWinnerId && goalsFor === goalsAgainst;
      metrics.played += 1;
      metrics.won += won ? 1 : 0;
      metrics.drawn += drawn ? 1 : 0;
      metrics.lost += !won && !drawn ? 1 : 0;
      metrics.points += won ? 3 : 0;
      metrics.goalsFor += goalsFor;
      metrics.goalsAgainst += goalsAgainst;
      metrics.goalDiff += goalsFor - goalsAgainst;
    }
  }

  return metricsByTeam;
}

function getHeadToHeadPointsByTeam(
  teamIds: Set<string>,
  matches: TournamentPointsMatch[],
) {
  const pointsByTeam = new Map(Array.from(teamIds, (teamId) => [teamId, 0]));

  for (const match of matches) {
    if (
      match.status !== "COMPLETED" ||
      !match.homeTeamId ||
      !match.awayTeamId ||
      !teamIds.has(match.homeTeamId) ||
      !teamIds.has(match.awayTeamId) ||
      match.homeScore === null ||
      match.awayScore === null
    ) {
      continue;
    }

    const result = getMatchWinnerAndLoser(match);

    if (result) {
      pointsByTeam.set(result.winnerId, (pointsByTeam.get(result.winnerId) ?? 0) + 3);
    } else if (GROUP_STAGE_NAMES.has(match.stage)) {
      pointsByTeam.set(match.homeTeamId, (pointsByTeam.get(match.homeTeamId) ?? 0) + 1);
      pointsByTeam.set(match.awayTeamId, (pointsByTeam.get(match.awayTeamId) ?? 0) + 1);
    }
  }

  return pointsByTeam;
}

function orderByTournamentTiebreakers(
  rows: GroupStandingRow[],
  metricsByTeam: Map<string, TeamTournamentMetrics>,
  matches: TournamentPointsMatch[],
) {
  const rowsByPoints = new Map<number, GroupStandingRow[]>();

  for (const row of rows) {
    const points = metricsByTeam.get(row.teamId)?.points ?? 0;
    const pointRows = rowsByPoints.get(points) ?? [];
    pointRows.push(row);
    rowsByPoints.set(points, pointRows);
  }

  return Array.from(rowsByPoints.entries())
    .sort(([leftPoints], [rightPoints]) => rightPoints - leftPoints)
    .flatMap(([, pointRows]) => {
      return pointRows.slice().sort((left, right) => {
        const leftMetrics = metricsByTeam.get(left.teamId);
        const rightMetrics = metricsByTeam.get(right.teamId);
        const headToHeadPoints = getHeadToHeadPointsByTeam(
          new Set([left.teamId, right.teamId]),
          matches,
        );

        return (
          (headToHeadPoints.get(right.teamId) ?? 0) -
            (headToHeadPoints.get(left.teamId) ?? 0) ||
          (rightMetrics?.goalDiff ?? 0) - (leftMetrics?.goalDiff ?? 0) ||
          (rightMetrics?.goalsFor ?? 0) - (leftMetrics?.goalsFor ?? 0) ||
          (leftMetrics?.goalsAgainst ?? 0) - (rightMetrics?.goalsAgainst ?? 0) ||
          (leftMetrics?.yellowCards ?? 0) - (rightMetrics?.yellowCards ?? 0) ||
          (leftMetrics?.redCards ?? 0) - (rightMetrics?.redCards ?? 0) ||
          left.groupName.localeCompare(right.groupName) ||
          left.rank - right.rank ||
          left.teamId.localeCompare(right.teamId)
        );
      });
    });
}

function hasKnockoutLoss(teamId: string, matches: TournamentPointsMatch[]) {
  return matches.some((match) => {
    if (
      match.status !== "COMPLETED" ||
      !isKnockoutMatch(match) ||
      !match.homeTeamId ||
      !match.awayTeamId ||
      match.homeScore === null ||
      match.awayScore === null
    ) {
      return false;
    }

    return getMatchWinnerAndLoser(match)?.loserId === teamId;
  });
}

export function getTeamTournamentStatus({
  teamId,
  officialOrder,
  matches,
}: {
  teamId: string;
  officialOrder: Array<{ rank: number; teamId: string }>;
  matches: TournamentPointsMatch[];
}): TeamTournamentStatus {
  const officialRank = officialOrder.find((item) => item.teamId === teamId)?.rank ?? null;

  if (officialRank === null) {
    if (officialOrder.length >= ENTRY_SIZE) {
      return {
        currentRank: null,
        currentRankLabel: "DNQ",
        status: "dnq",
        statusLabel: "Did not qualify",
      };
    }

    return {
      currentRank: null,
      currentRankLabel: "TBD",
      status: "pending",
      statusLabel: "Pending",
    };
  }

  if (hasKnockoutLoss(teamId, matches)) {
    return {
      currentRank: officialRank,
      currentRankLabel: `#${officialRank}`,
      status: "eliminated",
      statusLabel: "Eliminated",
    };
  }

  return {
    currentRank: officialRank,
    currentRankLabel: `#${officialRank}`,
    status: "active",
    statusLabel: "Still in",
  };
}

export function getRowsByGroup<T extends GroupStandingRow>(rows: T[]) {
  const groups = new Map<string, T[]>();

  rows.forEach((row) => {
    const groupRows = groups.get(row.groupName) ?? [];
    groupRows.push(row);
    groups.set(row.groupName, groupRows);
  });

  return Array.from(groups.entries()).map(([groupName, groupRows]) => ({
    groupName,
    rows: groupRows.slice().sort((left, right) => left.rank - right.rank),
  }));
}

export function isGroupStageComplete(rows: GroupStandingRow[]) {
  const groupedRows = getRowsByGroup(rows);

  return (
    groupedRows.length === FIELD_SIZE / 4 &&
    groupedRows.every(({ rows: groupRows }) => (
      groupRows.length === 4 &&
      groupRows.every((row) => row.played >= 3)
    ))
  );
}

export function buildQualifiedOrderFromStandings(
  rows: GroupStandingRow[],
  matches: TournamentPointsMatch[] = [],
) {
  if (!isGroupStageComplete(rows)) {
    return [];
  }

  const groupedRows = getRowsByGroup(rows);
  const groupWinners = groupedRows.flatMap(({ rows: groupRows }) =>
    groupRows.filter((row) => row.rank === 1),
  ).sort(compareTableRows);
  const groupRunnersUp = groupedRows.flatMap(({ rows: groupRows }) =>
    groupRows.filter((row) => row.rank === 2),
  ).sort(compareTableRows);
  const bestThirdPlaceTeams = groupedRows
    .flatMap(({ rows: groupRows }) => groupRows.filter((row) => row.rank === 3))
    .sort(compareTableRows)
    .slice(0, ENTRY_SIZE - groupWinners.length - groupRunnersUp.length);
  const qualifiedRows = [...groupWinners, ...groupRunnersUp, ...bestThirdPlaceTeams]
    .slice(0, ENTRY_SIZE);
  const metricsByTeam = getTeamTournamentMetrics(rows, matches);
  const finalFourOrder = getFinalFourOrder(matches);
  const finalFourRows = finalFourOrder
    ?.map((teamId) => qualifiedRows.find((row) => row.teamId === teamId))
    .filter((row): row is GroupStandingRow => Boolean(row)) ?? [];
  const pointRankedRows = orderByTournamentTiebreakers(
    finalFourOrder
      ? qualifiedRows.filter((row) => !finalFourOrder.includes(row.teamId))
      : qualifiedRows,
    metricsByTeam,
    matches,
  );
  const orderedRows = [...finalFourRows, ...pointRankedRows];

  return orderedRows.map((row, index) => ({
      rank: index + 1,
      teamId: row.teamId,
    }))
    .slice(0, ENTRY_SIZE);
}
