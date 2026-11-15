export type TeamCardTotals = {
  yellowCards: number;
  redCards: number;
};

export const CARD_TOTALS_SOURCE = {
  label: "FotMob World Cup 2026 team stats",
  url: "https://www.fotmob.com/leagues/77/stats/world-cup?season=2026",
  retrievedAt: "2026-07-21T02:56:01Z",
} as const;

// One-time totals copied directly from FotMob after the tournament. No card
// categories are combined or reinterpreted locally.
const TEAM_CARD_TOTALS: Record<string, TeamCardTotals> = {
  ALG: { yellowCards: 3, redCards: 0 },
  ARG: { yellowCards: 13, redCards: 1 },
  AUS: { yellowCards: 5, redCards: 0 },
  AUT: { yellowCards: 5, redCards: 0 },
  BEL: { yellowCards: 6, redCards: 1 },
  BIH: { yellowCards: 7, redCards: 1 },
  BRA: { yellowCards: 8, redCards: 0 },
  CAN: { yellowCards: 11, redCards: 0 },
  CIV: { yellowCards: 4, redCards: 0 },
  COD: { yellowCards: 6, redCards: 0 },
  COL: { yellowCards: 8, redCards: 0 },
  CPV: { yellowCards: 5, redCards: 0 },
  CRO: { yellowCards: 4, redCards: 0 },
  ECU: { yellowCards: 8, redCards: 1 },
  EGY: { yellowCards: 12, redCards: 0 },
  ENG: { yellowCards: 8, redCards: 1 },
  ESP: { yellowCards: 6, redCards: 0 },
  FRA: { yellowCards: 6, redCards: 0 },
  GER: { yellowCards: 3, redCards: 0 },
  GHA: { yellowCards: 6, redCards: 0 },
  JPN: { yellowCards: 4, redCards: 0 },
  MAR: { yellowCards: 7, redCards: 0 },
  MEX: { yellowCards: 4, redCards: 1 },
  NED: { yellowCards: 3, redCards: 0 },
  NOR: { yellowCards: 3, redCards: 0 },
  PAR: { yellowCards: 9, redCards: 1 },
  POR: { yellowCards: 7, redCards: 0 },
  RSA: { yellowCards: 5, redCards: 2 },
  SEN: { yellowCards: 3, redCards: 0 },
  SUI: { yellowCards: 6, redCards: 1 },
  SWE: { yellowCards: 5, redCards: 0 },
  USA: { yellowCards: 7, redCards: 1 },
};

export function getWorldCup2026CardTotals(teamCode?: string | null) {
  return teamCode ? TEAM_CARD_TOTALS[teamCode] : undefined;
}
