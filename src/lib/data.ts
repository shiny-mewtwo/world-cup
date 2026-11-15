import {
  EntryStatus,
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { scoreEntry } from "@/lib/scoring";
import { getPublicDisplayName } from "@/lib/formatting";
import {
  buildEmptyRanks,
  getEffectiveOfficialOrder,
  getLockInfo,
  shouldRevealEntry,
} from "@/lib/tournament";
import { getFootballDataMatchVenue } from "@/lib/world-cup-venues";

export async function getSiteSnapshot() {
  const [teams, matches, groupTableRows, activeOrder, syncState] = await Promise.all([
    prisma.tournamentTeam.findMany({
      orderBy: [{ groupName: "asc" }, { seed: "asc" }, { name: "asc" }],
    }),
    prisma.tournamentMatch.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: {
        kickoffAt: "asc",
      },
    }),
    prisma.groupTableSnapshot.findMany({
      include: {
        team: true,
      },
      orderBy: [{ groupName: "asc" }, { rank: "asc" }],
    }),
    prisma.officialQualifiedOrder.findFirst({
      where: {
        isActive: true,
      },
      include: {
        items: {
          include: {
            team: true,
          },
          orderBy: {
            rank: "asc",
          },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
    }),
    prisma.syncCheckpoint.findUnique({
      where: {
        provider: "football-data",
      },
    }),
  ]);

  return {
    teams,
    matches: matches.map((match) => ({
      ...match,
      venue: match.venue ?? getFootballDataMatchVenue(match.externalId),
    })),
    groupTableRows,
    activeOrder,
    officialOrder: getEffectiveOfficialOrder(activeOrder, groupTableRows, matches),
    syncState,
    lockInfo: getLockInfo(matches),
  };
}

export async function getMyEntries(userId: string) {
  return prisma.entry.findMany({
    where: {
      ownerId: userId,
    },
    include: {
      picks: {
        include: {
          team: true,
        },
        orderBy: {
          rank: "asc",
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getEntryDetail(entryId: string) {
  const [entry, matches, activeOrder, teams, groupTableRows] = await Promise.all([
    prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        owner: true,
        picks: {
          include: {
            team: true,
          },
          orderBy: {
            rank: "asc",
          },
        },
      },
    }),
    prisma.tournamentMatch.findMany({
      select: {
        kickoffAt: true,
        stage: true,
        status: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        winnerTeamId: true,
      },
      orderBy: {
        kickoffAt: "asc",
      },
    }),
    prisma.officialQualifiedOrder.findFirst({
      where: { isActive: true },
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
    prisma.tournamentTeam.findMany({
      orderBy: [{ groupName: "asc" }, { seed: "asc" }, { name: "asc" }],
    }),
    prisma.groupTableSnapshot.findMany({
      include: {
        team: true,
      },
      orderBy: [{ groupName: "asc" }, { rank: "asc" }],
    }),
  ]);

  if (!entry) {
    return null;
  }

  const lockInfo = getLockInfo(matches);
  const officialOrder = getEffectiveOfficialOrder(activeOrder, groupTableRows, matches);

  return {
    entry,
    teams,
    matches,
    lockInfo,
    officialOrder,
    score: scoreEntry(
      entry.picks.map((pick) => ({ rank: pick.rank, teamId: pick.teamId })),
      officialOrder,
    ),
  };
}

export async function getLeaderboard() {
  const [entries, activeOrder, groupTableRows, matches] = await Promise.all([
    prisma.entry.findMany({
      where: {
        status: {
          in: [EntryStatus.SUBMITTED, EntryStatus.LOCKED],
        },
      },
      include: {
        owner: true,
        picks: {
          orderBy: {
            rank: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
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
  ]);

  const officialOrder = getEffectiveOfficialOrder(activeOrder, groupTableRows, matches);
  const officialTeamIds = new Set(officialOrder.map((item) => item.teamId));

  const rows = entries
    .map((entry) => {
      const entryPicks = entry.picks.map((pick) => ({ rank: pick.rank, teamId: pick.teamId }));
      const score = scoreEntry(
        entryPicks,
        officialOrder,
      );

      return {
        id: entry.id,
        entrantName: getPublicDisplayName(entry.owner.name),
        ro32QualifiedCount: entryPicks.filter((pick) => officialTeamIds.has(pick.teamId)).length,
        status: entry.status,
        score,
        updatedAt: entry.updatedAt,
      };
    })
    .sort((left, right) => {
      if (right.score.points !== left.score.points) {
        return right.score.points - left.score.points;
      }

      return left.updatedAt.getTime() - right.updatedAt.getTime();
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return {
    rows,
  };
}

export async function getAdminDashboard() {
  const [entries, importedEntries, teams, activeOrder, syncState, matches, users] = await Promise.all([
    prisma.entry.findMany({
      include: {
        owner: true,
        picks: {
          include: {
            team: true,
          },
          orderBy: {
            rank: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
    }),
    prisma.entry.findMany({
      where: {
        owner: {
          email: {
            endsWith: "@worldcup.local",
          },
        },
      },
      include: {
        owner: true,
        picks: {
          include: {
            team: true,
          },
          orderBy: {
            rank: "asc",
          },
        },
        invalidPicks: {
          orderBy: {
            rank: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.tournamentTeam.findMany({
      orderBy: [{ groupName: "asc" }, { seed: "asc" }, { name: "asc" }],
    }),
    prisma.officialQualifiedOrder.findFirst({
      where: {
        isActive: true,
      },
      include: {
        items: {
          include: {
            team: true,
          },
          orderBy: {
            rank: "asc",
          },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
    }),
    prisma.syncCheckpoint.findUnique({
      where: {
        provider: "football-data",
      },
    }),
    prisma.tournamentMatch.findMany({
      select: {
        kickoffAt: true,
      },
    }),
    prisma.user.findMany({
      orderBy: {
        createdAt: "asc",
      },
      take: 8,
    }),
  ]);

  return {
    entries,
    importedEntries,
    teams,
    activeOrder,
    syncState,
    users,
    lockInfo: getLockInfo(matches),
  };
}

export async function getEntryBuilderState(entryId?: string) {
  const [teams, matches, entry] = await Promise.all([
    prisma.tournamentTeam.findMany({
      orderBy: [{ groupName: "asc" }, { seed: "asc" }, { name: "asc" }],
    }),
    prisma.tournamentMatch.findMany({
      select: {
        kickoffAt: true,
      },
    }),
    entryId
      ? prisma.entry.findUnique({
          where: { id: entryId },
          include: {
            owner: true,
            picks: {
              orderBy: {
                rank: "asc",
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    teams,
    entry,
    lockInfo: getLockInfo(matches),
    initialRanks: entry?.picks.length
      ? entry.picks.map((pick) => ({ rank: pick.rank, teamId: pick.teamId }))
      : buildEmptyRanks(),
  };
}

export function canEditEntry({
  userId,
  userRole,
  ownerId,
  isLocked,
}: {
  userId: string;
  userRole: Role;
  ownerId: string;
  isLocked: boolean;
}) {
  if (userRole === Role.ADMIN) {
    return true;
  }

  return !isLocked && userId === ownerId;
}

export function canViewEntry({
  viewerId,
  viewerRole,
  ownerId,
  lockInfo,
}: {
  viewerId?: string | null;
  viewerRole?: Role | null;
  ownerId: string;
  lockInfo: ReturnType<typeof getLockInfo>;
}) {
  return shouldRevealEntry({
    viewerId,
    ownerId,
    viewerRole,
    lockInfo,
  });
}
