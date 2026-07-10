import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getRoundWinners } from "@/lib/ranking";
import { firstKickoff, roundStatus, STATUS_LABEL } from "@/lib/rounds";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  aberta: "badge-green",
  "em-andamento": "badge-yellow",
  encerrada: "badge-gray",
  cancelada: "badge-red",
};

export default async function RodadasPage() {
  await requireUser();

  const rounds = await prisma.round.findMany({
    include: { matches: true },
    orderBy: { number: "desc" },
  });

  const items = await Promise.all(
    rounds.map(async (round) => {
      const status = roundStatus(round);
      const winners = status === "encerrada" ? await getRoundWinners(round) : [];
      return { round, status, winners };
    })
  );

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Rodadas</h1>
          <p className="muted">Histórico completo do campeonato.</p>
        </div>
      </div>

      {items.length === 0 && (
        <div className="card">
          <p className="muted">Nenhuma rodada cadastrada ainda.</p>
        </div>
      )}

      {items.map(({ round, status, winners }) => (
        <Link key={round.id} href={`/rodadas/${round.id}`} className="list-link">
          <div>
            <strong>Rodada {round.number}</strong>
            <div className="muted">
              {round.matches.length} jogos
              {winners.length > 0 &&
                ` · 🏆 ${winners.map((w) => w.user.name).join(" e ")} (${winners[0].points} pts)`}
            </div>
          </div>
          <span className={`badge ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>
        </Link>
      ))}
    </main>
  );
}
