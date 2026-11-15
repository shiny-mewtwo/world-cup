import clsx from "clsx";

import { getDisplayTeamName, getTeamFlagCode } from "@/lib/formatting";

type TeamLabelProps = {
  team: {
    code?: string | null;
    name: string;
  };
  className?: string;
};

export function TeamLabel({ team, className }: TeamLabelProps) {
  const flagCode = getTeamFlagCode(team);
  const displayName = getDisplayTeamName(team.name);

  return (
    <span className={clsx("team-label", className)}>
      {flagCode ? (
        <span
          aria-hidden="true"
          className={clsx("fi", `fi-${flagCode}`, "team-flag")}
        />
      ) : (
        <span aria-hidden="true" className="team-flag team-flag-empty" />
      )}
      <span className="team-name">{displayName}</span>
    </span>
  );
}
