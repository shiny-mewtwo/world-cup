import { MatchStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  groupTableSnapshot: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  officialQualifiedOrder: {
    findFirst: vi.fn(),
  },
  syncCheckpoint: {
    upsert: vi.fn(),
  },
  tournamentMatch: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  tournamentTeam: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { getResultsProvider } from "./results-provider";

const WORLD_CUP_2026_GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe("football-data results provider", () => {
  const originalToken = process.env.FOOTBALL_DATA_API_TOKEN;
  const originalBaseUrl = process.env.FOOTBALL_DATA_BASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.FOOTBALL_DATA_API_TOKEN;
    delete process.env.FOOTBALL_DATA_BASE_URL;
    delete process.env.FOOTBALL_DATA_COMPETITION_CODE;
    delete process.env.FOOTBALL_DATA_SEASON;
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalToken === undefined) {
      delete process.env.FOOTBALL_DATA_API_TOKEN;
    } else {
      process.env.FOOTBALL_DATA_API_TOKEN = originalToken;
    }

    if (originalBaseUrl === undefined) {
      delete process.env.FOOTBALL_DATA_BASE_URL;
    } else {
      process.env.FOOTBALL_DATA_BASE_URL = originalBaseUrl;
    }
  });

  it("skips and checkpoints team sync when no API token is configured", async () => {
    const result = await getResultsProvider().syncTeams();

    expect(result).toEqual({
      provider: "football-data",
      status: "skipped",
      message: "Set FOOTBALL_DATA_API_TOKEN to sync teams from football-data.org.",
    });
    expect(prisma.syncCheckpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "football-data" },
        create: expect.objectContaining({
          provider: "football-data",
          status: "skipped",
          message: result.message,
        }),
        update: expect.objectContaining({
          status: "skipped",
          message: result.message,
        }),
      }),
    );
  });

  it("skips and checkpoints live result sync when no API token is configured", async () => {
    const result = await getResultsProvider().syncLiveResults();

    expect(result).toMatchObject({
      provider: "football-data",
      status: "skipped",
    });
    expect(prisma.syncCheckpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "football-data" },
        create: expect.objectContaining({
          provider: "football-data",
          status: "skipped",
          message: result.message,
        }),
        update: expect.objectContaining({
          status: "skipped",
          message: result.message,
        }),
      }),
    );
  });

  it("refreshes fixture states and group tables during live sync", async () => {
    process.env.FOOTBALL_DATA_API_TOKEN = "test-token";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          matches: [
            {
              id: 537327,
              utcDate: "2026-06-11T19:00:00Z",
              status: "FINISHED",
              stage: "GROUP_STAGE",
              group: "GROUP_A",
              homeTeam: {
                id: 66,
                name: "Argentina",
                shortName: "Argentina",
                tla: "ARG",
              },
              awayTeam: {
                id: 764,
                name: "Brazil",
                shortName: "Brazil",
                tla: "BRA",
              },
              score: {
                fullTime: {
                  home: 2,
                  away: 1,
                },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          standings: [
            {
              type: "TOTAL",
              group: "GROUP_A",
              table: [
                {
                  position: 1,
                  team: {
                    id: 66,
                    name: "Argentina",
                    shortName: "Argentina",
                    tla: "ARG",
                  },
                  playedGames: 1,
                  won: 1,
                  draw: 0,
                  lost: 0,
                  points: 3,
                  goalsFor: 2,
                  goalsAgainst: 1,
                  goalDifference: 1,
                },
              ],
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const teamsById = new Map<string, Record<string, unknown>>();
    const teamsByName = new Map<string, Record<string, unknown>>();
    const teamsByExternalId = new Map<string, Record<string, unknown>>();
    const storeTeam = (team: Record<string, unknown>) => {
      teamsById.set(String(team.id), team);
      teamsByName.set(String(team.name), team);

      if (team.externalId) {
        teamsByExternalId.set(String(team.externalId), team);
      }
    };

    prisma.tournamentTeam.findFirst.mockImplementation(async ({ where }) => {
      const clauses = where.OR as Array<Record<string, string>>;

      for (const clause of clauses) {
        const match =
          (clause.name && teamsByName.get(clause.name)) ??
          (clause.externalId && teamsByExternalId.get(clause.externalId));

        if (match) {
          return match;
        }
      }

      return null;
    });
    prisma.tournamentTeam.create.mockImplementation(async ({ data }) => {
      const team = {
        id: `team-${String(data.code).toLowerCase()}`,
        ...data,
      };

      storeTeam(team);
      return team;
    });
    prisma.tournamentTeam.update.mockImplementation(async ({ where, data }) => {
      const existing = teamsById.get(where.id) ?? { id: where.id };
      const team = {
        ...existing,
        ...data,
      };

      storeTeam(team);
      return team;
    });
    prisma.tournamentMatch.findFirst.mockResolvedValue(null);
    prisma.tournamentMatch.create.mockResolvedValue({ id: "match-1" });
    prisma.tournamentMatch.deleteMany.mockResolvedValue({ count: 0 });
    prisma.groupTableSnapshot.deleteMany.mockResolvedValue({ count: 2 });
    prisma.groupTableSnapshot.upsert.mockResolvedValue({});
    prisma.groupTableSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.syncCheckpoint.upsert.mockResolvedValue({});

    const result = await getResultsProvider().syncLiveResults();

    expect(result).toEqual({
      provider: "football-data",
      status: "success",
      message:
        "Refreshed 1 football-data.org fixture scores and states and 1 group table rows.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.football-data.org/v4/competitions/WC/standings",
    );
    expect(prisma.tournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalId: "537327",
        homeScore: 2,
        awayScore: 1,
        status: MatchStatus.COMPLETED,
      }),
    });
    expect(prisma.groupTableSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          played: 1,
          points: 3,
          rank: 1,
        }),
        update: expect.objectContaining({
          played: 1,
          points: 3,
          rank: 1,
        }),
      }),
    );
    expect(prisma.groupTableSnapshot.deleteMany).toHaveBeenCalledWith({
      where: {
        groupName: {
          notIn: WORLD_CUP_2026_GROUP_NAMES,
        },
      },
    });
    expect(prisma.syncCheckpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "success",
        }),
        update: expect.objectContaining({
          status: "success",
        }),
      }),
    );
  });

  it("ignores non-World-Cup standings groups from football-data.org", async () => {
    process.env.FOOTBALL_DATA_API_TOKEN = "test-token";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        standings: [
          {
            type: "TOTAL",
            group: "Central Division",
            table: [
              {
                position: 1,
                team: {
                  id: 760,
                  name: "Spain",
                  shortName: "Spain",
                  tla: "ESP",
                },
                playedGames: 1,
                points: 1,
              },
            ],
          },
          {
            type: "TOTAL",
            group: "GROUP_A",
            table: [
              {
                position: 1,
                team: {
                  id: 66,
                  name: "Argentina",
                  shortName: "Argentina",
                  tla: "ARG",
                },
                playedGames: 1,
                points: 3,
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    prisma.tournamentTeam.findFirst.mockResolvedValue(null);
    prisma.tournamentTeam.create.mockResolvedValue({
      id: "team-arg",
      externalId: "66",
      code: "ARG",
      name: "Argentina",
    });
    prisma.groupTableSnapshot.deleteMany.mockResolvedValue({ count: 2 });
    prisma.groupTableSnapshot.upsert.mockResolvedValue({});
    prisma.syncCheckpoint.upsert.mockResolvedValue({});

    const result = await getResultsProvider().syncGroupTables();

    expect(result).toEqual({
      provider: "football-data",
      status: "success",
      message: "Synced 1 football-data.org group table rows.",
    });
    expect(prisma.tournamentTeam.create).toHaveBeenCalledTimes(1);
    expect(prisma.tournamentTeam.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "ARG",
        groupName: "A",
      }),
    });
    expect(prisma.groupTableSnapshot.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.groupTableSnapshot.deleteMany).toHaveBeenCalledWith({
      where: {
        groupName: {
          notIn: WORLD_CUP_2026_GROUP_NAMES,
        },
      },
    });
  });

  it("syncs teams, standings, and fixtures through football-data.org", async () => {
    process.env.FOOTBALL_DATA_API_TOKEN = "test-token";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          teams: [
            {
              id: 66,
              name: "Argentina",
              shortName: "Argentina",
              tla: "ARG",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          standings: [
            {
              type: "TOTAL",
              group: "GROUP_A",
              table: [
                {
                  position: 1,
                  team: {
                    id: 66,
                    name: "Argentina",
                    shortName: "Argentina",
                    tla: "ARG",
                  },
                  playedGames: 3,
                  won: 2,
                  draw: 1,
                  lost: 0,
                  points: 7,
                  goalsFor: 5,
                  goalsAgainst: 1,
                  goalDifference: 4,
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          matches: [
            {
              id: 537327,
              utcDate: "2026-06-11T19:00:00Z",
              status: "FINISHED",
              stage: "GROUP_STAGE",
              group: "GROUP_A",
              homeTeam: {
                id: 66,
                name: "Argentina",
                shortName: "Argentina",
                tla: "ARG",
              },
              awayTeam: {
                id: 764,
                name: "Brazil",
                shortName: "Brazil",
                tla: "BRA",
              },
              score: {
                fullTime: {
                  home: 2,
                  away: 1,
                },
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const teamsById = new Map<string, Record<string, unknown>>();
    const teamsByName = new Map<string, Record<string, unknown>>();
    const teamsByExternalId = new Map<string, Record<string, unknown>>();
    const storeTeam = (team: Record<string, unknown>) => {
      teamsById.set(String(team.id), team);
      teamsByName.set(String(team.name), team);

      if (team.externalId) {
        teamsByExternalId.set(String(team.externalId), team);
      }
    };

    prisma.tournamentTeam.findFirst.mockImplementation(async ({ where }) => {
      const clauses = where.OR as Array<Record<string, string>>;

      for (const clause of clauses) {
        const match =
          (clause.name && teamsByName.get(clause.name)) ??
          (clause.externalId && teamsByExternalId.get(clause.externalId));

        if (match) {
          return match;
        }
      }

      return null;
    });
    prisma.tournamentTeam.create.mockImplementation(async ({ data }) => {
      const team = {
        id: `team-${String(data.code).toLowerCase()}`,
        ...data,
      };

      storeTeam(team);
      return team;
    });
    prisma.tournamentTeam.update.mockImplementation(async ({ where, data }) => {
      const existing = teamsById.get(where.id) ?? { id: where.id };
      const team = {
        ...existing,
        ...data,
      };

      storeTeam(team);
      return team;
    });
    prisma.groupTableSnapshot.upsert.mockResolvedValue({});
    prisma.groupTableSnapshot.deleteMany.mockResolvedValue({ count: 0 });
    prisma.groupTableSnapshot.updateMany.mockResolvedValue({ count: 0 });
    prisma.groupTableSnapshot.findMany.mockResolvedValue([]);
    prisma.officialQualifiedOrder.findFirst.mockResolvedValue(null);
    prisma.tournamentMatch.findMany.mockResolvedValue([]);
    prisma.tournamentMatch.findFirst.mockResolvedValue(null);
    prisma.tournamentMatch.create.mockResolvedValue({ id: "match-1" });
    prisma.tournamentMatch.deleteMany.mockResolvedValue({ count: 0 });
    prisma.syncCheckpoint.upsert.mockResolvedValue({});

    const result = await getResultsProvider().syncTournament();

    expect(result).toMatchObject({
      provider: "football-data",
      status: "success",
    });
    expect(result.message).toContain("teams 1");
    expect(result.message).toContain("group tables 1");
    expect(result.message).toContain("fixtures 1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.football-data.org/v4/competitions/WC/teams?season=2026",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      cache: "no-store",
      headers: {
        "X-Auth-Token": "test-token",
      },
    });
    expect(prisma.groupTableSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          groupName_teamId: {
            groupName: "A",
            teamId: "team-arg",
          },
        },
        create: expect.objectContaining({
          points: 7,
          rank: 1,
        }),
      }),
    );
    expect(prisma.tournamentMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalId: "537327",
        groupName: "A",
        homeTeamId: "team-arg",
        awayTeamId: "team-bra",
        homeScore: 2,
        awayScore: 1,
        status: MatchStatus.COMPLETED,
        venue: "Mexico City Stadium, Mexico City",
      }),
    });
    expect(prisma.syncCheckpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "success",
        }),
        update: expect.objectContaining({
          status: "success",
        }),
      }),
    );
  });
});
