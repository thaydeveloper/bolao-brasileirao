/**
 * Integração com a API football-data.org (competição BSA = Brasileirão Série A).
 * Documentação: https://www.football-data.org/documentation/quickstart
 *
 * O plano gratuito cobre a Série A do Brasil com todas as partidas, tabela e
 * escudos dos times. Basta cadastrar-se (grátis) e definir FOOTBALL_DATA_TOKEN
 * no arquivo .env.
 */

const BASE = "https://api.football-data.org/v4";
const COMPETITION = "BSA";

export class FootballApiError extends Error {}

function token(): string {
  return (process.env.FOOTBALL_DATA_TOKEN ?? "").trim();
}

export function isConfigured(): boolean {
  return token().length > 0;
}

export const SETUP_MESSAGE =
  "Integração não configurada. Cadastre-se grátis em football-data.org/client/register, " +
  "copie seu token e defina FOOTBALL_DATA_TOKEN no arquivo .env.";

async function api(path: string, revalidateSeconds: number): Promise<any> {
  const t = token();
  if (!t) throw new FootballApiError(SETUP_MESSAGE);

  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Auth-Token": t },
    // 0 = sempre buscar dados frescos (usado na importação); >0 = cache (usado na tabela)
    ...(revalidateSeconds > 0
      ? { next: { revalidate: revalidateSeconds } }
      : { cache: "no-store" as const }),
  });

  if (res.status === 403)
    throw new FootballApiError(
      "Token inválido ou sem acesso ao Brasileirão. Verifique o FOOTBALL_DATA_TOKEN."
    );
  if (res.status === 429)
    throw new FootballApiError(
      "Limite de requisições atingido (10/min no plano gratuito). Aguarde alguns instantes e tente de novo."
    );
  if (!res.ok) throw new FootballApiError(`Erro na API de futebol (HTTP ${res.status}).`);

  return res.json();
}

// ---------- Partidas ----------

export type FootballMatch = {
  externalId: number;
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  homeCrest: string | null;
  awayCrest: string | null;
  kickoff: Date;
  finished: boolean;
  homeScore: number | null;
  awayScore: number | null;
};

/** Converte a resposta crua da API no formato interno (função pura, testável). */
export function mapMatch(raw: any): FootballMatch {
  const finished = raw.status === "FINISHED";
  return {
    externalId: raw.id,
    matchday: raw.matchday ?? 0,
    homeTeam: raw.homeTeam?.shortName || raw.homeTeam?.name || "?",
    awayTeam: raw.awayTeam?.shortName || raw.awayTeam?.name || "?",
    homeCrest: raw.homeTeam?.crest ?? null,
    awayCrest: raw.awayTeam?.crest ?? null,
    kickoff: new Date(raw.utcDate),
    finished,
    homeScore: finished ? raw.score?.fullTime?.home ?? null : null,
    awayScore: finished ? raw.score?.fullTime?.away ?? null : null,
  };
}

export async function fetchMatches(season: string): Promise<FootballMatch[]> {
  const data = await api(`/competitions/${COMPETITION}/matches?season=${season}`, 0);
  const matches: any[] = data.matches ?? [];
  return matches
    .map(mapMatch)
    .filter((m) => m.matchday > 0)
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
}

// ---------- Tabela / classificação ----------

export type StandingRow = {
  position: number;
  team: string;
  crest: string | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;
};

export function mapStandingRow(raw: any): StandingRow {
  return {
    position: raw.position,
    team: raw.team?.shortName || raw.team?.name || "?",
    crest: raw.team?.crest ?? null,
    played: raw.playedGames ?? 0,
    won: raw.won ?? 0,
    draw: raw.draw ?? 0,
    lost: raw.lost ?? 0,
    goalsFor: raw.goalsFor ?? 0,
    goalsAgainst: raw.goalsAgainst ?? 0,
    goalDifference: raw.goalDifference ?? 0,
    points: raw.points ?? 0,
    form: raw.form ?? null,
  };
}

export type Standings = {
  season: string;
  rows: StandingRow[];
};

export async function fetchStandings(season: string): Promise<Standings> {
  const data = await api(`/competitions/${COMPETITION}/standings?season=${season}`, 3600);
  const total = (data.standings ?? []).find((s: any) => s.type === "TOTAL") ?? data.standings?.[0];
  const rows: StandingRow[] = (total?.table ?? []).map(mapStandingRow);
  return { season: data.filters?.season ?? season, rows };
}
