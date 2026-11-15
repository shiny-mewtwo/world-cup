import { EntryStatus, MatchStatus, Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ENTRY_SIZE, OPENING_MATCH_LABEL } from "@/lib/constants";

import {
  buildEmptyRanks,
  buildQualifiedOrderFromStandings,
  getActiveOrder,
  getEntryStatusLabel,
  getEffectiveOfficialOrder,
  getLockInfo,
  getTeamTournamentStatus,
  getTeamTournamentMetrics,
  getTeamTournamentPointTotals,
  normalizeRanks,
  shouldRevealEntry,
  type GroupStandingRow,
  type TournamentPointsMatch,
} from "./tournament";

function standingRow(
  groupName: string,
  rank: number,
  overrides: Partial<GroupStandingRow> = {},
): GroupStandingRow {
  return {
    groupName,
    teamId: `${groupName}-${rank}`,
    played: 3,
    won: 1,
    drawn: 0,
    lost: 2,
    points: 3,
    goalsFor: 3,
    goalsAgainst: 3,
    goalDiff: 0,
    yellowCards: 0,
    redCards: 0,
    rank,
    ...overrides,
  };
}

function completeRows(overrides: Record<string, Partial<GroupStandingRow>> = {}) {
  return Array.from({ length: 12 }, (_, groupIndex) =>
    String.fromCharCode(65 + groupIndex),
  ).flatMap((groupName) =>
    [1, 2, 3, 4].map((rank) =>
      standingRow(groupName, rank, overrides[`${groupName}-${rank}`]),
    ),
  );
}

function knockoutMatch(overrides: Partial<TournamentPointsMatch>): TournamentPointsMatch {
  return {
    stage: "LAST_32",
    status: MatchStatus.COMPLETED,
    homeTeamId: "A-1",
    awayTeamId: "B-2",
    homeScore: 1,
    awayScore: 0,
    ...overrides,
  };
}

describe("getLockInfo", () => {
  it("keeps entries open when the tournament has no scheduled matches", () => {
    expect(getLockInfo([])).toEqual({
      lockAt: null,
      isLocked: false,
      label: `${OPENING_MATCH_LABEL} not scheduled`,
    });
  });

  it("uses the earliest kickoff as the lock time regardless of match order", () => {
    const firstKickoff = new Date("2026-06-11T19:00:00.000Z");
    const laterKickoff = new Date("2026-06-12T19:00:00.000Z");

    const lockInfo = getLockInfo(
      [{ kickoffAt: laterKickoff }, { kickoffAt: firstKickoff }],
      new Date("2026-06-11T18:59:59.000Z"),
    );

    expect(lockInfo.lockAt).toBe(firstKickoff);
    expect(lockInfo.isLocked).toBe(false);
    expect(lockInfo.label).toContain(`${OPENING_MATCH_LABEL}:`);
    expect(lockInfo.label).toContain("Jun 11, 2026");
  });

  it("locks exactly when the first kickoff time is reached", () => {
    const kickoffAt = new Date("2026-06-11T19:00:00.000Z");

    expect(getLockInfo([{ kickoffAt }], kickoffAt).isLocked).toBe(true);
  });
});

describe("shouldRevealEntry", () => {
  const unlocked = {
    lockAt: new Date("2026-06-11T19:00:00.000Z"),
    isLocked: false,
    label: "open",
  };
  const locked = { ...unlocked, isLocked: true };

  it("reveals all entries after lock", () => {
    expect(
      shouldRevealEntry({
        viewerId: "viewer",
        ownerId: "owner",
        viewerRole: Role.ENTRANT,
        lockInfo: locked,
      }),
    ).toBe(true);
  });

  it("reveals unlocked entries to admins and owners only", () => {
    expect(
      shouldRevealEntry({
        viewerId: "admin",
        ownerId: "owner",
        viewerRole: "ADMIN",
        lockInfo: unlocked,
      }),
    ).toBe(true);
    expect(
      shouldRevealEntry({
        viewerId: "owner",
        ownerId: "owner",
        viewerRole: Role.ENTRANT,
        lockInfo: unlocked,
      }),
    ).toBe(true);
    expect(
      shouldRevealEntry({
        viewerId: "viewer",
        ownerId: "owner",
        viewerRole: Role.ENTRANT,
        lockInfo: unlocked,
      }),
    ).toBe(false);
  });
});

