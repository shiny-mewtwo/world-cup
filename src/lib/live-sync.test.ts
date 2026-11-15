import { MatchStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { shouldSyncLiveResults } from "@/lib/live-sync";

describe("shouldSyncLiveResults", () => {
  it("skips when no match is inside the live polling window", () => {
    const decision = shouldSyncLiveResults({
      now: new Date("2026-06-11T15:00:00.000Z"),
      matches: [
        {
          kickoffAt: new Date("2026-06-11T18:00:00.000Z"),
          status: MatchStatus.SCHEDULED,
        },
      ],
    });

    expect(decision.shouldSync).toBe(false);
  });

  it("allows sync shortly before kickoff", () => {
    const decision = shouldSyncLiveResults({
      now: new Date("2026-06-11T17:52:00.000Z"),
      matches: [
        {
          kickoffAt: new Date("2026-06-11T18:00:00.000Z"),
          status: MatchStatus.SCHEDULED,
        },
      ],
    });

    expect(decision.shouldSync).toBe(true);
  });

  it("allows sync for an in-progress match", () => {
    const decision = shouldSyncLiveResults({
      now: new Date("2026-06-11T19:00:00.000Z"),
      matches: [
        {
          kickoffAt: new Date("2026-06-11T18:00:00.000Z"),
          status: MatchStatus.LIVE,
        },
      ],
    });

    expect(decision.shouldSync).toBe(true);
  });

  it("allows recently completed matches inside the post-kickoff window", () => {
    const decision = shouldSyncLiveResults({
      now: new Date("2026-06-11T19:00:00.000Z"),
      matches: [
        {
          kickoffAt: new Date("2026-06-11T18:00:00.000Z"),
          status: MatchStatus.COMPLETED,
        },
      ],
    });

    expect(decision.shouldSync).toBe(true);
  });

  it("skips completed matches after the post-kickoff window", () => {
    const decision = shouldSyncLiveResults({
      now: new Date("2026-06-11T22:01:00.000Z"),
      matches: [
        {
          kickoffAt: new Date("2026-06-11T18:00:00.000Z"),
          status: MatchStatus.COMPLETED,
        },
      ],
    });

    expect(decision.shouldSync).toBe(false);
  });

  it("skips when the last attempt is inside the minimum interval", () => {
    const decision = shouldSyncLiveResults({
      now: new Date("2026-06-11T18:00:30.000Z"),
      checkpoint: {
        lastAttemptAt: new Date("2026-06-11T18:00:00.000Z"),
      },
      matches: [
        {
          kickoffAt: new Date("2026-06-11T18:00:00.000Z"),
          status: MatchStatus.LIVE,
        },
      ],
    });

    expect(decision.shouldSync).toBe(false);
  });
});
