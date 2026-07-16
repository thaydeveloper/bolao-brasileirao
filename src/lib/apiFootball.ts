/**
 * Integração com a API-Football (api-sports.io) — usada só para o AO VIVO
 * (placar corrente, minuto de jogo e gols) do Brasileirão Série A (league id 71).
 *
 * Plano gratuito: 100 requisições/dia. Por isso o sync é fortemente throttled
 * (ver COOLDOWN em live.ts) e só chamamos quando há jogo em andamento.
 * Endpoint usado: GET /fixtures?live=all  → 1 request devolve todos os jogos ao vivo.
 */

const BASE = "https://v3.football.api-sports.io";
export const LEAGUE_BSA = 71; // Brasileirão Série A na API-Football

export class ApiFootballError extends Error {}

function key(): string {
  return (process.env.API_FOOTBALL_KEY ?? "").trim();
}

export function isApiFootballConfigured(): boolean {
  return key().length > 0;
}

// Mapeia os códigos de status da API-Football para a semântica interna do bolão.
const IN_PLAY = new Set(["1H", "2H", "ET", "P", "LIVE"]);
const PAUSED = new Set(["HT", "BT", "INT"]);
const FINISHED = new Set(["FT", "AET", "PEN"]);
const SCHEDULED = new Set(["NS", "TBD"]);

export function normalizeStatus(short: string | null | undefined): string {
  if (!short) return "OTHER";
  if (IN_PLAY.has(short)) return "IN_PLAY";
  if (PAUSED.has(short)) return "PAUSED";
  if (FINISHED.has(short)) return "FINISHED";
  if (SCHEDULED.has(short)) return "TIMED";
  return "OTHER";
}

export type ApiFixture = {
  kickoff: Date;
  homeName: string;
  awayName: string;
  status: string; // IN_PLAY | PAUSED | FINISHED | TIMED | OTHER
  home: number | null;
  away: number | null;
  minute: number | null;
};

/** Converte um item cru de /fixtures no formato interno (função pura, testável). */
export function mapFixture(raw: any): ApiFixture {
  const elapsed = raw?.fixture?.status?.elapsed;
  return {
    kickoff: new Date(raw?.fixture?.date),
    homeName: raw?.teams?.home?.name ?? "?",
    awayName: raw?.teams?.away?.name ?? "?",
    status: normalizeStatus(raw?.fixture?.status?.short),
    home: raw?.goals?.home ?? null,
    away: raw?.goals?.away ?? null,
    minute: typeof elapsed === "number" ? elapsed : null,
  };
}

const STOPWORDS = new Set([
  "fc", "ec", "sc", "cr", "se", "ac", "rb", "afc", "clube", "futebol", "regatas",
  "de", "do", "da", "e",
]);

/** Tokens significativos do nome de um time (sem acento, sem siglas comuns). */
export function teamTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

/** Nº de tokens em comum entre dois nomes de time (0 = nomes não batem). */
export function teamSimilarity(a: string, b: string): number {
  const ta = teamTokens(a);
  const tb = new Set(teamTokens(b));
  return ta.filter((t) => tb.has(t)).length;
}

/**
 * Pontua o quanto um fixture da API corresponde a uma partida nossa: exige que
 * AMBOS os times batam minimamente e que o kickoff esteja na mesma janela (±3h).
 * 0 = não corresponde. Maior = melhor. Pura e determinística.
 */
export function fixtureScore(
  our: { homeTeam: string; awayTeam: string; kickoff: Date },
  f: ApiFixture
): number {
  const dt = Math.abs(f.kickoff.getTime() - our.kickoff.getTime());
  if (dt > 3 * 60 * 60 * 1000) return 0;
  const h = teamSimilarity(our.homeTeam, f.homeName);
  const a = teamSimilarity(our.awayTeam, f.awayName);
  if (h === 0 || a === 0) return 0;
  const timeScore = 1 - dt / (3 * 60 * 60 * 1000); // 0..1, quanto mais perto do horário melhor
  return h + a + timeScore;
}

/** Melhor fixture correspondente a uma partida nossa (ou null). */
export function bestFixtureFor(
  our: { homeTeam: string; awayTeam: string; kickoff: Date },
  fixtures: ApiFixture[]
): ApiFixture | null {
  let best: ApiFixture | null = null;
  let bestScore = 0;
  for (const f of fixtures) {
    const s = fixtureScore(our, f);
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }
  return best;
}

/** Busca todos os jogos AO VIVO do Brasileirão (1 request). */
export async function fetchLiveFixtures(): Promise<ApiFixture[]> {
  const k = key();
  if (!k) throw new ApiFootballError("API_FOOTBALL_KEY não configurada.");

  const res = await fetch(`${BASE}/fixtures?live=all`, {
    headers: { "x-apisports-key": k },
    cache: "no-store",
  });
  if (res.status === 429) throw new ApiFootballError("Limite diário da API-Football (100/dia) atingido.");
  if (!res.ok) throw new ApiFootballError(`Erro na API-Football (HTTP ${res.status}).`);

  const data = await res.json();
  const errors = data?.errors;
  if (errors && ((Array.isArray(errors) && errors.length) || (!Array.isArray(errors) && Object.keys(errors).length))) {
    throw new ApiFootballError(`API-Football: ${JSON.stringify(errors)}`);
  }
  const list: any[] = Array.isArray(data?.response) ? data.response : [];
  return list.filter((r) => r?.league?.id === LEAGUE_BSA).map(mapFixture);
}
