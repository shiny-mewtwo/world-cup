const PUBLIC_TEAM_NAMES: Record<string, string> = {
  "IR Iran": "Iran",
  "Korea Republic": "South Korea",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "Côte d'Ivoire": "Ivory Coast",
  Turkey: "Türkiye",
  "Congo DR": "DR Congo",
};

const TEAM_FLAG_CODES_BY_TEAM_CODE: Record<string, string> = {
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CIV: "ci",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRO: "hr",
  CUR: "cw",
  CZE: "cz",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  IRN: "ir",
  IRQ: "iq",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  POR: "pt",
  QAT: "qa",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  URU: "uy",
  USA: "us",
  UZB: "uz",
};

const TEAM_FLAG_CODES_BY_NAME: Record<string, string> = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  "Bosnia-Herzegovina": "ba",
  Brazil: "br",
  Canada: "ca",
  "Cape Verde Islands": "cv",
  "Cabo Verde": "cv",
  Colombia: "co",
  "Congo DR": "cd",
  Croatia: "hr",
  Curaçao: "cw",
  Czechia: "cz",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  "IR Iran": "ir",
  Iraq: "iq",
  "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci",
  Japan: "jp",
  Jordan: "jo",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  "South Korea": "kr",
  "Korea Republic": "kr",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkey: "tr",
  Türkiye: "tr",
  "United States": "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
};

type TeamIdentity = {
  code?: string | null;
  name?: string | null;
};

export function getTeamFlagCode(team: TeamIdentity) {
  const teamCode = team.code?.trim().toUpperCase();

  if (teamCode && TEAM_FLAG_CODES_BY_TEAM_CODE[teamCode]) {
    return TEAM_FLAG_CODES_BY_TEAM_CODE[teamCode];
  }

  const name = team.name?.trim();
  return name ? TEAM_FLAG_CODES_BY_NAME[name] ?? null : null;
}

export function getDisplayTeamName(name: string) {
  return PUBLIC_TEAM_NAMES[name] ?? name;
}

export function formatTeamName(name: string) {
  return getDisplayTeamName(name);
}

const STAGE_LABELS: Record<string, string> = {
  FINAL: "Final",
  LAST_16: "Round of 16",
  LAST_32: "Round of 32",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third place",
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  LIVE: "Live",
  SCHEDULED: "Scheduled",
};

export function formatStageLabel(stage: string) {
  return STAGE_LABELS[stage] ?? stage;
}

export function formatMatchStatus(status: string) {
  return MATCH_STATUS_LABELS[status] ?? status;
}

export function formatLocalDateTime(
  date: Date,
  options?: {
    includeWeekday?: boolean;
    timeZone?: string;
  },
) {
  return new Intl.DateTimeFormat("en-US", {
    ...(options?.includeWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
    timeZoneName: "short",
  }).format(date);
}

export function getInitials(name?: string | null, email?: string | null) {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "") || "?";
  const parts = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return parts.map((part) => part[0]!.toUpperCase()).join("");
}

export function getPublicDisplayName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Pool entrant";
}
