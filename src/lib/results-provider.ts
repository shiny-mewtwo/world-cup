import { prisma } from "@/lib/prisma";
import {
  extractFootballDataCardTotals,
  extractFootballDataScores,
  extractFootballDataWinnerSide,
  footballDataId,
  footballDataTeamCode,
  mapFootballDataMatchStatus,
  normalizeFootballDataGroupName,
  parseFootballDataDate,
  type FootballDataBooking,
  type FootballDataScore,
  type FootballDataTeam,
} from "@/lib/football-data-normalizers";
import { buildQualifiedOrderFromStandings } from "@/lib/tournament";
import { getFootballDataMatchVenue } from "@/lib/world-cup-venues";

export type SyncResult = {
  provider: string;
  status: "success" | "skipped" | "failed";
  message: string;
};

export interface ResultsProvider {
  readonly name: string;
  syncTeams(): Promise<SyncResult>;
  syncFixtures(): Promise<SyncResult>;
  syncLiveResults(options?: { saveCheckpoint?: boolean }): Promise<SyncResult>;
  syncGroupTables(): Promise<SyncResult>;
  publishQualifiedOrder(options?: { saveCheckpoint?: boolean }): Promise<SyncResult>;
  syncTournament(): Promise<SyncResult>;
}

type FootballDataError = {
  message?: string;
  error?: string;
};

type FootballDataTeamsResponse = {
  count?: number;
  teams?: FootballDataTeam[];
};

type FootballDataStandingsResponse = {
  standings?: Array<{
    type?: string | null;
    group?: string | null;
    table?: Array<{
      position?: number | null;
      team?: FootballDataTeam | null;
      playedGames?: number | null;
      won?: number | null;
      draw?: number | null;
      lost?: number | null;
      points?: number | null;
      goalsFor?: number | null;
      goalsAgainst?: number | null;
      goalDifference?: number | null;
    }>;
  }>;
};

type FootballDataMatchesResponse = {
  matches?: FootballDataMatch[];
};

type FootballDataMatch = {
  id?: number | string | null;
  utcDate?: string | null;
  status?: string | null;
  stage?: string | null;
  group?: string | null;
  homeTeam?: FootballDataTeam | null;
  awayTeam?: FootballDataTeam | null;
  score?: FootballDataScore | null;
  bookings?: FootballDataBooking[] | null;
};

type TeamSyncInput = {
  team: FootballDataTeam;
  groupName?: string | null;
  seed?: number | null;
};

const FOOTBALL_DATA_TEAM_ALIASES: Record<string, string[]> = {
  "Cape Verde Islands": ["Cabo Verde"],
  Iran: ["IR Iran"],
  "Ivory Coast": ["Côte d'Ivoire"],
  "South Korea": ["Korea Republic"],
  Turkey: ["Türkiye"],
};

const WORLD_CUP_2026_GROUP_NAMES = Array.from({ length: 12 }, (_, index) =>
  String.fromCharCode(65 + index),
);

class FootballDataResultsProvider implements ResultsProvider {
  readonly name = "football-data";

  private get token() {
    return process.env.FOOTBALL_DATA_API_TOKEN;
  }

  private get baseUrl() {
    return process.env.FOOTBALL_DATA_BASE_URL ?? "https://api.football-data.org/v4";
  }

  private get competitionCode() {
    return process.env.FOOTBALL_DATA_COMPETITION_CODE ?? "WC";
  }

  private get season() {
    return process.env.FOOTBALL_DATA_SEASON ?? "2026";
  }

  private async saveCheckpoint(result: SyncResult) {
    await prisma.syncCheckpoint.upsert({
      where: {
        provider: this.name,
      },
      create: {
        provider: this.name,
        status: result.status,
        message: result.message,
        lastAttemptAt: new Date(),
        lastSuccessAt: result.status === "success" ? new Date() : null,
      },
      update: {
        status: result.status,
        message: result.message,
        lastAttemptAt: new Date(),
        ...(result.status === "success" ? { lastSuccessAt: new Date() } : {}),
      },
    });
  }

  private async skip(message: string) {
    const result: SyncResult = {
      provider: this.name,
      status: "skipped",
      message,
    };

    await this.saveCheckpoint(result);
    return result;
  }

  private async runStep(label: string, action: () => Promise<SyncResult>) {
    try {
      return await action();
    } catch (error) {
      return {
        provider: this.name,
        status: "failed" as const,
        message: `${label} failed: ${
          error instanceof Error ? error.message : "Unknown football-data.org error"
        }`,
      };
    }
  }

