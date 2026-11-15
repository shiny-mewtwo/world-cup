import { MatchStatus } from "@prisma/client";

type LiveSyncMatch = {
  kickoffAt: Date;
  status: MatchStatus;
};

type LiveSyncCheckpoint = {
  lastAttemptAt: Date | null;
};

type LiveSyncDecisionOptions = {
  matches: LiveSyncMatch[];
  checkpoint?: LiveSyncCheckpoint | null;
  now?: Date;
  preKickoffWindowMs?: number;
  postKickoffWindowMs?: number;
  minIntervalMs?: number;
};

export type LiveSyncDecision = {
  shouldSync: boolean;
  message: string;
};

const DEFAULT_PRE_KICKOFF_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_POST_KICKOFF_WINDOW_MS = 4 * 60 * 60 * 1000;
const DEFAULT_MIN_INTERVAL_MS = 60 * 1000;

export function shouldSyncLiveResults({
  matches,
  checkpoint,
  now = new Date(),
  preKickoffWindowMs = DEFAULT_PRE_KICKOFF_WINDOW_MS,
  postKickoffWindowMs = DEFAULT_POST_KICKOFF_WINDOW_MS,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
}: LiveSyncDecisionOptions): LiveSyncDecision {
  const lastAttemptAt = checkpoint?.lastAttemptAt;

  if (lastAttemptAt && now.getTime() - lastAttemptAt.getTime() < minIntervalMs) {
    return {
      shouldSync: false,
      message: "Live sync skipped because the last attempt was too recent.",
    };
  }

  const activeMatch = matches.find((match) => {
    const kickoffMs = match.kickoffAt.getTime();
    const startsAt = kickoffMs - preKickoffWindowMs;
    const endsAt = kickoffMs + postKickoffWindowMs;

    return now.getTime() >= startsAt && now.getTime() <= endsAt;
  });

  if (!activeMatch) {
    return {
      shouldSync: false,
      message: "Live sync skipped because no match is near or inside its live window.",
    };
  }

  return {
    shouldSync: true,
    message: "Live sync allowed because at least one match is near or inside its live window.",
  };
}
