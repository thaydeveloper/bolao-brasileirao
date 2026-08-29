import { syncUpcomingSchedules } from "../src/lib/live";
import { prisma } from "../src/lib/db";

async function main() {
  const updated = await syncUpcomingSchedules();
  console.log(`Horários ajustados: ${updated}`);

  const round = await prisma.round.findFirst({
    where: { number: 25 },
    include: { matches: { orderBy: { kickoff: "asc" } } },
    orderBy: { season: "desc" },
  });
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  console.log("\nRodada 25 após ajuste:");
  for (const m of round?.matches ?? []) {
    const aberto = !m.finished && m.kickoff > now;
    console.log(`  ${m.homeTeam} x ${m.awayTeam} → ${fmt.format(m.kickoff)} BRT | palpite ${aberto ? "ABERTO" : "fechado"}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
