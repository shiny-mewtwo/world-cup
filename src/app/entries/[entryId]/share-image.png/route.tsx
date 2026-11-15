import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { EntryStatus } from "@prisma/client";

import { ImageResponse } from "next/og";

import { ENTRY_SIZE } from "@/lib/constants";
import {
  getDisplayTeamName,
  getPublicDisplayName,
  getTeamFlagCode,
} from "@/lib/formatting";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-static";

const imageSize = {
  width: 1080,
  height: 1350,
};

type PickSlot = {
  flagDataUri: string | null;
  rank: number;
  teamName: string;
};

const flagDataUriCache = new Map<string, Promise<string | null>>();
let yscMarkDataUriPromise: Promise<string | null> | null = null;

function getPossessiveName(name: string) {
  const trimmed = name.trim();

  if (trimmed.toLowerCase().endsWith("s")) {
    return `${trimmed}'`;
  }

  return `${trimmed}'s`;
}

function getTitleFontSize(title: string) {
  if (title.length > 34) {
    return 44;
  }

  if (title.length > 26) {
    return 54;
  }

  return 66;
}

function getSiteLabel() {
  const siteUrl = process.env.AUTH_URL ?? "https://worldcup.michaelsparre.com";

  try {
    return new URL(siteUrl).host;
  } catch {
    return "2026 World Cup Pool";
  }
}

async function getFlagDataUri(flagCode: string | null) {
  if (!flagCode || !/^[a-z0-9-]+$/.test(flagCode)) {
    return null;
  }

  const cached = flagDataUriCache.get(flagCode);

  if (cached) {
    return cached;
  }

  const flagPromise = readFile(
    join(process.cwd(), "node_modules", "flag-icons", "flags", "4x3", `${flagCode}.svg`),
  )
    .then((flagSvg) => `data:image/svg+xml;base64,${flagSvg.toString("base64")}`)
    .catch(() => null);

  flagDataUriCache.set(flagCode, flagPromise);
  return flagPromise;
}

async function getYscMarkDataUri() {
  yscMarkDataUriPromise ??= readFile(
    join(process.cwd(), "public", "assets", "ysc-flag.png"),
  )
    .then((image) => `data:image/png;base64,${image.toString("base64")}`)
    .catch(() => null);

  return yscMarkDataUriPromise;
}

function splitColumns(slots: PickSlot[]) {
  return [slots.slice(0, 16), slots.slice(16)];
}

function renderPickRow(slot: PickSlot) {
  return (
    <div
      key={slot.rank}
      style={{
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.66)",
        border: "1px solid rgba(55, 45, 28, 0.12)",
        borderRadius: 18,
        display: "flex",
        gap: 14,
        height: 46,
        padding: "7px 12px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: "rgba(10, 108, 95, 0.10)",
          border: "1px solid rgba(10, 108, 95, 0.18)",
          borderRadius: 999,
          color: "#074a42",
          display: "flex",
          flexShrink: 0,
          fontFamily: "Arial",
          fontSize: 18,
          fontWeight: 700,
          height: 30,
          justifyContent: "center",
          lineHeight: 1,
          width: 42,
        }}
      >
        {slot.rank.toString().padStart(2, "0")}
      </div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexShrink: 0,
          height: 24,
          justifyContent: "center",
          width: 34,
        }}
      >
        {slot.flagDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            height={24}
            src={slot.flagDataUri}
            style={{
              borderRadius: 4,
              boxShadow: "0 2px 4px rgba(31, 27, 19, 0.18)",
            }}
            width={34}
          />
        ) : (
          <div
            style={{
              backgroundColor: "rgba(109, 98, 81, 0.14)",
              borderRadius: 4,
              height: 24,
              width: 34,
            }}
          />
        )}
      </div>
      <div
        style={{
          color: "#1f1b13",
          display: "flex",
          flex: 1,
          fontFamily: "Arial",
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.12,
        }}
      >
        {slot.teamName}
      </div>
    </div>
  );
}

