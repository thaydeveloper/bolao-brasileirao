import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getRoundWinnersMap } from "@/lib/ranking";
import { dataCompletaBR, firstKickoff, roundStatus, STATUS_LABEL } from "@/lib/rounds";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  aberta: "badge-green",
  "em-andamento": "badge-yellow",
  encerrada: "badge-gray",
  cancelada: "badge-red",
};

export default async function RodadasPage() {
  await requireUser();

  const [rounds, winnersMap] = await Promise.all([
    prisma.round.findMany({ include: { matches: { orderBy: { kickoff: "asc" } } }, orderBy: { number: "asc" } }),
    getRoundWinnersMap(),
  ]);

  const withStatus = rounds.map((round) => ({ round, status: roundStatus(round) }));

  // Disponíveis = abertas ou em andamento (dá pra palpitar / estão rolando), da mais próxima em diante
  const disponiveis = withStatus.filter((r) => r.status === "aberta" || r.status === "em-andamento");
  // Encerradas/canceladas ficam no histórico recolhido, da mais recente para a mais antiga
  const historico = withStatus
    .filter((r) => r.status === "encerrada" || r.status === "cancelada")
    .reverse();

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Rodadas</h1>
          <p className="muted">Rodadas disponíveis para palpitar.</p>
        </div>
      </div>

      {disponiveis.length === 0 && (
        <div className="card">
          <p className="muted">Nenhuma rodada disponível no momento.</p>
        </div>
      )}

      {disponiveis.map(({ round, status }, i) => {
        const kickoff = firstKickoff(round);
        return (
          <Link key={round.id} href={`/rodadas/${round.id}`} className="list-link">
            <div>
              <strong>
                Rodada {round.number}{" "}
                {i === 0 && <span className="badge badge-green">atual</span>}
              </strong>
              <div className="muted">
                {round.matches.length} jogos
                {kickoff && ` · início ${dataCompletaBR.format(kickoff)}`}
              </div>
            </div>
            <span className={`badge ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>
          </Link>
        );
      })}

      {historico.length > 0 && (
        <details className="history">
          <summary>Rodadas encerradas ({historico.length})</summary>
          <div style={{ marginTop: 12 }}>
            {historico.map(({ round, status }) => {
              const winner = status === "encerrada" ? winnersMap.get(round.id) : undefined;
              return (
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
              );
            })}
          </div>
        </details>
      )}
    </main>
  );
}
