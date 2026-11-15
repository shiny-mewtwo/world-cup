import { MatchStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  extractFootballDataScores,
  extractFootballDataWinnerSide,
  footballDataTeamCode,
  mapFootballDataMatchStatus,
  normalizeFootballDataGroupName,
  parseFootballDataDate,
} from "./football-data-normalizers";

describe("football-data normalizers", () => {
  it("normalizes group labels and team codes", () => {
    expect(normalizeFootballDataGroupName("GROUP_K")).toBe("K");
    expect(normalizeFootballDataGroupName("Group L")).toBe("L");
    expect(normalizeFootballDataGroupName("Central Division")).toBeNull();
    expect(normalizeFootballDataGroupName("GROUP_M")).toBeNull();
    expect(footballDataTeamCode({ id: 771, tla: "usa" })).toBe("USA");
    expect(footballDataTeamCode({ id: 1060, tla: null })).toBe("FD1060");
  });

  it("parses UTC kickoff dates from football-data timestamps", () => {
    expect(parseFootballDataDate("2026-06-13T01:00:00Z")?.toISOString()).toBe(
      "2026-06-13T01:00:00.000Z",
    );
  });

  it("maps football-data match statuses into local match statuses", () => {
    expect(mapFootballDataMatchStatus("TIMED")).toBe(MatchStatus.SCHEDULED);
    expect(mapFootballDataMatchStatus("IN_PLAY")).toBe(MatchStatus.LIVE);
    expect(mapFootballDataMatchStatus("FINISHED")).toBe(MatchStatus.COMPLETED);
  });

  it("extracts full-time scores", () => {
    expect(
      extractFootballDataScores({
        fullTime: {
          home: 2,
          away: 1,
        },
      }),
    ).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("excludes penalty shootout goals from full-time scores", () => {
    expect(
      extractFootballDataScores({
        duration: "PENALTY_SHOOTOUT",
        fullTime: {
          home: 3,
          away: 5,
        },
        penalties: {
          home: 2,
          away: 4,
        },
      }),
    ).toEqual({ homeScore: 1, awayScore: 1 });
  });

  it("preserves extra-time goals when excluding penalty shootout goals", () => {
    expect(
      extractFootballDataScores({
        duration: "PENALTY_SHOOTOUT",
        fullTime: {
          home: 8,
          away: 7,
        },
        penalties: {
          home: 5,
          away: 4,
        },
      }),
    ).toEqual({ homeScore: 3, awayScore: 3 });
  });

  it("maps a declared match winner to the corresponding side", () => {
    expect(extractFootballDataWinnerSide({ winner: "HOME_TEAM" })).toBe("home");
    expect(extractFootballDataWinnerSide({ winner: "AWAY_TEAM" })).toBe("away");
    expect(extractFootballDataWinnerSide({ winner: "DRAW" })).toBeNull();
    expect(extractFootballDataWinnerSide(undefined)).toBeNull();
  });
});
