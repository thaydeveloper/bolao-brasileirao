import { prisma } from "./db";
import { firstKickoff, roundStatus, type RoundWithMatches } from "./rounds";

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

/** Vencedor(es) da rodada — empatados dividem o prêmio. Só vale para rodadas encerradas. */
export async function getRoundWinners(round: RoundWithMatches): Promise<RoundRankingEntry[]> {
  if (roundStatus(round) !== "encerrada") return [];
  const ranking = await computeRoundRanking(round.id);
  if (ranking.length === 0) return [];
  const top = ranking[0].points;
  return ranking.filter((e) => e.points === top);
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

/** IDs dos líderes atuais do ranking geral (pode haver empate). */
export async function getGeneralLeaders(): Promise<number[]> {
  const ranking = await computeGeneralRanking();
  if (ranking.length === 0 || ranking[0].points === 0) return [];
  const top = ranking[0].points;
  return ranking.filter((e) => e.points === top).map((e) => e.user.id);
}
