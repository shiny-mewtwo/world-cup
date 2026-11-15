import { describe, expect, it } from "vitest";

import { deltaToPoints, scoreEntry } from "./scoring";

describe("deltaToPoints", () => {
  it("maps rank deltas to pool points", () => {
    expect(deltaToPoints(0)).toBe(3);
    expect(deltaToPoints(1)).toBe(2);
    expect(deltaToPoints(2)).toBe(1);
    expect(deltaToPoints(3)).toBe(0);
  });
});

describe("scoreEntry", () => {
  it("scores each slot against the official order", () => {
    const official = [
      { rank: 1, teamId: "A" },
      { rank: 2, teamId: "B" },
      { rank: 3, teamId: "C" },
      { rank: 4, teamId: "D" },
    ];

    const picks = [
      { rank: 1, teamId: "A" },
      { rank: 2, teamId: "C" },
      { rank: 3, teamId: "D" },
      { rank: 4, teamId: "B" },
    ];

    const result = scoreEntry(picks, official);

    expect(result.points).toBe(8);
    expect(result.slotBreakdown.map((slot) => slot.points)).toEqual([3, 2, 2, 1]);
  });
});