describe("entry rank helpers", () => {
  it("creates one blank pick for every entry rank", () => {
    const ranks = buildEmptyRanks();

    expect(ranks).toHaveLength(ENTRY_SIZE);
    expect(ranks[0]).toEqual({ rank: 1, teamId: "" });
    expect(ranks.at(-1)).toEqual({ rank: ENTRY_SIZE, teamId: "" });
  });

  it("drops empty teams, sorts by rank, and limits to entry size", () => {
    const ranks = [
      { rank: 3, teamId: "third" },
      { rank: 1, teamId: "first" },
      { rank: 2, teamId: "" },
      ...Array.from({ length: ENTRY_SIZE + 2 }, (_, index) => ({
        rank: index + 4,
        teamId: `team-${index}`,
      })),
    ];

    const normalized = normalizeRanks(ranks);

    expect(normalized).toHaveLength(ENTRY_SIZE);
    expect(normalized.slice(0, 2)).toEqual([
      { rank: 1, teamId: "first" },
      { rank: 3, teamId: "third" },
    ]);
    expect(normalized.at(-1)).toEqual({
      rank: ENTRY_SIZE + 1,
      teamId: `team-${ENTRY_SIZE - 3}`,
    });
  });

  it("normalizes the current official order when one exists", () => {
    expect(
      getActiveOrder({
        id: "order-1",
        source: "test",
        notes: null,
        isActive: true,
        publishedAt: new Date("2026-07-01T00:00:00.000Z"),
        items: [
          { rank: 2, teamId: "second" },
          { rank: 1, teamId: "first" },
          { rank: 3, teamId: "" },
        ],
      }),
    ).toEqual([
      { rank: 1, teamId: "first" },
      { rank: 2, teamId: "second" },
    ]);
    expect(getActiveOrder(null)).toEqual([]);
  });
});

describe("getEntryStatusLabel", () => {
  it("labels all known entry statuses", () => {
    expect(getEntryStatusLabel({ status: EntryStatus.INVALIDATED })).toBe(
      "Invalidated",
    );
    expect(getEntryStatusLabel({ status: EntryStatus.DRAFT })).toBe("Draft");
    expect(getEntryStatusLabel({ status: EntryStatus.LOCKED })).toBe("Locked");
    expect(getEntryStatusLabel({ status: EntryStatus.SUBMITTED })).toBe(
      "Submitted",
    );
  });
});

