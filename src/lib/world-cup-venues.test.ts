import { describe, expect, it } from "vitest";

import {
  FOOTBALL_DATA_MATCH_VENUES,
  getFootballDataMatchVenue,
} from "./world-cup-venues";

describe("World Cup venue mapping", () => {
  it("covers every football-data.org 2026 fixture", () => {
    expect(Object.keys(FOOTBALL_DATA_MATCH_VENUES)).toHaveLength(104);
  });

  it("returns FIFA venue names for known football-data.org fixture ids", () => {
    expect(getFootballDataMatchVenue("537327")).toBe("Mexico City Stadium, Mexico City");
    expect(getFootballDataMatchVenue("537390")).toBe("New York/New Jersey Stadium, New York");
  });

  it("falls back to null for unknown or missing ids", () => {
    expect(getFootballDataMatchVenue("unknown")).toBeNull();
    expect(getFootballDataMatchVenue(null)).toBeNull();
  });
});
