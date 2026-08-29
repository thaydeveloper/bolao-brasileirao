import { prisma } from "./db";
import {
  fetchLiveSnapshots,
  fetchMatches,
  isConfigured as isFootballDataConfigured,
  liveTransitions,
  type LiveSnapshot,
} from "./football";
import {
  bestFixtureFor,
  fetchLiveFixtures,
  isApiFootballConfigured,
} from "./apiFootball";
import { notify, notifyRoundFinished, checkNewLeader } from "./notifications";
import { getGeneralLeaders } from "./ranking";
import { recomputeMatchPoints } from "./results";

// Cota: API-Football grátis = 100 req/dia → cooldown alto. football-data = 10 req/min → baixo.
const COOLDOWN_APIFOOTBALL_MS = 3 * 60 * 1000;
const COOLDOWN_FOOTBALLDATA_MS = 8 * 1000; // cooldown global; football-data grátis = 10 req/min → 8s ≈ 7,5/min (folga p/ reconcile/tabela)
const CANDIDATE_WINDOW_MS = 6 * 60 * 60 * 1000; // jogo "possivelmente ao vivo": começou nas últimas 6h
const FINALIZE_MIN_AGE_MS = 100 * 60 * 1000; // só finaliza "por ausência" após 100 min do kickoff
const RECONCILE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // reconciliação: jogos iniciados nos últimos 14 dias
const SYNC_KEY = "liveSync";

type Candidate = {
  id: number;
  roundId: number;
  externalId: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
  liveStatus: string | null;
  liveHome: number | null;
  liveAway: number | null;
  liveMinute: number | null;
  round: { number: number; season: string };
};

export type LiveMatchView = {
  id: number;
  roundNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeCrest: string | null;
  awayCrest: string | null;
  homeScore: number;
  awayScore: number;
  status: string | null;
  minute: number | null;
  kickoff: string;
  liveAt: string | null;
};

/** Partidas atualmente ao vivo (em andamento ou intervalo), para exibição. */
export async function getLiveMatches(now = new Date()): Promise<LiveMatchView[]> {
  const since = new Date(now.getTime() - CANDIDATE_WINDOW_MS);
  const matches = await prisma.match.findMany({
    where: {
      finished: false,
      liveStatus: { in: ["IN_PLAY", "PAUSED"] },
      kickoff: { gte: since },
    },
    include: { round: { select: { number: true } } },
    orderBy: { kickoff: "asc" },
  });

  return matches.map((m) => ({
    id: m.id,
    roundNumber: m.round.number,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeCrest: m.homeCrest,
    awayCrest: m.awayCrest,
    homeScore: m.liveHome ?? 0,
    awayScore: m.liveAway ?? 0,
    status: m.liveStatus,
    minute: m.liveMinute,
    kickoff: m.kickoff.toISOString(),
    liveAt: m.liveAt ? m.liveAt.toISOString() : null,
  }));
}

function activeProvider(): "apifootball" | "footballdata" | null {
  // football-data primeiro: cobre a Série A da temporada ATUAL no plano grátis.
  // O plano grátis da API-Football não serve fixtures da temporada corrente
  // (retorna vazio), então só a usamos se o football-data não estiver configurado.
  if (isFootballDataConfigured()) return "footballdata";
  if (isApiFootballConfigured()) return "apifootball";
  return null;
}

async function withinCooldown(now: Date, cooldownMs: number): Promise<boolean> {
  const meta = await prisma.appMeta.findUnique({ where: { key: SYNC_KEY } });
  return Boolean(meta && now.getTime() - meta.updatedAt.getTime() < cooldownMs);
}

async function markSynced(): Promise<void> {
  await prisma.appMeta.upsert({
    where: { key: SYNC_KEY },
    create: { key: SYNC_KEY, value: "1" },
    update: { value: "1" }, // @updatedAt registra o instante do sync
  });
}

/**
 * Busca os snapshots ao vivo dos candidatos na fonte ativa. Devolve um mapa
 * (id da NOSSA partida → snapshot) e o conjunto de ids vistos na resposta.
 * - API-Football: casa por horário + nome do time (ids diferentes entre provedores).
 * - football-data: casa pelo externalId (mesmo provedor da importação).
 */
async function fetchCandidateSnapshots(
  candidates: Candidate[],
  provider: "apifootball" | "footballdata"
): Promise<{ snapshots: Map<number, LiveSnapshot>; seen: Set<number> }> {
  const snapshots = new Map<number, LiveSnapshot>();
  const seen = new Set<number>();

  if (provider === "apifootball") {
    const fixtures = await fetchLiveFixtures();
    for (const c of candidates) {
      const f = bestFixtureFor(c, fixtures);
      if (!f) continue;
      seen.add(c.id);
      snapshots.set(c.id, {
        externalId: c.externalId ?? 0,
        status: f.status,
        home: f.home,
        away: f.away,
        minute: f.minute,
      });
    }
    return { snapshots, seen };
  }

  // football-data: 1 request por temporada devolve todas as partidas (por externalId)
  const byExternal = new Map<number, LiveSnapshot>();
  for (const season of new Set(candidates.map((c) => c.round.season))) {
    for (const snap of await fetchLiveSnapshots(season)) byExternal.set(snap.externalId, snap);
  }
  for (const c of candidates) {
    if (c.externalId == null) continue;
    const snap = byExternal.get(c.externalId);
    if (!snap) continue;
    seen.add(c.id);
    snapshots.set(c.id, snap);
  }
  return { snapshots, seen };
}