describe("buildQualifiedOrderFromStandings", () => {
  it("does not publish before every group is complete", () => {
    const rows = completeRows({
      "A-1": {
        played: 2,
      },
    });

    expect(buildQualifiedOrderFromStandings(rows)).toEqual([]);
  });

  it("orders the 32 qualifiers by tournament points and requested statistical tiebreakers", () => {
    const rows = completeRows({
      "A-1": { points: 9, goalDiff: 6 },
      "B-1": { points: 7, goalDiff: 5 },
      "A-3": { points: 4, goalDiff: 1, yellowCards: 1, redCards: 0 },
      "B-3": { points: 4, goalDiff: 1, yellowCards: 1, redCards: 1 },
      "C-3": { points: 4, goalDiff: 1, yellowCards: 2, redCards: 0 },
      "K-3": { points: 1, goalDiff: -3 },
      "L-3": { points: 0, goalDiff: -4 },
    });

    const order = buildQualifiedOrderFromStandings(rows);

    expect(order).toHaveLength(32);
    expect(order[0]).toEqual({ rank: 1, teamId: "A-1" });
    expect(order[1]).toEqual({ rank: 2, teamId: "B-1" });
    expect(order[2]).toEqual({ rank: 3, teamId: "A-3" });
    expect(order[3]).toEqual({ rank: 4, teamId: "B-3" });
    expect(order[4]).toEqual({ rank: 5, teamId: "C-3" });
    expect(order.map((item) => item.teamId)).not.toContain("K-3");
    expect(order.map((item) => item.teamId)).not.toContain("L-3");
  });

  it("adds knockout wins to qualified teams and ignores losses or drawn knockout scores", () => {
    const rows = completeRows({
      "A-1": { points: 9, goalDiff: 6 },
      "D-2": { points: 3, goalDiff: 0 },
    });

    const order = buildQualifiedOrderFromStandings(rows, [
      knockoutMatch({ homeTeamId: "D-2", awayTeamId: "B-2", homeScore: 2, awayScore: 1 }),
      knockoutMatch({ homeTeamId: "D-2", awayTeamId: "C-2", homeScore: 1, awayScore: 0 }),
      knockoutMatch({ homeTeamId: "E-2", awayTeamId: "D-2", homeScore: 0, awayScore: 3 }),
      knockoutMatch({ homeTeamId: "A-2", awayTeamId: "B-3", homeScore: 1, awayScore: 1 }),
      knockoutMatch({ homeTeamId: "A-1", awayTeamId: "C-1", status: MatchStatus.SCHEDULED }),
      knockoutMatch({ stage: "GROUP_STAGE", homeTeamId: "B-1", awayTeamId: "C-1" }),
    ]);

    expect(order[0]).toEqual({ rank: 1, teamId: "D-2" });
    expect(order[1]).toEqual({ rank: 2, teamId: "A-1" });
    expect(order.find((item) => item.teamId === "A-2")?.rank).toBeGreaterThan(2);
    expect(order.find((item) => item.teamId === "B-1")?.rank).toBeGreaterThan(2);
  });

  it("uses head-to-head before tournament-wide statistical tiebreakers", () => {
    const rows = completeRows({
      "A-2": { points: 4, goalDiff: 0, goalsFor: 2, goalsAgainst: 2 },
      "B-2": { points: 4, goalDiff: 0, goalsFor: 2, goalsAgainst: 2 },
    });
    const order = buildQualifiedOrderFromStandings(rows, [
      knockoutMatch({
        stage: "GROUP_STAGE",
        homeTeamId: "A-2",
        awayTeamId: "B-2",
        homeScore: 0,
        awayScore: 1,
      }),
    ]);

    expect(order.find((item) => item.teamId === "B-2")!.rank).toBeLessThan(
      order.find((item) => item.teamId === "A-2")!.rank,
    );
  });

  it("does not treat teams from different groups as one head-to-head mini-table", () => {
    const rows = completeRows({
      "A-2": { points: 4, goalDiff: 0, goalsFor: 2, goalsAgainst: 2 },
      "B-2": { points: 4, goalDiff: 0, goalsFor: 2, goalsAgainst: 2 },
      "C-2": { points: 4, goalDiff: 2, goalsFor: 4, goalsAgainst: 2 },
    });
    const order = buildQualifiedOrderFromStandings(rows, [
      knockoutMatch({
        stage: "GROUP_STAGE",
        homeTeamId: "A-2",
        awayTeamId: "B-2",
        homeScore: 1,
        awayScore: 0,
      }),
    ]);

    expect(order.find((item) => item.teamId === "C-2")!.rank).toBeLessThan(
      order.find((item) => item.teamId === "A-2")!.rank,
    );
    expect(order.find((item) => item.teamId === "A-2")!.rank).toBeLessThan(
      order.find((item) => item.teamId === "B-2")!.rank,
    );
  });

  it("uses tournament-wide goal difference for teams level on points", () => {
    const rows = completeRows({
      "D-2": { points: 4, goalDiff: 0, goalsFor: 2, goalsAgainst: 2 },
      "E-2": { points: 4, goalDiff: 0, goalsFor: 2, goalsAgainst: 2 },
      "L-2": { points: 4, goalDiff: 0, goalsFor: 2, goalsAgainst: 2 },
    });
    const order = buildQualifiedOrderFromStandings(rows, [
      knockoutMatch({
        homeTeamId: "D-2",
        awayTeamId: "K-3",
        homeScore: 0,
        awayScore: 2,
      }),
      knockoutMatch({
        homeTeamId: "E-2",
        awayTeamId: "K-2",
        homeScore: 0,
        awayScore: 2,
      }),
      knockoutMatch({
        homeTeamId: "L-2",
        awayTeamId: "J-2",
        homeScore: 0,
        awayScore: 1,
      }),
    ]);

    const ghanaStyleRank = order.find((item) => item.teamId === "L-2")!.rank;
    expect(ghanaStyleRank).toBeLessThan(
      order.find((item) => item.teamId === "D-2")!.rank,
    );
    expect(ghanaStyleRank).toBeLessThan(
      order.find((item) => item.teamId === "E-2")!.rank,
    );
  });

  it("uses the final and third-place results for ranks 1 through 4", () => {
    const rows = completeRows({
      "A-1": { points: 9, goalDiff: 10 },
      "B-1": { points: 8, goalDiff: 8 },
      "C-1": { points: 7, goalDiff: 6 },
      "D-1": { points: 6, goalDiff: 4 },
      "E-1": { points: 9, goalDiff: 9 },
    });
    const order = buildQualifiedOrderFromStandings(rows, [
      knockoutMatch({
        stage: "FINAL",
        homeTeamId: "D-1",
        awayTeamId: "C-1",
        homeScore: 2,
        awayScore: 1,
      }),
      knockoutMatch({
        stage: "THIRD_PLACE",
        homeTeamId: "B-1",
        awayTeamId: "A-1",
        homeScore: 0,
        awayScore: 3,
      }),
    ]);

    expect(order.slice(0, 5)).toEqual([
      { rank: 1, teamId: "D-1" },
      { rank: 2, teamId: "C-1" },
      { rank: 3, teamId: "A-1" },
      { rank: 4, teamId: "B-1" },
      { rank: 5, teamId: "E-1" },
    ]);
  });

  it("uses declared penalty winners for placement and tournament points", () => {
    const rows = completeRows({
      "A-1": { points: 9 },
      "B-1": { points: 8 },
      "C-1": { points: 7 },
      "D-1": { points: 6 },
    });
    const matches = [
      knockoutMatch({
        stage: "FINAL",
        homeTeamId: "D-1",
        awayTeamId: "A-1",
        homeScore: 1,
        awayScore: 1,
        winnerTeamId: "D-1",
      }),
      knockoutMatch({
        stage: "THIRD_PLACE",
        homeTeamId: "C-1",
        awayTeamId: "B-1",
        homeScore: 2,
        awayScore: 2,
        winnerTeamId: "B-1",
      }),
    ];

    expect(buildQualifiedOrderFromStandings(rows, matches).slice(0, 4)).toEqual([
      { rank: 1, teamId: "D-1" },
      { rank: 2, teamId: "A-1" },
      { rank: 3, teamId: "B-1" },
      { rank: 4, teamId: "C-1" },
    ]);
    expect(getTeamTournamentPointTotals(rows, matches).get("D-1")).toBe(9);
  });

  it("keeps point order until both placement matches are complete", () => {
    const rows = completeRows({
      "A-1": { points: 9, goalDiff: 10 },
      "D-1": { points: 3, goalDiff: 0 },
    });
    const order = buildQualifiedOrderFromStandings(rows, [
      knockoutMatch({
        stage: "FINAL",
        homeTeamId: "D-1",
        awayTeamId: "A-1",
        homeScore: 2,
        awayScore: 1,
      }),
    ]);

    expect(order[0]).toEqual({ rank: 1, teamId: "A-1" });
  });
});

