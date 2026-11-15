import { MatchStatus } from "@prisma/client";

export type FootballDataTeam = {
  id?: number | string | null;
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
  statistics?: FootballDataTeamStatistics | null;
};

export type FootballDataScore = {
  winner?: string | null;
  duration?: string | null;
  fullTime?: {
    home?: number | null;
    away?: number | null;
  } | null;
  penalties?: {
    home?: number | null;
    away?: number | null;
  } | null;
};

export type FootballDataTeamStatistics = {
  yellow_cards?: number | null;
  yellow_red_cards?: number | null;
  red_cards?: number | null;
};

export type FootballDataBooking = {
  team?: {
    id?: number | string | null;
    name?: string | null;
  } | null;
  card?: string | null;
};

const COMPLETED_STATUSES = new Set(["FINISHED"]);
const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "PAUSED"]);
const WORLD_CUP_2026_GROUPS = new Set(
  Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index)),
);

export function footballDataId(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

export function normalizeFootballDataGroupName(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const groupName = trimmed.replace(/^GROUP[_\s-]*/i, "").replace(/^Group\s+/i, "");

  return WORLD_CUP_2026_GROUPS.has(groupName) ? groupName : null;
}

export function footballDataTeamCode(team: FootballDataTeam) {
  const tla = team.tla?.trim();

  if (tla) {
    return tla.toUpperCase();
  }

  const externalId = footballDataId(team.id);

  if (externalId) {
    return `FD${externalId}`;
  }

  return null;
}

export function parseFootballDataDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function mapFootballDataMatchStatus(value: string | null | undefined) {
  const status = value?.toUpperCase();

  if (!status) {
    return MatchStatus.SCHEDULED;
  }

  if (COMPLETED_STATUSES.has(status)) {
    return MatchStatus.COMPLETED;
  }

  if (LIVE_STATUSES.has(status)) {
    return MatchStatus.LIVE;
  }

  return MatchStatus.SCHEDULED;
}

export function extractFootballDataScores(score: FootballDataScore | null | undefined) {
  const homeScore = score?.fullTime?.home ?? null;
  const awayScore = score?.fullTime?.away ?? null;

  if (score?.duration === "PENALTY_SHOOTOUT") {
    const homePenalties = score.penalties?.home;
    const awayPenalties = score.penalties?.away;

    return {
      homeScore:
        homeScore !== null && typeof homePenalties === "number"
          ? homeScore - homePenalties
          : homeScore,
      awayScore:
        awayScore !== null && typeof awayPenalties === "number"
          ? awayScore - awayPenalties
          : awayScore,
    };
  }

  return {
    homeScore,
    awayScore,
  };
}

export function extractFootballDataWinnerSide(score: FootballDataScore | null | undefined) {
  if (score?.winner === "HOME_TEAM") {
    return "home";
  }

  if (score?.winner === "AWAY_TEAM") {
    return "away";
  }

  return null;
}

export function extractFootballDataCardTotals({
  team,
  bookings,
}: {
  team: FootballDataTeam | null | undefined;
  bookings: FootballDataBooking[] | null | undefined;
}) {
  const yellowCards = team?.statistics?.yellow_cards;
  const redCards = team?.statistics?.red_cards;
  const yellowRedCards = team?.statistics?.yellow_red_cards;

  if (
    typeof yellowCards === "number" ||
    typeof redCards === "number" ||
    typeof yellowRedCards === "number"
  ) {
    return {
      yellowCards: yellowCards ?? 0,
      redCards: (redCards ?? 0) + (yellowRedCards ?? 0),
    };
  }

  const externalId = footballDataId(team?.id);

  if (!externalId || !Array.isArray(bookings)) {
    return {
      yellowCards: 0,
      redCards: 0,
    };
  }

  return bookings.reduce(
    (totals, booking) => {
      if (footballDataId(booking.team?.id) !== externalId) {
        return totals;
      }

      const card = booking.card?.toUpperCase();

      if (card === "YELLOW") {
        totals.yellowCards += 1;
      }

      if (card === "RED" || card === "YELLOW_RED") {
        totals.redCards += 1;
      }

      return totals;
    },
    {
      yellowCards: 0,
      redCards: 0,
    },
  );
}
