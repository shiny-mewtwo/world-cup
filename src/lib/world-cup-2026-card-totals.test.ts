import { describe, expect, it } from "vitest";

import { getWorldCup2026CardTotals } from "./world-cup-2026-card-totals";

describe("World Cup 2026 FotMob card totals", () => {
  it.each([
    ["ARG", 13, 1],
    ["CAN", 11, 0],
    ["EGY", 12, 0],
    ["ENG", 8, 1],
    ["ESP", 6, 0],
    ["FRA", 6, 0],
    ["PAR", 9, 1],
    ["SUI", 6, 1],
    ["SWE", 5, 0],
  ])("stores %s as %i yellow and %i red cards", (code, yellowCards, redCards) => {
    expect(getWorldCup2026CardTotals(code)).toEqual({ yellowCards, redCards });
  });
});
