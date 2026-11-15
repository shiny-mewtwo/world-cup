import { describe, expect, it } from "vitest";

import {
  formatLocalDateTime,
  formatMatchStatus,
  formatStageLabel,
  formatTeamName,
  getDisplayTeamName,
  getTeamFlagCode,
} from "./formatting";

describe("team formatting", () => {
  it("displays Turkey as Türkiye for football-data.org payloads", () => {
    expect(getDisplayTeamName("Turkey")).toBe("Türkiye");
    expect(formatTeamName("Turkey")).toBe("Türkiye");
  });

  it("keeps already-normalized Türkiye display names unchanged", () => {
    expect(getDisplayTeamName("Türkiye")).toBe("Türkiye");
    expect(formatTeamName("Türkiye")).toBe("Türkiye");
  });

  it("maps football team codes to rectangular flag asset codes", () => {
    expect(getTeamFlagCode({ code: "TUR", name: "Turkey" })).toBe("tr");
    expect(getTeamFlagCode({ code: "ENG", name: "England" })).toBe("gb-eng");
    expect(getTeamFlagCode({ code: "SCO", name: "Scotland" })).toBe("gb-sct");
  });

  it("falls back to names for seeded teams without football-data.org codes", () => {
    expect(getTeamFlagCode({ code: "T16", name: "Türkiye" })).toBe("tr");
    expect(getTeamFlagCode({ code: "T46", name: "England" })).toBe("gb-eng");
  });

  it("formats tournament stages for display", () => {
    expect(formatStageLabel("LAST_32")).toBe("Round of 32");
    expect(formatStageLabel("LAST_16")).toBe("Round of 16");
    expect(formatStageLabel("QUARTER_FINALS")).toBe("Quarter-finals");
    expect(formatStageLabel("SEMI_FINALS")).toBe("Semi-finals");
    expect(formatStageLabel("THIRD_PLACE")).toBe("Third place");
    expect(formatStageLabel("FINAL")).toBe("Final");
    expect(formatStageLabel("GROUP_STAGE")).toBe("GROUP_STAGE");
  });

  it("formats match statuses for display", () => {
    expect(formatMatchStatus("SCHEDULED")).toBe("Scheduled");
    expect(formatMatchStatus("LIVE")).toBe("Live");
    expect(formatMatchStatus("COMPLETED")).toBe("Completed");
    expect(formatMatchStatus("POSTPONED")).toBe("POSTPONED");
  });

  it("formats local dates with an explicit timezone when provided", () => {
    const date = new Date("2026-06-11T19:00:00.000Z");

    expect(
      formatLocalDateTime(date, {
        includeWeekday: true,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("Thu, Jun 11, 2026, 12:00 PM PDT");
    expect(
      formatLocalDateTime(date, {
        includeWeekday: true,
        timeZone: "UTC",
      }),
    ).toBe("Thu, Jun 11, 2026, 7:00 PM UTC");
  });
});
