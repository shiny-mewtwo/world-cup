import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EntryStatus } from "@prisma/client";

import { EntryShareButton } from "@/components/entry-share-button";
import { TeamLabel } from "@/components/team-label";
import { getEntryDetail } from "@/lib/data";
import { getPublicDisplayName } from "@/lib/formatting";
import { getEntryStatusLabel, getTeamTournamentStatus } from "@/lib/tournament";

export async function generateStaticParams() { return (await prisma.entry.findMany({ select: { id: true } })).map(({ id }) => ({ entryId: id })); }

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const detail = await getEntryDetail(entryId);

  if (
    !detail ||
    (detail.entry.status !== EntryStatus.SUBMITTED && detail.entry.status !== EntryStatus.LOCKED)
  ) {
    notFound();
  }

  const entrantName = getPublicDisplayName(detail.entry.owner.name);
  const shareImageFileName = `world-cup-picks-${detail.entry.id}.png`;
  const shareImagePath = `/entries/${detail.entry.id}/share-image.png`;
  const scoreSlotsByTeam = new Map(
    detail.score.slotBreakdown.map((slot) => [slot.teamId, slot]),
  );

  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">Entry detail</span>
        <h1>{detail.entry.name}</h1>
        <p>
          Owned by {entrantName} ·{" "}
          {getEntryStatusLabel(detail.entry)}
        </p>
      </section>

      <div className="button-row">
        <EntryShareButton
          fileName={shareImageFileName}
          imagePath={shareImagePath}
          title={`${entrantName}'s World Cup picks`}
        />
      </div>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>{detail.lockInfo.isLocked ? "Current points" : "Scoring"}</span>
          <strong>{detail.lockInfo.isLocked ? detail.score.points : "Not live yet"}</strong>
          <small>
            {detail.lockInfo.isLocked
              ? "using the active published order"
              : "Points appear once the tournament begins."}
          </small>
        </article>
        <article className="metric-card">
          <span>Published slots</span>
          <strong>{detail.score.officialSlotsPublished}/32</strong>
          <small>official scoring positions available</small>
        </article>
        <article className="metric-card">
          <span>Visibility</span>
          <strong>Public archive</strong>
          <small>
            Saved entry · editing closed
          </small>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Submitted order</h2>
            <p>These picks are preserved as part of the pool archive.</p>
          </div>
        </div>
        <div className="rank-grid">
          {detail.entry.picks.map((pick) => {
            const teamStatus = getTeamTournamentStatus({
              teamId: pick.teamId,
              officialOrder: detail.officialOrder,
              matches: detail.matches,
            });
            const scoreSlot = scoreSlotsByTeam.get(pick.teamId);
            const scorePoints = scoreSlot?.points ?? 0;
            const scoreLabel = scorePoints > 0 ? `+${scorePoints}` : "0 pts";
            const cardTone =
              scorePoints > 0
                ? "is-scoring"
                : teamStatus.status === "dnq"
                  ? "is-confirmed-zero"
                  : "";

            return (
              <article
                className={`rank-card static-rank-card ${cardTone}`}
                key={pick.id}
              >
                <div className="board-rank-header">
                  <span className="rank-label">#{pick.rank}</span>
                  <div className="entry-pick-pill-row">
                    <span className={`entry-points-pill ${scorePoints > 0 ? "is-scoring" : ""}`}>
                      {scoreLabel}
                    </span>
                    <span className={`team-status-pill team-status-${teamStatus.status}`}>
                      {teamStatus.statusLabel}
                    </span>
                  </div>
                </div>
                <strong>
                  <TeamLabel team={pick.team} />
                </strong>
                <small>Current rank: {teamStatus.currentRankLabel}</small>
              </article>
            );
          })}
        </div>
      </section>

    </div>
  );
}