/**
 * Sincroniza os placares ao vivo, dispara notificações (bola rolando, gols com o
 * minuto, fim de jogo) e finaliza automaticamente partidas encerradas (grava o placar
 * oficial e repontua os palpites). Barato quando não há jogo: sem candidatos → sem
 * chamada à API. Idempotente e throttled; seguro no cron e a cada refresh do cliente.
 */
export async function syncLiveMatches(opts?: { force?: boolean }): Promise<LiveMatchView[]> {
  const provider = activeProvider();
  if (!provider) return getLiveMatches();

  const now = new Date();
  const since = new Date(now.getTime() - CANDIDATE_WINDOW_MS);

  const candidates = (await prisma.match.findMany({
    where: { finished: false, kickoff: { lte: now, gte: since } },
    select: {
      id: true,
      roundId: true,
      externalId: true,
      homeTeam: true,
      awayTeam: true,
      kickoff: true,
      liveStatus: true,
      liveHome: true,
      liveAway: true,
      liveMinute: true,
      round: { select: { number: true, season: true } },
    },
  })) as Candidate[];
  if (candidates.length === 0) return [];

  const cooldownMs =
    provider === "apifootball" ? COOLDOWN_APIFOOTBALL_MS : COOLDOWN_FOOTBALLDATA_MS;
  if (!opts?.force && (await withinCooldown(now, cooldownMs))) return getLiveMatches(now);
  await markSynced(); // marca antes do fetch para evitar estouro com vários clientes simultâneos

  let snapshots: Map<number, LiveSnapshot>;
  let seen: Set<number>;
  try {
    ({ snapshots, seen } = await fetchCandidateSnapshots(candidates, provider));
  } catch {
    return getLiveMatches(now); // API indisponível / cota: mantém os placares atuais
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  const notifyAll = (message: string, dedupeKey: string) =>
    Promise.all(
      users.map((u) =>
        notify(u.id, "ao-vivo", message, dedupeKey, { title: "Ao vivo ⚽", url: "/" })
      )
    );

  const previousLeaders = await getGeneralLeaders();
  const finishedRoundIds = new Set<number>();

  const finalize = async (c: Candidate, home: number, away: number) => {
    await prisma.match.update({
      where: { id: c.id },
      data: {
        homeScore: home,
        awayScore: away,
        finished: true,
        liveStatus: "FINISHED",
        liveHome: home,
        liveAway: away,
        liveAt: now,
      },
    });
    await recomputeMatchPoints(c.id, { home, away });
    await notifyAll(`🏁 Final: ${c.homeTeam} ${home} x ${away} ${c.awayTeam}`, `final-${c.id}`);
    finishedRoundIds.add(c.roundId);
  };

  for (const c of candidates) {
    const cur = snapshots.get(c.id);
    const prev: LiveSnapshot = {
      externalId: c.externalId ?? 0,
      status: c.liveStatus,
      home: c.liveHome,
      away: c.liveAway,
      minute: c.liveMinute,
    };

    if (cur) {
      const { started, goal, finished } = liveTransitions(prev, cur);

      if (started) {
        await notifyAll(`🟢 Bola rolando: ${c.homeTeam} x ${c.awayTeam}`, `inicio-${c.id}`);
      }
      if (goal) {
        const quando = cur.minute != null ? ` aos ${cur.minute}'` : "";
        await notifyAll(
          `⚽ GOOOL${quando}! ${c.homeTeam} ${cur.home} x ${cur.away} ${c.awayTeam}`,
          `gol-${c.id}-${cur.home}-${cur.away}`
        );
      }

      await prisma.match.update({
        where: { id: c.id },
        data: {
          liveStatus: cur.status,
          liveHome: cur.home,
          liveAway: cur.away,
          liveMinute: cur.minute,
          liveAt: now,
        },
      });

      if (finished && cur.home !== null && cur.away !== null) {
        await finalize(c, cur.home, cur.away);
      }
    } else {
      // Ausente da resposta ao vivo. Na API-Football o jogo encerrado sai do live=all:
      // se ele estava ao vivo e já passou tempo suficiente, finaliza pelo último placar.
      const wasLive = prev.status === "IN_PLAY" || prev.status === "PAUSED";
      const oldEnough = now.getTime() - c.kickoff.getTime() > FINALIZE_MIN_AGE_MS;
      if (
        provider === "apifootball" &&
        wasLive &&
        oldEnough &&
        c.liveHome !== null &&
        c.liveAway !== null
      ) {
        await finalize(c, c.liveHome, c.liveAway);
      }
    }
  }

  for (const roundId of finishedRoundIds) {
    const roundMatches = await prisma.match.findMany({ where: { roundId } });
    if (roundMatches.length > 0 && roundMatches.every((x) => x.finished)) {
      const number = candidates.find((c) => c.roundId === roundId)?.round.number ?? 0;
      await notifyRoundFinished(roundId, number);
    }
  }
  if (finishedRoundIds.size > 0) await checkNewLeader(previousLeaders);

  return getLiveMatches(now);
}

/**
 * Rede de segurança contra placar errado/atrasado. Busca o placar OFICIAL da
 * temporada no football-data e, dentro da janela, para cada jogo (com id externo e
 * NÃO marcado como resultado manual):
 *   - finaliza o que ainda não fechou (escapou do ao vivo); e
 *   - CORRIGE o que já fechou com placar diferente do oficial (ex.: o ao vivo
 *     gravou um gol depois anulado no VAR / correção de dados da API).
 * Sempre repontua os palpites. Resultados lançados manualmente pelo admin
 * (manualResult) são a autoridade final e nunca são sobrescritos.
 *
 * Idempotente e barato: 1 request por temporada; só grava quando há diferença.
 * Seguro no cron (~15 min). Devolve quantos jogos alterou.
 */
export async function reconcileFinishedMatches(now = new Date()): Promise<number> {
  if (!isFootballDataConfigured()) return 0;

  const since = new Date(now.getTime() - RECONCILE_WINDOW_MS);
  const candidates = await prisma.match.findMany({
    where: {
      externalId: { not: null },
      manualResult: false,
      kickoff: { lte: now, gte: since },
    },
    select: {
      id: true,
      roundId: true,
      externalId: true,
      finished: true,
      homeScore: true,
      awayScore: true,
      round: { select: { number: true, season: true } },
    },
  });
  if (candidates.length === 0) return 0;

  // 1 request por temporada → mapa externalId → placar oficial (só jogos encerrados)
  const official = new Map<number, { home: number; away: number }>();
  for (const season of new Set(candidates.map((c) => c.round.season))) {
    let matches;
    try {
      matches = await fetchMatches(season);
    } catch {
      continue; // API indisponível/cota: tenta de novo na próxima execução do cron
    }
    for (const m of matches) {
      if (m.finished && m.homeScore !== null && m.awayScore !== null) {
        official.set(m.externalId, { home: m.homeScore, away: m.awayScore });
      }
    }
  }

  const previousLeaders = await getGeneralLeaders();
  const newlyFinishedRoundIds = new Set<number>();
  let changed = 0;

  for (const c of candidates) {
    const result = c.externalId != null ? official.get(c.externalId) : undefined;
    if (!result) continue;
    // Já bate com o oficial? Nada a fazer.
    if (c.finished && c.homeScore === result.home && c.awayScore === result.away) continue;

    const wasFinished = c.finished;
    await prisma.match.update({
      where: { id: c.id },
      data: {
        homeScore: result.home,
        awayScore: result.away,
        finished: true,
        liveStatus: "FINISHED",
        liveHome: result.home,
        liveAway: result.away,
        liveAt: now,
      },
    });
    await recomputeMatchPoints(c.id, result);
    changed++;
    if (!wasFinished) newlyFinishedRoundIds.add(c.roundId); // notifica só quando ACABA de fechar
  }

  for (const roundId of newlyFinishedRoundIds) {
    const roundMatches = await prisma.match.findMany({ where: { roundId } });
    if (roundMatches.length > 0 && roundMatches.every((x) => x.finished)) {
      const number = candidates.find((c) => c.roundId === roundId)?.round.number ?? 0;
      await notifyRoundFinished(roundId, number);
    }
  }
  if (changed > 0) await checkNewLeader(previousLeaders);

  return changed;
}

/**
 * Mantém os HORÁRIOS (kickoff) dos jogos futuros em dia com o football-data. Sem
 * isso, um jogo importado quando o horário ainda era "a definir" (a API devolve
 * meia-noite UTC) fica com hora errada — e o app trava o palpite cedo demais e
 * revela os palpites dos outros antes da hora. Só toca em jogos NÃO encerrados e
 * com id externo (rodadas criadas à mão, sem externalId, não são alteradas).
 * Barato (1 request por temporada). Devolve quantos horários ajustou.
 */
export async function syncUpcomingSchedules(): Promise<number> {
  if (!isFootballDataConfigured()) return 0;

  const matches = await prisma.match.findMany({
    where: { finished: false, externalId: { not: null } },
    select: { id: true, externalId: true, kickoff: true, round: { select: { season: true } } },
  });
  if (matches.length === 0) return 0;

  const official = new Map<number, Date>();
  for (const season of new Set(matches.map((m) => m.round.season))) {
    let fd;
    try {
      fd = await fetchMatches(season);
    } catch {
      continue;
    }
    for (const m of fd) official.set(m.externalId, m.kickoff);
  }

  let updated = 0;
  for (const m of matches) {
    const off = m.externalId != null ? official.get(m.externalId) : undefined;
    if (!off) continue;
    if (Math.abs(off.getTime() - m.kickoff.getTime()) < 60_000) continue; // já igual (tolera 1 min)
    await prisma.match.update({ where: { id: m.id }, data: { kickoff: off } });
    updated++;
  }
  return updated;
}
