import { EntryStatus, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  entry: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  groupTableSnapshot: {
    findMany: vi.fn(),
  },
  officialQualifiedOrder: {
    findFirst: vi.fn(),
  },
  syncCheckpoint: {
    findUnique: vi.fn(),
  },
  tournamentMatch: {
    findMany: vi.fn(),
  },
  tournamentTeam: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import {
  canEditEntry,
  canViewEntry,
  getEntryBuilderState,
  getLeaderboard,
  getSiteSnapshot,
} from "./data";

describe("site data readers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.groupTableSnapshot.findMany.mockResolvedValue([]);
    prisma.tournamentMatch.findMany.mockResolvedValue([]);
  });

  it("builds a site snapshot with fallback venues and lock state", async () => {
    const kickoffAt = new Date("2026-06-11T19:00:00.000Z");
    const teams = [{ id: "team-arg", name: "Argentina" }];
    const rows = [{ id: "row-1", groupName: "A" }];
    const activeOrder = { id: "order-1", items: [] };
    const syncState = { provider: "football-data", status: "success" };
    const matches = [
      {
        id: "match-1",
        externalId: "537327",
        venue: null,
        kickoffAt,
      },
    ];

    prisma.tournamentTeam.findMany.mockResolvedValue(teams);
    prisma.tournamentMatch.findMany.mockResolvedValue(matches);
    prisma.groupTableSnapshot.findMany.mockResolvedValue(rows);
    prisma.officialQualifiedOrder.findFirst.mockResolvedValue(activeOrder);
    prisma.syncCheckpoint.findUnique.mockResolvedValue(syncState);

    const snapshot = await getSiteSnapshot();

    expect(snapshot).toMatchObject({
      teams,
      groupTableRows: rows,
      activeOrder,
      syncState,
      lockInfo: {
        lockAt: kickoffAt,
      },
    });
    expect(snapshot.matches[0]).toMatchObject({
      id: "match-1",
      venue: "Mexico City Stadium, Mexico City",
    });
  });

  it("ranks leaderboard rows by score and then older update time", async () => {
    prisma.entry.findMany.mockResolvedValue([
      {
        id: "low-score",
        name: "Upset card",
        status: EntryStatus.SUBMITTED,
        owner: { name: "" },
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        picks: [
          { rank: 1, teamId: "bra" },
          { rank: 2, teamId: "arg" },
        ],
      },
      {
        id: "high-score",
        name: "Chalk card",
        status: EntryStatus.SUBMITTED,
        owner: { name: "Michael" },
        updatedAt: new Date("2026-06-02T00:00:00.000Z"),
        picks: [
          { rank: 1, teamId: "arg" },
          { rank: 2, teamId: "bra" },
        ],
      },
    ]);
    prisma.officialQualifiedOrder.findFirst.mockResolvedValue({
      items: [
        { rank: 1, teamId: "arg" },
        { rank: 2, teamId: "bra" },
      ],
    });

    const leaderboard = await getLeaderboard();

    expect(prisma.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: [EntryStatus.SUBMITTED, EntryStatus.LOCKED],
          },
        },
      }),
    );
    expect(leaderboard.rows).toEqual([
      expect.objectContaining({
        id: "high-score",
        entrantName: "Michael",
        rank: 1,
        ro32QualifiedCount: 2,
        score: expect.objectContaining({ points: 6 }),
      }),
      expect.objectContaining({
        id: "low-score",
        entrantName: "Pool entrant",
        rank: 2,
        ro32QualifiedCount: 2,
        score: expect.objectContaining({ points: 4 }),
      }),
    ]);
  });

  it("uses saved picks for an existing builder entry and empty ranks otherwise", async () => {
    const teams = [{ id: "team-1", name: "Argentina" }];
    const matches = [{ kickoffAt: new Date("2026-06-11T19:00:00.000Z") }];

    prisma.tournamentTeam.findMany.mockResolvedValue(teams);
    prisma.tournamentMatch.findMany.mockResolvedValue(matches);
    prisma.entry.findUnique.mockResolvedValue({
      id: "entry-1",
      picks: [
        { rank: 2, teamId: "team-2" },
        { rank: 1, teamId: "team-1" },
      ],
    });

    const existingState = await getEntryBuilderState("entry-1");

    expect(existingState.entry?.id).toBe("entry-1");
    expect(existingState.initialRanks).toEqual([
      { rank: 2, teamId: "team-2" },
      { rank: 1, teamId: "team-1" },
    ]);

    prisma.entry.findUnique.mockClear();
    const newState = await getEntryBuilderState();

    expect(prisma.entry.findUnique).not.toHaveBeenCalled();
    expect(newState.entry).toBeNull();
    expect(newState.initialRanks).toHaveLength(32);
    expect(newState.initialRanks[0]).toEqual({ rank: 1, teamId: "" });
  });
});

describe("entry permissions", () => {
  it("allows admins after lock while locking entrant-owned entries", () => {
    expect(
      canEditEntry({
        userId: "owner",
        userRole: Role.ENTRANT,
        ownerId: "owner",
        isLocked: false,
      }),
    ).toBe(true);
    expect(
      canEditEntry({
        userId: "admin",
        userRole: Role.ADMIN,
        ownerId: "owner",
        isLocked: false,
      }),
    ).toBe(true);
    expect(
      canEditEntry({
        userId: "admin",
        userRole: Role.ADMIN,
        ownerId: "owner",
        isLocked: true,
      }),
    ).toBe(true);
    expect(
      canEditEntry({
        userId: "owner",
        userRole: Role.ENTRANT,
        ownerId: "owner",
        isLocked: true,
      }),
    ).toBe(false);
  });

  it("delegates view access to owner, admin, or locked tournament state", () => {
    const unlocked = {
      lockAt: new Date("2026-06-11T19:00:00.000Z"),
      isLocked: false,
      label: "open",
    };

    expect(
      canViewEntry({
        viewerId: "viewer",
        viewerRole: Role.ENTRANT,
        ownerId: "owner",
        lockInfo: unlocked,
      }),
    ).toBe(false);
    expect(
      canViewEntry({
        viewerId: "viewer",
        viewerRole: Role.ENTRANT,
        ownerId: "owner",
        lockInfo: { ...unlocked, isLocked: true },
      }),
    ).toBe(true);
  });
});
