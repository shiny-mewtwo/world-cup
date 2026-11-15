import { LocalDateTime } from "@/components/local-date-time";
import { OPENING_MATCH_LABEL } from "@/lib/constants";

type LockInfoLabelProps = {
  lockAt: Date | null;
};

export function LockInfoLabel({ lockAt }: LockInfoLabelProps) {
  if (!lockAt) {
    return <>{OPENING_MATCH_LABEL} not scheduled</>;
  }

  return (
    <>
      {OPENING_MATCH_LABEL}:{" "}
      <LocalDateTime isoDate={lockAt.toISOString()} includeWeekday />
    </>
  );
}
