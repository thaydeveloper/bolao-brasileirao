import { prisma } from "./db";
import type { RankingUser } from "./ranking";

/** Valor que cada não-cravador paga POR JOGO (combinado do grupo). */
export const PAYMENT_PER_GAME_BRL = 5;

/**
 * Rateio de UM jogo (função pura). Quem cravou o jogo (placar exato) recebe; quem
 * não cravou paga `amount`. O bolo (amount × não-cravadores) é dividido igualmente
 * entre os cravadores. Devolve quanto CADA cravador recebe nesse jogo.
 * - w = 0 (ninguém cravou) → 0 (jogo sem pagamento).
 * - w = N (todos cravaram) → 0 (ninguém paga).
 */
export function perWinnerPayout(N: number, w: number, amount = PAYMENT_PER_GAME_BRL): number {
  if (w <= 0 || w >= N) return 0;
  return (amount * (N - w)) / w;
}

export type SettlementAcc = { received: number; paid: number; cravadas: number };

/**
 * Núcleo do acerto da rodada (função pura). Para cada jogo, aplica o rateio por
 * cravada e acumula, por jogador, quanto recebeu, quanto pagou e quantas cravou.
 */
export function computeSettlementCore(
  playerIds: number[],
  games: { winnerIds: number[] }[],
  amount = PAYMENT_PER_GAME_BRL
): Map<number, SettlementAcc> {
  const N = playerIds.length;
  const acc = new Map<number, SettlementAcc>();
  const get = (id: number) => {
    let a = acc.get(id);
    if (!a) {
      a = { received: 0, paid: 0, cravadas: 0 };
      acc.set(id, a);
    }
    return a;
  };
  for (const id of playerIds) get(id); // garante todo mundo no mapa

  for (const g of games) {
    const winners = new Set(g.winnerIds.filter((id) => acc.has(id)));
    const w = winners.size;
    if (w > 0 && w < N) {
      const per = perWinnerPayout(N, w, amount);
      for (const id of playerIds) {
        if (winners.has(id)) {
          get(id).received += per;
          get(id).cravadas += 1;
        } else {
          get(id).paid += amount;
        }
      }
    } else if (w >= 1) {
      // todos cravaram → sem dinheiro, mas conta a cravada
      for (const id of winners) get(id).cravadas += 1;
    }
  }
  return acc;
}

export type SettlementPlayer = {
  user: RankingUser;
  cravadas: number;
  received: number;
  paid: number;
  net: number; // received - paid (positivo = recebe; negativo = paga)
};

export type SettlementGame = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  winners: RankingUser[];
  perWinner: number;
  payersCount: number;
};

export type RoundSettlement = {
  amountPerGame: number;
  playersCount: number;
  gamesPaid: number; // jogos com ao menos uma cravada (que geraram pagamento)
  players: SettlementPlayer[];
  perGame: SettlementGame[];
};

/** Acerto financeiro da rodada: quanto cada um recebe/paga (R$5 por jogo, por cravada). */
export async function computeRoundSettlement(roundId: number): Promise<RoundSettlement> {
  const [users, matches] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, photoUrl: true, pixKey: true, pixKeyType: true },
      orderBy: { name: "asc" },
    }),
    prisma.match.findMany({
      where: { roundId, finished: true },
      orderBy: { kickoff: "asc" },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        homeScore: true,
        awayScore: true,
        predictions: { select: { userId: true, points: true } },
      },
    }),
  ]);

  const N = users.length;
  const byId = new Map(users.map((u) => [u.id, u]));
  const games = matches.map((m) => ({
    winnerIds: m.predictions.filter((p) => p.points === 40).map((p) => p.userId),
  }));
  const acc = computeSettlementCore(
    users.map((u) => u.id),
    games,
    PAYMENT_PER_GAME_BRL
  );

  let gamesPaid = 0;
  const perGame: SettlementGame[] = matches.map((m, i) => {
    const winnerIds = games[i].winnerIds;
    const w = winnerIds.length;
    const paid = w > 0 && w < N;
    if (paid) gamesPaid += 1;
    return {
      matchId: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winners: winnerIds.map((id) => byId.get(id)).filter((u): u is RankingUser => Boolean(u)),
      perWinner: paid ? perWinnerPayout(N, w) : 0,
      payersCount: paid ? N - w : 0,
    };
  });

  const players: SettlementPlayer[] = users
    .map((user) => {
      const a = acc.get(user.id) ?? { received: 0, paid: 0, cravadas: 0 };
      return { user, cravadas: a.cravadas, received: a.received, paid: a.paid, net: a.received - a.paid };
    })
    .sort((a, b) => b.net - a.net || b.cravadas - a.cravadas || a.user.name.localeCompare(b.user.name));

  return { amountPerGame: PAYMENT_PER_GAME_BRL, playersCount: N, gamesPaid, players, perGame };
}
