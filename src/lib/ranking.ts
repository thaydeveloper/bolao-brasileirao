import { prisma } from "./db";
import { firstKickoff, roundStatus, type RoundWithMatches } from "./rounds";
import { calcularPontos } from "./scoring";

export type RankingUser = {
  id: number;
  name: string;
  photoUrl: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
};

export type RoundRankingEntry = {
  user: RankingUser;
  points: number;
  exactCount: number;
  predictedCount: number;
};

export type GeneralRankingEntry = {
  user: RankingUser;
  points: number;
  roundWins: number;
  exactCount: number;
  /** pontos obtidos / pontos máximos possíveis (40 por jogo encerrado), em % */
  efficiency: number;
};

const userSelect = { id: true, name: true, photoUrl: true, pixKey: true, pixKeyType: true } as const;

async function getAllPlayers(): Promise<RankingUser[]> {
  return prisma.user.findMany({ select: userSelect, orderBy: { name: "asc" } });
}

/** Ranking de uma rodada: soma dos pontos dos palpites em jogos já encerrados. */
export async function computeRoundRanking(roundId: number): Promise<RoundRankingEntry[]> {
  const [players, predictions] = await Promise.all([
    getAllPlayers(),
    prisma.prediction.findMany({
      where: { match: { roundId, finished: true } },
      select: { userId: true, points: true },
    }),
  ]);

  const byUser = new Map<number, { points: number; exact: number; count: number }>();
  for (const p of predictions) {
    const entry = byUser.get(p.userId) ?? { points: 0, exact: 0, count: 0 };
    entry.points += p.points ?? 0;
    entry.count += 1;
    if (p.points === 40) entry.exact += 1;
    byUser.set(p.userId, entry);
  }

  return players
    .map((user) => {
      const e = byUser.get(user.id);
      return {
        user,
        points: e?.points ?? 0,
        exactCount: e?.exact ?? 0,
        predictedCount: e?.count ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.exactCount - a.exactCount || a.user.name.localeCompare(b.user.name));
}

/**
 * Ranking AO VIVO das rodadas informadas: pontos provisórios calculados com o
 * placar atual — resultado oficial para jogos encerrados e placar ao vivo para
 * jogos em andamento (IN_PLAY/PAUSED). Muda em tempo real conforme os gols saem.
 */
export async function computeLiveRanking(roundIds: number[]): Promise<RoundRankingEntry[]> {
  if (roundIds.length === 0) return [];
  const [players, matches] = await Promise.all([
    getAllPlayers(),
    prisma.match.findMany({
      where: { roundId: { in: roundIds } },
      select: {
        finished: true,
        homeScore: true,
        awayScore: true,
        liveStatus: true,
        liveHome: true,
        liveAway: true,
        predictions: { select: { userId: true, homeScore: true, awayScore: true, points: true } },
      },
    }),
  ]);

  const byUser = new Map<number, { points: number; exact: number; count: number }>();
  const bump = (userId: number, pts: number) => {
    const e = byUser.get(userId) ?? { points: 0, exact: 0, count: 0 };
    e.points += pts;
    e.count += 1;
    if (pts === 40) e.exact += 1;
    byUser.set(userId, e);
  };

  for (const m of matches) {
    let result: { home: number; away: number } | null = null;
    if (m.finished && m.homeScore !== null && m.awayScore !== null) {
      result = { home: m.homeScore, away: m.awayScore };
    } else if (
      (m.liveStatus === "IN_PLAY" || m.liveStatus === "PAUSED") &&
      m.liveHome !== null &&
      m.liveAway !== null
    ) {
      result = { home: m.liveHome, away: m.liveAway };
    }
    if (!result) continue; // jogo ainda não começou → não pontua

    for (const p of m.predictions) {
      const pts =
        m.finished && p.points !== null
          ? p.points
          : calcularPontos({ home: p.homeScore, away: p.awayScore }, result);
      bump(p.userId, pts);
    }
  }

  return players
    .map((user) => {
      const e = byUser.get(user.id);
      return {
        user,
        points: e?.points ?? 0,
        exactCount: e?.exact ?? 0,
        predictedCount: e?.count ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.exactCount - a.exactCount || a.user.name.localeCompare(b.user.name));
}

/** Vencedor(es) a partir de um ranking já calculado (evita recalcular). */
export function winnersFromRanking(
  ranking: RoundRankingEntry[],
  round: RoundWithMatches
): RoundRankingEntry[] {
  if (roundStatus(round) !== "encerrada" || ranking.length === 0) return [];
  const top = ranking[0].points;
  if (top <= 0) return []; // ninguém pontuou → sem vencedor
  return ranking.filter((e) => e.points === top);
}

/** Vencedor(es) da rodada — empatados dividem o prêmio. Só vale para rodadas encerradas. */
export async function getRoundWinners(round: RoundWithMatches): Promise<RoundRankingEntry[]> {
  if (roundStatus(round) !== "encerrada") return [];
  const ranking = await computeRoundRanking(round.id);
  return winnersFromRanking(ranking, round);
}

/**
 * A partir desta rodada, o pagamento é POR CRAVADA: recebem TODOS que cravaram ao
 * menos um placar exato (e, se ninguém cravou, ninguém recebe). Antes disso vale a
 * regra antiga (quem cravou MAIS; sem cravadas, o vencedor em pontos).
 */
export const PAY_PER_CRAVADA_FROM_ROUND = 20;

/** True se a rodada usa o pagamento por cravada (todos que cravaram). */
export function isPayPerCravadaRound(round: RoundWithMatches): boolean {
  return round.number >= PAY_PER_CRAVADA_FROM_ROUND;
}

/**
 * Premiado(s) da rodada — quem RECEBE o pagamento (chave PIX exibida). Distinto do
 * troféu, que continua sendo de quem mais pontuou (ver winnersFromRanking).
 *
 * - Rodada >= PAY_PER_CRAVADA_FROM_ROUND: pagamento POR CRAVADA → todos que cravaram
 *   ao menos um placar exato. Se ninguém cravou, ninguém recebe (lista vazia).
 * - Rodadas anteriores: quem CRAVOU MAIS (empate divide); sem cravadas, o vencedor
 *   em pontos.
 */
export function payeesFromRanking(
  ranking: RoundRankingEntry[],
  round: RoundWithMatches
): RoundRankingEntry[] {
  if (roundStatus(round) !== "encerrada" || ranking.length === 0) return [];
  const withExact = ranking.filter((e) => e.exactCount > 0);

  if (isPayPerCravadaRound(round)) return withExact; // todos que cravaram (ou vazio)

  if (withExact.length === 0) return winnersFromRanking(ranking, round); // ninguém cravou → vencedor em pontos
  const topExact = Math.max(...withExact.map((e) => e.exactCount));
  return withExact.filter((e) => e.exactCount === topExact); // quem cravou mais
}

/** Premiado(s) da rodada (pagamento) — ver payeesFromRanking. Só rodadas encerradas. */
export async function getRoundPayees(round: RoundWithMatches): Promise<RoundRankingEntry[]> {
  if (roundStatus(round) !== "encerrada") return [];
  const ranking = await computeRoundRanking(round.id);
  return payeesFromRanking(ranking, round);
}

/**
 * Vencedores de TODAS as rodadas em poucas consultas (evita N+1 na lista de rodadas).
 * Retorna um mapa roundId → { nomes, pontos } apenas para rodadas com pontuação > 0.
 * A checagem de "rodada encerrada" fica a cargo de quem consome (usa o status da rodada).
 */
export async function getRoundWinnersMap(): Promise<Map<number, { names: string[]; points: number }>> {
  const preds = await prisma.prediction.findMany({
    where: { match: { finished: true } },
    select: { userId: true, points: true, match: { select: { roundId: true } } },
  });
  const result = new Map<number, { names: string[]; points: number }>();
  if (preds.length === 0) return result;

  const byRound = new Map<number, Map<number, number>>();
  for (const p of preds) {
    const rid = p.match.roundId;
    let m = byRound.get(rid);
    if (!m) {
      m = new Map();
      byRound.set(rid, m);
    }
    m.set(p.userId, (m.get(p.userId) ?? 0) + (p.points ?? 0));
  }

  const userIds = [...new Set(preds.map((p) => p.userId))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  for (const [rid, m] of byRound) {
    const top = Math.max(...m.values());
    if (top <= 0) continue;
    const names = [...m.entries()].filter(([, pts]) => pts === top).map(([uid]) => nameById.get(uid) ?? "?");
    result.set(rid, { names, points: top });
  }
  return result;
}

/** Ranking geral do campeonato, considerando todas as rodadas não canceladas. */
export async function computeGeneralRanking(): Promise<GeneralRankingEntry[]> {
  const [players, rounds] = await Promise.all([
    getAllPlayers(),
    prisma.round.findMany({
      where: { canceled: false },
      include: { matches: { include: { predictions: { select: { userId: true, points: true } } } } },
    }),
  ]);

  const totals = new Map<number, { points: number; exact: number; wins: number }>();
  const get = (id: number) => {
    let t = totals.get(id);
    if (!t) {
      t = { points: 0, exact: 0, wins: 0 };
      totals.set(id, t);
    }
    return t;
  };

  let finishedMatchCount = 0;

  for (const round of rounds) {
    const roundPoints = new Map<number, number>();
    for (const match of round.matches) {
      if (!match.finished) continue;
      finishedMatchCount += 1;
      for (const pred of match.predictions) {
        const t = get(pred.userId);
        t.points += pred.points ?? 0;
        if (pred.points === 40) t.exact += 1;
        roundPoints.set(pred.userId, (roundPoints.get(pred.userId) ?? 0) + (pred.points ?? 0));
      }
    }
    // vitórias em rodadas: apenas rodadas totalmente encerradas
    const finished = round.matches.length > 0 && round.matches.every((m) => m.finished);
    if (finished && roundPoints.size > 0) {
      const top = Math.max(...roundPoints.values());
      for (const [userId, pts] of roundPoints) {
        if (pts === top) get(userId).wins += 1;
      }
    }
  }

  const maxPoints = finishedMatchCount * 40;

  return players
    .map((user) => {
      const t = totals.get(user.id) ?? { points: 0, exact: 0, wins: 0 };
      return {
        user,
        points: t.points,
        roundWins: t.wins,
        exactCount: t.exact,
        efficiency: maxPoints > 0 ? Math.round((t.points / maxPoints) * 1000) / 10 : 0,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.roundWins - a.roundWins ||
        b.exactCount - a.exactCount ||
        a.user.name.localeCompare(b.user.name)
    );
}

export type PlayerProfile = {
  user: RankingUser;
  position: number;
  totalPlayers: number;
  points: number;
  roundWins: number;
  exactCount: number;
  efficiency: number;
  rounds: { roundId: number; number: number; points: number; predicted: number; exact: number }[];
};

/** Perfil público de um participante: posição geral, estatísticas e desempenho por rodada. */
export async function getPlayerProfile(userId: number): Promise<PlayerProfile | null> {
  const general = await computeGeneralRanking();
  const idx = general.findIndex((e) => e.user.id === userId);
  if (idx === -1) return null;
  const entry = general[idx];

  const preds = await prisma.prediction.findMany({
    where: { userId, match: { finished: true } },
    select: { points: true, match: { select: { round: { select: { id: true, number: true } } } } },
  });

  const byRound = new Map<number, PlayerProfile["rounds"][number]>();
  for (const p of preds) {
    const r = p.match.round;
    let e = byRound.get(r.id);
    if (!e) {
      e = { roundId: r.id, number: r.number, points: 0, predicted: 0, exact: 0 };
      byRound.set(r.id, e);
    }
    e.points += p.points ?? 0;
    e.predicted += 1;
    if (p.points === 40) e.exact += 1;
  }

  return {
    user: entry.user,
    position: idx + 1,
    totalPlayers: general.length,
    points: entry.points,
    roundWins: entry.roundWins,
    exactCount: entry.exactCount,
    efficiency: entry.efficiency,
    rounds: [...byRound.values()].sort((a, b) => b.number - a.number),
  };
}

/** IDs dos líderes atuais do ranking geral (pode haver empate). */
export async function getGeneralLeaders(): Promise<number[]> {
  const ranking = await computeGeneralRanking();
  if (ranking.length === 0 || ranking[0].points === 0) return [];
  const top = ranking[0].points;
  return ranking.filter((e) => e.points === top).map((e) => e.user.id);
}
