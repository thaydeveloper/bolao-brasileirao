import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncLiveMatches } from "@/lib/live";
import { computeLiveRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

/**
 * Placares ao vivo. Dispara um sync (throttled) com a API e devolve os jogos em
 * andamento — com o palpite do usuário logado, quando houver sessão. Chamado pelo
 * cliente (poll a cada 20–30s) e por um agendador externo (GitHub Actions, para o
 * push de gol chegar mesmo sem ninguém na tela). Público (só placares); tolera o
 * intervalo entre o deploy e o `db push`.
 */
export async function GET() {
  try {
    const matches = await syncLiveMatches();

    if (matches.length === 0) {
      return NextResponse.json({ ok: true, matches: [], ranking: null });
    }

    const session = await getSession();

    // Ranking AO VIVO: pontos provisórios das rodadas que têm jogo em andamento.
    const liveRounds = await prisma.match.findMany({
      where: { id: { in: matches.map((m) => m.id) } },
      select: { roundId: true },
    });
    const roundIds = [...new Set(liveRounds.map((r) => r.roundId))];
    const liveRanking = await computeLiveRanking(roundIds);
    const ranking = {
      roundNumbers: [...new Set(matches.map((m) => m.roundNumber))].sort((a, b) => a - b),
      entries: liveRanking.map((e) => ({
        id: e.user.id,
        name: e.user.name,
        photoUrl: e.user.photoUrl,
        points: e.points,
        exact: e.exactCount,
        isMe: session ? e.user.id === session.userId : false,
      })),
    };

    // Anexa o palpite do usuário logado a cada jogo ao vivo (cron não tem sessão → sem palpite).
    if (session) {
      const preds = await prisma.prediction.findMany({
        where: { userId: session.userId, matchId: { in: matches.map((m) => m.id) } },
        select: { matchId: true, homeScore: true, awayScore: true },
      });
      const byMatch = new Map(preds.map((p) => [p.matchId, p]));
      const withPreds = matches.map((m) => {
        const p = byMatch.get(m.id);
        return { ...m, myPrediction: p ? { home: p.homeScore, away: p.awayScore } : null };
      });
      return NextResponse.json({ ok: true, matches: withPreds, ranking });
    }

    return NextResponse.json({ ok: true, matches, ranking });
  } catch {
    return NextResponse.json({ ok: false, matches: [], ranking: null });
  }
}
