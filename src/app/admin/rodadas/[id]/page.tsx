import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dataCompletaBR } from "@/lib/rounds";
import { deleteRoundAction, reprocessRoundAction } from "@/app/actions/admin";
import ResultForm from "./ResultForm";

export const dynamic = "force-dynamic";

export default async function AdminRodadaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const round = await prisma.round.findUnique({
    where: { id: Number(id) },
    include: { matches: { orderBy: { kickoff: "asc" } } },
  });
  if (!round) notFound();

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Resultados — Rodada {round.number}</h1>
          <p className="muted">
            Registre os placares oficiais. A pontuação é recalculada automaticamente.
          </p>
        </div>
        <Link href="/admin" className="btn btn-secondary btn-sm">
          ← Voltar
        </Link>
      </div>

      <div className="card">
        {round.matches.map((match) => (
          <div className="match" key={match.id}>
            <div className="match-header">
              <span>{dataCompletaBR.format(match.kickoff)}</span>
              {match.finished ? (
                <span className="badge badge-gray">Encerrado</span>
              ) : (
                <span className="badge badge-green">Sem resultado</span>
              )}
            </div>
            <ResultForm
              matchId={match.id}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              defaultHome={match.homeScore}
              defaultAway={match.awayScore}
              defaultFinished={match.finished}
            />
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Ações da rodada</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={reprocessRoundAction.bind(null, round.id)}>
            <button className="btn btn-secondary">Reprocessar pontuação</button>
          </form>
          <form action={deleteRoundAction.bind(null, round.id)}>
            <button className="btn btn-danger">Excluir rodada</button>
          </form>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Reprocessar recalcula os pontos de todos os palpites a partir dos resultados registrados.
          Excluir remove a rodada, os jogos e os palpites — irreversível.
        </p>
      </div>
    </main>
  );
}