describe("getEffectiveOfficialOrder", () => {
  const storedOrder = {
    id: "stored-order",
    source: "football-data",
    notes: null,
    isActive: true,
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    items: [
      { rank: 1, teamId: "B-1" },
      { rank: 2, teamId: "A-1" },
    ],
  };

  it("recomputes automatically generated orders from current tournament data", () => {
    const rows = completeRows({
      "A-1": { points: 9, goalDiff: 5 },
      "B-1": { points: 7, goalDiff: 3 },
    });

    expect(getEffectiveOfficialOrder(storedOrder, rows, [])[0]).toEqual({
      rank: 1,
      teamId: "A-1",
    });
  });

  it("preserves a manual admin override", () => {
    expect(getEffectiveOfficialOrder(
      { ...storedOrder, source: "admin-override" },
      completeRows(),
      [],
    )).toEqual(storedOrder.items);
  });
});

describe("getTeamTournamentPointTotals", () => {
  it("adds group-stage points and completed knockout wins by team", () => {
    const rows = [
      standingRow("A", 1, { teamId: "A-1", points: 7 }),
      standingRow("B", 2, { teamId: "B-2", points: 4 }),
    ];
    const totals = getTeamTournamentPointTotals(rows, [
      knockoutMatch({ homeTeamId: "A-1", awayTeamId: "B-2", homeScore: 2, awayScore: 1 }),
      knockoutMatch({ homeTeamId: "A-1", awayTeamId: "C-1", homeScore: 1, awayScore: 0 }),
      knockoutMatch({ homeTeamId: "B-2", awayTeamId: "D-1", homeScore: 1, awayScore: 1 }),
      knockoutMatch({ stage: "GROUP_STAGE", homeTeamId: "B-2", awayTeamId: "A-1" }),
    ]);

    expect(totals.get("A-1")).toBe(13);
    expect(totals.get("B-2")).toBe(4);
  });
});

