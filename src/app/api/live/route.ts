import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncLiveMatches } from "@/lib/live";

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

    // Anexa o palpite do usuário logado a cada jogo ao vivo (cron não tem sessão → sem palpite).
    const session = await getSession();
    if (session && matches.length > 0) {
      const preds = await prisma.prediction.findMany({
        where: { userId: session.userId, matchId: { in: matches.map((m) => m.id) } },
        select: { matchId: true, homeScore: true, awayScore: true },
      });
      const byMatch = new Map(preds.map((p) => [p.matchId, p]));
      const withPreds = matches.map((m) => {
        const p = byMatch.get(m.id);
        return { ...m, myPrediction: p ? { home: p.homeScore, away: p.awayScore } : null };
      });
      return NextResponse.json({ ok: true, matches: withPreds });
    }

    return NextResponse.json({ ok: true, matches });
  } catch {
    return NextResponse.json({ ok: false, matches: [] });
  }
}
