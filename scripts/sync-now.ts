/**
 * Dispara um sync ao vivo forçado (ignora o cooldown), apontando para o banco do
 * .env. Uso: tsx scripts/sync-now.ts
 */
import { syncLiveMatches } from "../src/lib/live";
import { prisma } from "../src/lib/db";

async function main() {
  const live = await syncLiveMatches({ force: true });
  console.log(`Jogos ao vivo agora: ${live.length}`);
  for (const m of live) {
    console.log(
      `  ${m.homeTeam} ${m.homeScore} x ${m.awayScore} ${m.awayTeam} | ${m.status} | min=${m.minute}`
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
