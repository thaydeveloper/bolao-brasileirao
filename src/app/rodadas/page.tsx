import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getRoundWinnersMap } from "@/lib/ranking";
import { roundStatus, STATUS_LABEL } from "@/lib/rounds";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  aberta: "badge-green",
  "em-andamento": "badge-yellow",
  encerrada: "badge-gray",
  cancelada: "badge-red",
};

export default async function RodadasPage() {
  await requireUser();

  // Duas consultas no total (rodadas + vencedores em lote), em vez de recalcular
  // o ranking de cada rodada individualmente.
  const [rounds, winnersMap] = await Promise.all([
    prisma.round.findMany({ include: { matches: true }, orderBy: { number: "desc" } }),
    getRoundWinnersMap(),
  ]);

  const items = rounds.map((round) => {
    const status = roundStatus(round);
    const winner = status === "encerrada" ? winnersMap.get(round.id) : undefined;
    return { round, status, winner };
  });

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

      {items.map(({ round, status, winner }) => (
        <Link key={round.id} href={`/rodadas/${round.id}`} className="list-link">
          <div>
            <strong>Rodada {round.number}</strong>
            <div className="muted">
              {round.matches.length} jogos
              {winner && ` · 🏆 ${winner.names.join(" e ")} (${winner.points} pts)`}
            </div>
          </div>
          <span className={`badge ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>
        </Link>
      ))}
    </main>
  );
}
