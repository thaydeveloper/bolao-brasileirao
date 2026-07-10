import Link from "next/link";
import type { Match } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getRoundWinnersMap } from "@/lib/ranking";
import { dataCompletaBR, roundStatus, STATUS_LABEL } from "@/lib/rounds";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  aberta: "badge-green",
  "em-andamento": "badge-yellow",
  encerrada: "badge-gray",
  cancelada: "badge-red",
};

/** Data do próximo jogo ainda aberto para palpite (futuro e não encerrado). */
function nextOpenKickoff(matches: Match[], now: Date): Date | null {
  const upcoming = matches
    .filter((m) => !m.finished && m.kickoff > now)
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  return upcoming[0]?.kickoff ?? null;
}

export default async function RodadasPage() {
  await requireUser();
  const now = new Date();

  const [rounds, winnersMap] = await Promise.all([
    prisma.round.findMany({ include: { matches: { orderBy: { kickoff: "asc" } } } }),
    getRoundWinnersMap(),
  ]);

  const enriched = rounds
    .filter((r) => !r.canceled)
    .map((round) => ({ round, status: roundStatus(round), next: nextOpenKickoff(round.matches, now) }));

  // Disponíveis = têm ao menos um jogo aberto para palpite; ordenadas pelo próximo jogo
  const disponiveis = enriched
    .filter((r) => r.next !== null)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime());

  // Histórico = sem jogos abertos (encerradas ou já iniciadas), da mais recente para a mais antiga
  const historico = enriched
    .filter((r) => r.next === null)
    .sort((a, b) => b.round.number - a.round.number);

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
          <p className="muted">Nenhuma rodada disponível para palpite no momento.</p>
        </div>
      )}

      {disponiveis.map(({ round, status, next }, i) => (
        <Link key={round.id} href={`/rodadas/${round.id}`} className="list-link">
          <div>
            <strong>
              Rodada {round.number} {i === 0 && <span className="badge badge-green">atual</span>}
            </strong>
            <div className="muted">
              {round.matches.length} jogos
              {next && ` · próximo jogo ${dataCompletaBR.format(next)}`}
            </div>
          </div>
          <span className={`badge ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>
        </Link>
      ))}

      {historico.length > 0 && (
        <details className="history">
          <summary>Rodadas encerradas ({historico.length})</summary>
          <div style={{ marginTop: 12 }}>
            {historico.map(({ round, status }) => {
              const winner = winnersMap.get(round.id);
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
