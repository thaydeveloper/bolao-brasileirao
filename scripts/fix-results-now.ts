import { prisma } from "../src/lib/db";
import { fetchMatches } from "../src/lib/football";
import { recomputeMatchPoints } from "../src/lib/results";
import { getGeneralLeaders, computeGeneralRanking } from "../src/lib/ranking";

async function main() {
  // TODAS as rodadas: confere todo jogo encerrado com id externo contra o oficial.
  const finished = await prisma.match.findMany({
    where: { finished: true, externalId: { not: null } },
    include: { round: { select: { number: true, season: true } } },
    orderBy: [{ round: { number: "asc" } }, { kickoff: "asc" }],
  });
  console.log(`Jogos encerrados a conferir: ${finished.length}`);

  const official = new Map<number, { home: number | null; away: number | null; finished: boolean }>();
  for (const s of new Set(finished.map((m) => m.round.season))) {
    for (const fm of await fetchMatches(s)) {
      official.set(fm.externalId, { home: fm.homeScore, away: fm.awayScore, finished: fm.finished });
    }
  }

  const before = await getGeneralLeaders();
  let corrected = 0;

  for (const m of finished) {
    const off = m.externalId != null ? official.get(m.externalId) : undefined;
    if (!off || !off.finished || off.home === null || off.away === null) continue;
    if (off.home === m.homeScore && off.away === m.awayScore) continue;

    console.log(
      `Corrigindo R${m.round.number} #${m.id} ${m.homeTeam} x ${m.awayTeam}: ${m.homeScore}x${m.awayScore} -> ${off.home}x${off.away}`
    );
    await prisma.match.update({
      where: { id: m.id },
      data: {
        homeScore: off.home,
        awayScore: off.away,
        liveHome: off.home,
        liveAway: off.away,
        liveStatus: "FINISHED",
      },
    });
    await recomputeMatchPoints(m.id, { home: off.home, away: off.away });
    corrected++;
  }

  console.log(`\nJogos corrigidos: ${corrected}`);
  const after = await getGeneralLeaders();
  const names = async (ids: number[]) => {
    const rk = await computeGeneralRanking();
    return ids.map((id) => rk.find((e) => e.user.id === id)?.user.name ?? id);
  };
  console.log("Líderes antes:", await names(before));
  console.log("Líderes depois:", await names(after));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