export async function generateStaticParams() { return (await prisma.entry.findMany({ select: { id: true } })).map(({ id }) => ({ entryId: id })); }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params;
  const entry = await prisma.entry.findUnique({
    where: {
      id: entryId,
      status: { in: [EntryStatus.SUBMITTED, EntryStatus.LOCKED] },
    },
    select: {
      owner: {
        select: {
          name: true,
        },
      },
      picks: {
        orderBy: {
          rank: "asc",
        },
        select: {
          rank: true,
          team: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!entry) {
    return new Response("Entry not found", { status: 404 });
  }

  const picksByRank = new Map(entry.picks.map((pick) => [pick.rank, pick.team]));
  const slots = await Promise.all(
    Array.from({ length: ENTRY_SIZE }, async (_, index): Promise<PickSlot> => {
      const rank = index + 1;
      const team = picksByRank.get(rank);

      if (!team) {
        return {
          flagDataUri: null,
          rank,
          teamName: "Open pick",
        };
      }

      return {
        flagDataUri: await getFlagDataUri(getTeamFlagCode(team)),
        rank,
        teamName: getDisplayTeamName(team.name),
      };
    }),
  );
  const entrantName = getPublicDisplayName(entry.owner.name);
  const title = `${getPossessiveName(entrantName)} Picks`;
  const yscMarkDataUri = await getYscMarkDataUri();
  const columns = splitColumns(slots);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: "#f4efe2",
            color: "#1f1b13",
            display: "flex",
            fontFamily: "Arial",
            height: "100%",
            padding: 56,
            width: "100%",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(255, 252, 247, 0.92)",
              border: "1px solid rgba(55, 45, 28, 0.16)",
              borderRadius: 34,
              boxShadow: "0 24px 70px rgba(68, 42, 13, 0.12)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              padding: 42,
              width: "100%",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 26,
                width: "100%",
              }}
            >
              <div
                style={{
                  color: "#074a42",
                  display: "flex",
                  fontFamily: "Arial",
                  fontSize: 25,
                  fontWeight: 800,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {"Scottie's World Cup Pool"}
              </div>
              {yscMarkDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  height={66}
                  src={yscMarkDataUri}
                  style={{
                    border: "2px solid rgba(199, 146, 42, 0.46)",
                    borderRadius: 999,
                    boxShadow: "0 8px 18px rgba(68, 42, 13, 0.14)",
                  }}
                  width={66}
                />
              ) : (
                <div
                  style={{
                    backgroundColor: "#c7922a",
                    borderRadius: 999,
                    display: "flex",
                    height: 12,
                    width: 96,
                  }}
                />
              )}
            </div>

            <div
              style={{
                borderBottom: "3px solid rgba(199, 146, 42, 0.44)",
                display: "flex",
                flexDirection: "column",
                marginBottom: 30,
                paddingBottom: 26,
                width: "100%",
              }}
            >
              <div
                style={{
                  color: "#1f1b13",
                  display: "flex",
                  fontFamily: "Arial",
                  fontSize: getTitleFontSize(title),
                  fontWeight: 900,
                  letterSpacing: -1,
                  lineHeight: 1,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  color: "#6d6251",
                  display: "flex",
                  fontFamily: "Arial",
                  fontSize: 26,
                  fontWeight: 700,
                  marginTop: 12,
                }}
              >
                Ranked final 32 predictions
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                gap: 24,
                width: "100%",
              }}
            >
              {columns.map((column, columnIndex) => (
                <div
                  key={columnIndex}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                    width: "50%",
                  }}
                >
                  {column.map(renderPickRow)}
                </div>
              ))}
            </div>

            <div
              style={{
                alignItems: "center",
                color: "#6d6251",
                display: "flex",
                fontFamily: "Arial",
                fontSize: 22,
                fontWeight: 700,
                justifyContent: "space-between",
                marginTop: 30,
                width: "100%",
              }}
            >
              <div style={{ display: "flex" }}>2026 World Cup Pool</div>
              <div style={{ color: "#074a42", display: "flex" }}>{getSiteLabel()}</div>
            </div>
          </div>
        </div>
      ),
      {
        ...imageSize,
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "Content-Disposition": `inline; filename="world-cup-picks-${entryId}.png"`,
        },
      },
    );
  } catch {
    return new Response("Failed to generate share image", { status: 500 });
  }
}