  private async fetchJson<T>(path: string, headers?: HeadersInit) {
    const token = this.token;

    if (!token) {
      throw new Error("Set FOOTBALL_DATA_API_TOKEN to sync from football-data.org.");
    }

    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "X-Auth-Token": token,
        ...headers,
      },
    });
    const payload = (await response.json()) as T & FootballDataError;

    if (!response.ok) {
      throw new Error(payload.message ?? payload.error ?? `football-data.org request failed with ${response.status}`);
    }

    return payload;
  }

  private async upsertTeam({ team, groupName, seed }: TeamSyncInput) {
    const externalId = footballDataId(team.id);
    const code = footballDataTeamCode(team);
    const name = team.name?.trim();

    if (!externalId || !code || !name) {
      return null;
    }

    const nameAliases = FOOTBALL_DATA_TEAM_ALIASES[name] ?? [];
    const existingTeam = await prisma.tournamentTeam.findFirst({
      where: {
        OR: [{ externalId }, { name }, ...nameAliases.map((alias) => ({ name: alias }))],
      },
    });
    const data = {
      externalId,
      code,
      name: existingTeam?.name ?? name,
      shortName: existingTeam?.shortName ?? team.shortName ?? name,
      groupName: groupName ?? undefined,
      seed: seed ?? undefined,
      isPlaceholder: false,
    };

    if (existingTeam) {
      return prisma.tournamentTeam.update({
        where: {
          id: existingTeam.id,
        },
        data,
      });
    }

    return prisma.tournamentTeam.create({
      data: {
        ...data,
        isHost: ["Canada", "Mexico", "United States"].includes(name),
      },
    });
  }

  private async syncTeamsData() {
    const payload = await this.fetchJson<FootballDataTeamsResponse>(
      `competitions/${this.competitionCode}/teams?season=${this.season}`,
    );
    const teams = payload.teams ?? [];
    let updatedTeams = 0;

    for (const team of teams) {
      const syncedTeam = await this.upsertTeam({ team });

      if (syncedTeam) {
        updatedTeams += 1;
      }
    }

    return { teams, updatedTeams };
  }

  private async syncStandingsData() {
    const payload = await this.fetchJson<FootballDataStandingsResponse>(
      `competitions/${this.competitionCode}/standings`,
    );
    const standings = (payload.standings ?? []).filter(
      (standing) => standing.type === "TOTAL",
    );
    let updatedRows = 0;

    for (const standing of standings) {
      const groupName = normalizeFootballDataGroupName(standing.group);

      if (!groupName) {
        continue;
      }

      for (const row of standing.table ?? []) {
        if (!row.team) {
          continue;
        }

        const team = await this.upsertTeam({
          team: row.team,
          groupName,
          seed: row.position,
        });

        if (!team) {
          continue;
        }

        await prisma.groupTableSnapshot.upsert({
          where: {
            groupName_teamId: {
              groupName,
              teamId: team.id,
            },
          },
          create: {
            groupName,
            teamId: team.id,
            played: row.playedGames ?? 0,
            won: row.won ?? 0,
            drawn: row.draw ?? 0,
            lost: row.lost ?? 0,
            goalsFor: row.goalsFor ?? 0,
            goalsAgainst: row.goalsAgainst ?? 0,
            goalDiff: row.goalDifference ?? 0,
            points: row.points ?? 0,
            rank: row.position ?? 1,
          },
          update: {
            played: row.playedGames ?? 0,
            won: row.won ?? 0,
            drawn: row.draw ?? 0,
            lost: row.lost ?? 0,
            goalsFor: row.goalsFor ?? 0,
            goalsAgainst: row.goalsAgainst ?? 0,
            goalDiff: row.goalDifference ?? 0,
            points: row.points ?? 0,
            rank: row.position ?? 1,
          },
        });

        updatedRows += 1;
      }
    }

    await prisma.groupTableSnapshot.deleteMany({
      where: {
        groupName: {
          notIn: WORLD_CUP_2026_GROUP_NAMES,
        },
      },
    });

    return { standings, updatedRows };
  }

  private async syncFixturesData() {
    const payload = await this.fetchJson<FootballDataMatchesResponse>(
      `competitions/${this.competitionCode}/matches?season=${this.season}`,
      {
        "X-Unfold-Bookings": "true",
      },
    );
    const fixtures = payload.matches ?? [];
    let updatedFixtures = 0;
    const cardTotalsByTeamId = new Map<string, { yellowCards: number; redCards: number }>();

    function addCardTotals(teamId: string | undefined, totals: { yellowCards: number; redCards: number }) {
      if (!teamId) {
        return;
      }

      const currentTotals = cardTotalsByTeamId.get(teamId) ?? {
        yellowCards: 0,
        redCards: 0,
      };

      cardTotalsByTeamId.set(teamId, {
        yellowCards: currentTotals.yellowCards + totals.yellowCards,
        redCards: currentTotals.redCards + totals.redCards,
      });
    }

    for (const fixture of fixtures) {
      const externalId = footballDataId(fixture.id);
      const kickoffAt = parseFootballDataDate(fixture.utcDate);

      if (!externalId || !kickoffAt) {
        continue;
      }

      const groupName = normalizeFootballDataGroupName(fixture.group);
      const [homeTeam, awayTeam] = await Promise.all([
        fixture.homeTeam ? this.upsertTeam({ team: fixture.homeTeam, groupName }) : null,
        fixture.awayTeam ? this.upsertTeam({ team: fixture.awayTeam, groupName }) : null,
      ]);
      const { homeScore, awayScore } = extractFootballDataScores(fixture.score);
      const winnerSide = extractFootballDataWinnerSide(fixture.score);
      const isGroupStageFixture = Boolean(groupName) && fixture.stage === "GROUP_STAGE";
      const venue = getFootballDataMatchVenue(externalId) ?? undefined;
      const fallbackMatchConditions =
        homeTeam && awayTeam
          ? [
              {
                externalId: null,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
              },
            ]
          : [];
      const existingMatch = await prisma.tournamentMatch.findFirst({
        where: {
          OR: [{ externalId }, ...fallbackMatchConditions],
        },
      });
      const data = {
        externalId,
        stage: fixture.stage ?? "World Cup",
        groupName,
        venue,
        kickoffAt,
        status: mapFootballDataMatchStatus(fixture.status),
        homeTeamId: homeTeam?.id,
        awayTeamId: awayTeam?.id,
        homeScore,
        awayScore,
        winnerTeamId:
          winnerSide === "home"
            ? homeTeam?.id
            : winnerSide === "away"
              ? awayTeam?.id
              : null,
      };

      if (existingMatch) {
        await prisma.tournamentMatch.update({
          where: {
            id: existingMatch.id,
          },
          data,
        });
      } else {
        await prisma.tournamentMatch.create({ data });
      }

      if (isGroupStageFixture) {
        addCardTotals(
          homeTeam?.id,
          extractFootballDataCardTotals({
            team: fixture.homeTeam,
            bookings: fixture.bookings,
          }),
        );
        addCardTotals(
          awayTeam?.id,
          extractFootballDataCardTotals({
            team: fixture.awayTeam,
            bookings: fixture.bookings,
          }),
        );
      }

      updatedFixtures += 1;
    }

    for (const [teamId, totals] of cardTotalsByTeamId) {
      await prisma.groupTableSnapshot.updateMany({
        where: {
          teamId,
        },
        data: totals,
      });
    }

    if (fixtures.length > 0) {
      await prisma.tournamentMatch.deleteMany({
        where: {
          externalId: null,
        },
      });
    }

    return { fixtures, updatedFixtures };
  }

  async syncTeams() {
    if (!this.token) {
      return this.skip("Set FOOTBALL_DATA_API_TOKEN to sync teams from football-data.org.");
    }

    const result = await this.runStep("Teams sync", async () => {
      const { updatedTeams } = await this.syncTeamsData();

      return {
        provider: this.name,
        status: "success",
        message: `Synced ${updatedTeams} football-data.org teams.`,
      };
    });

    await this.saveCheckpoint(result);
    return result;
  }

  async syncFixtures() {
    if (!this.token) {
      return this.skip("Set FOOTBALL_DATA_API_TOKEN to sync fixtures from football-data.org.");
    }

    const result = await this.runStep("Fixtures sync", async () => {
      const { updatedFixtures } = await this.syncFixturesData();

      return {
        provider: this.name,
        status: "success",
        message: `Synced ${updatedFixtures} football-data.org fixtures.`,
      };
    });

    await this.saveCheckpoint(result);
    return result;
  }

  async syncLiveResults(options: { saveCheckpoint?: boolean } = {}) {
    if (!this.token) {
      const result: SyncResult = {
        provider: this.name,
        status: "skipped",
        message: "Set FOOTBALL_DATA_API_TOKEN to sync live results from football-data.org.",
      };

      if (options.saveCheckpoint !== false) {
        await this.saveCheckpoint(result);
      }

      return result;
    }

    const result = await this.runStep("Live results sync", async () => {
      const { updatedFixtures } = await this.syncFixturesData();
      const { updatedRows } = await this.syncStandingsData();

      return {
        provider: this.name,
        status: "success",
        message:
          `Refreshed ${updatedFixtures} football-data.org fixture scores and states ` +
          `and ${updatedRows} group table rows.`,
      };
    });

    if (options.saveCheckpoint !== false) {
      await this.saveCheckpoint(result);
    }

    return result;
  }

  async syncGroupTables() {
    if (!this.token) {
      return this.skip("Set FOOTBALL_DATA_API_TOKEN to sync group tables from football-data.org.");
    }

    const result = await this.runStep("Group table sync", async () => {
      const { updatedRows } = await this.syncStandingsData();

      return {
        provider: this.name,
        status: "success",
        message: `Synced ${updatedRows} football-data.org group table rows.`,
      };
    });

    await this.saveCheckpoint(result);
    return result;
  }

  async publishQualifiedOrder(options: { saveCheckpoint?: boolean } = {}) {
    const [standingsRows, matches, activeOrder] = await Promise.all([
      prisma.groupTableSnapshot.findMany({
        include: {
          team: true,
        },
        orderBy: [{ groupName: "asc" }, { rank: "asc" }],
      }),
      prisma.tournamentMatch.findMany({
        select: {
          stage: true,
          status: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          winnerTeamId: true,
        },
      }),
      prisma.officialQualifiedOrder.findFirst({
        where: {
          isActive: true,
        },
        include: {
          items: {
            orderBy: {
              rank: "asc",
            },
          },
        },
        orderBy: {
          publishedAt: "desc",
        },
      }),
    ]);
    const qualifiedOrder = buildQualifiedOrderFromStandings(standingsRows, matches);

    if (qualifiedOrder.length === 0) {
      const result: SyncResult = {
        provider: this.name,
        status: "skipped",
        message: "Official final order pending until enough tournament results are available.",
      };

      if (options.saveCheckpoint !== false) {
        await this.saveCheckpoint(result);
      }

      return result;
    }

    const activeItems = activeOrder?.items.map((item) => ({
      rank: item.rank,
      teamId: item.teamId,
    })) ?? [];
    const orderIsCurrent =
      activeItems.length === qualifiedOrder.length &&
      activeItems.every((item, index) => (
        item.rank === qualifiedOrder[index]?.rank &&
        item.teamId === qualifiedOrder[index]?.teamId
      ));

    if (orderIsCurrent) {
      const result: SyncResult = {
        provider: this.name,
        status: "skipped",
        message: "Official final order already matches the synced results.",
      };

      if (options.saveCheckpoint !== false) {
        await this.saveCheckpoint(result);
      }

      return result;
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.officialQualifiedOrder.updateMany({
        where: {
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      await transaction.officialQualifiedOrder.create({
        data: {
          source: this.name,
          notes: "Automatically published from synced results.",
          items: {
            create: qualifiedOrder,
          },
        },
      });
    });

    const result: SyncResult = {
      provider: this.name,
      status: "success",
      message: `Published ${qualifiedOrder.length} teams from synced results.`,
    };

    if (options.saveCheckpoint !== false) {
      await this.saveCheckpoint(result);
    }

    return result;
  }

  async syncTournament() {
    if (!this.token) {
      return this.skip("Set FOOTBALL_DATA_API_TOKEN to sync from football-data.org.");
    }

    const steps = [
      await this.runStep("Teams sync", async () => {
        const { updatedTeams } = await this.syncTeamsData();
        return {
          provider: this.name,
          status: "success",
          message: `teams ${updatedTeams}`,
        };
      }),
      await this.runStep("Group table sync", async () => {
        const { updatedRows } = await this.syncStandingsData();
        return {
          provider: this.name,
          status: "success",
          message: `group tables ${updatedRows}`,
        };
      }),
      await this.runStep("Fixtures sync", async () => {
        const { updatedFixtures } = await this.syncFixturesData();
        return {
          provider: this.name,
          status: "success",
          message: `fixtures ${updatedFixtures}`,
        };
      }),
      await this.runStep("Official order publish", () => this.publishQualifiedOrder()),
    ];
    const failedSteps = steps.filter((step) => step.status === "failed");
    const successfulSteps = steps.filter((step) => step.status === "success");
    const result: SyncResult = {
      provider: this.name,
      status:
        failedSteps.length > 0
          ? "failed"
          : successfulSteps.length > 0
            ? "success"
            : "skipped",
      message: `football-data.org sync: ${steps.map((step) => step.message).join("; ")}.`,
    };

    await this.saveCheckpoint(result);
    return result;
  }
}

export function getResultsProvider() {
  return new FootballDataResultsProvider();
}
