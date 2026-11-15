import { ENTRY_SIZE } from "@/lib/constants";

export type RankedPick = {
  rank: number;
  teamId: string;
};

export function deltaToPoints(delta: number) {
  if (delta === 0) {
    return 3;
  }

  if (delta === 1) {
    return 2;
  }

  if (delta === 2) {
    return 1;
  }

  return 0;
}

export function scoreEntry(
  picks: RankedPick[],
  officialOrder: RankedPick[],
) {
  const officialByTeam = new Map(officialOrder.map((item) => [item.teamId, item.rank]));

  const slotBreakdown = picks
    .slice()
    .sort((left, right) => left.rank - right.rank)
    .map((pick) => {
      const officialRank = officialByTeam.get(pick.teamId);
      const delta =
        officialRank === undefined ? undefined : Math.abs(officialRank - pick.rank);

      return {
        rank: pick.rank,
        teamId: pick.teamId,
        officialRank,
        points: delta === undefined ? 0 : deltaToPoints(delta),
      };
    });

  return {
    slotBreakdown,
    points: slotBreakdown.reduce((sum, slot) => sum + slot.points, 0),
    officialSlotsPublished: officialOrder.length,
    isComplete: officialOrder.length >= ENTRY_SIZE,
  };
}
