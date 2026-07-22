/**
 * Dispara a reconciliação de jogos encerrados manualmente (mesma lógica do cron),
 * apontando para o banco definido no .env. Uso: tsx scripts/reconcile-now.ts
 */
import { reconcileFinishedMatches } from "../src/lib/live";
import { prisma } from "../src/lib/db";

async function main() {
  const now = new Date();
  const before = await prisma.match.findMany({
    where: { finished: false, kickoff: { lte: now } },
    select: { id: true, homeTeam: true, awayTeam: true, kickoff: true },
    orderBy: { kickoff: "desc" },
    take: 20,
  });
  console.log(`Pendentes (já iniciados, não finalizados): ${before.length}`);
  for (const m of before) {
    console.log(`  #${m.id} ${m.homeTeam} x ${m.awayTeam} — ${m.kickoff.toISOString()}`);
  }

  const finalized = await reconcileFinishedMatches(now);
  console.log(`\n✅ Reconciliação concluída. Jogos finalizados agora: ${finalized}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Erro:", e);
  await prisma.$disconnect();
  process.exit(1);
});