describe("getTeamTournamentMetrics", () => {
  it("combines group-table totals with completed knockout match contributions", () => {
    const rows = [
      standingRow("A", 1, {
        teamId: "A-1",
        played: 3,
        won: 2,
        drawn: 1,
        lost: 0,
        points: 7,
        goalsFor: 5,
        goalsAgainst: 2,
        goalDiff: 3,
      }),
    ];
    const metrics = getTeamTournamentMetrics(rows, [
      knockoutMatch({ homeTeamId: "A-1", awayTeamId: "B-2", homeScore: 3, awayScore: 1 }),
      knockoutMatch({ homeTeamId: "C-1", awayTeamId: "A-1", homeScore: 2, awayScore: 0 }),
      knockoutMatch({ homeTeamId: "A-1", awayTeamId: "D-2", status: MatchStatus.SCHEDULED }),
    ]).get("A-1");

    expect(metrics).toEqual({
      played: 5,
      won: 3,
      drawn: 1,
      lost: 1,
      points: 10,
      goalsFor: 8,
      goalsAgainst: 5,
      goalDiff: 3,
      yellowCards: 0,
      redCards: 0,
    });
  });

  it("uses the sourced FotMob card snapshot when the provider has no cards", () => {
    const metrics = getTeamTournamentMetrics([
      standingRow("A", 1, {
        team: { code: "SUI" },
        yellowCards: 0,
        redCards: 0,
      }),
    ]).get("A-1");

    expect(metrics?.yellowCards).toBe(6);
    expect(metrics?.redCards).toBe(1);
  });
});

describe("getTeamTournamentStatus", () => {
  it("shows pending before the official order is complete", () => {
    expect(
      getTeamTournamentStatus({
        teamId: "A-1",
        officialOrder: [],
        matches: [],
      }),
    ).toEqual({
      currentRank: null,
      currentRankLabel: "TBD",
      status: "pending",
      statusLabel: "Pending",
    });
  });

  it("shows DNQ for teams outside a complete official order", () => {
    const officialOrder = Array.from({ length: ENTRY_SIZE }, (_, index) => ({
      rank: index + 1,
      teamId: `team-${index + 1}`,
    }));

    expect(
      getTeamTournamentStatus({
        teamId: "team-33",
        officialOrder,
        matches: [],
      }),
    ).toEqual({
      currentRank: null,
      currentRankLabel: "DNQ",
      status: "dnq",
      statusLabel: "Did not qualify",
    });
  });

  it("shows still in until a qualified team loses a completed knockout match", () => {
    const officialOrder = [{ rank: 1, teamId: "A-1" }];

    expect(
      getTeamTournamentStatus({
        teamId: "A-1",
        officialOrder,
        matches: [
          knockoutMatch({ homeTeamId: "A-1", awayTeamId: "B-2", status: MatchStatus.SCHEDULED }),
        ],
      }),
    ).toEqual({
      currentRank: 1,
      currentRankLabel: "#1",
      status: "active",
      statusLabel: "Still in",
    });

    expect(
      getTeamTournamentStatus({
        teamId: "A-1",
        officialOrder,
        matches: [
          knockoutMatch({ homeTeamId: "A-1", awayTeamId: "B-2", homeScore: 0, awayScore: 1 }),
        ],
      }),
    ).toEqual({
      currentRank: 1,
      currentRankLabel: "#1",
      status: "eliminated",
      statusLabel: "Eliminated",
    });
  });
});
