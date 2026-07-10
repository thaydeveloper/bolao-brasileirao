import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeRoundRanking, getRoundWinners } from "@/lib/ranking";
import { dataCompletaBR, isMatchLocked, roundStatus, STATUS_LABEL } from "@/lib/rounds";
import PredictionForm from "@/components/PredictionForm";
import CopyButton from "@/components/CopyButton";
import Avatar from "@/components/Avatar";
import TeamCrest from "@/components/TeamCrest";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  aberta: "badge-green",
  "em-andamento": "badge-yellow",
  encerrada: "badge-gray",
  cancelada: "badge-red",
};

function pointsBadge(points: number | null) {
  if (points === null) return null;
  const cls = points >= 40 ? "badge-green" : points > 0 ? "badge-blue" : "badge-red";
  return <span className={`badge ${cls} points-badge`}>+{points} pts</span>;
}

export default async function RodadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const round = await prisma.round.findUnique({
    where: { id: Number(id) },
    include: {
      matches: {
        orderBy: { kickoff: "asc" },
        include: {
          predictions: {
            include: { user: { select: { id: true, name: true, photoUrl: true } } },
          },
        },
      },
    },
  });
  if (!round) notFound();

  const status = roundStatus(round);
  const [ranking, winners] = await Promise.all([
    computeRoundRanking(round.id),
    getRoundWinners(round),
  ]);

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Rodada {round.number}</h1>
          <p className="muted">Temporada {round.season}</p>
        </div>
        <span className={`badge ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>

      {winners.length > 0 && (
        <div className="card winner-card">
          <h2>
            🏆 {winners.map((w) => w.user.name).join(" e ")}{" "}
            {winners.length > 1 ? "venceram" : "venceu"} a rodada com {winners[0].points} pontos!
          </h2>
          {winners.length > 1 && <p className="muted">Prêmio dividido entre os empatados.</p>}
          {winners.map((w) =>
            w.user.pixKey ? (
              <div className="pix-box" key={w.user.id}>
                <div>
                  <div className="muted">
                    PIX de {w.user.name} {w.user.pixKeyType ? `(${w.user.pixKeyType})` : ""}
                  </div>
                  <div className="pix-key">{w.user.pixKey}</div>
                </div>
                <CopyButton value={w.user.pixKey} />
              </div>
            ) : (
              <p className="muted" key={w.user.id}>
                {w.user.name} ainda não cadastrou a chave PIX.
              </p>
            )
          )}
        </div>
      )}

      <div className="card">
        <h2>Jogos e palpites</h2>
        {round.matches.map((match) => {
          const locked = isMatchLocked(match);
          const mine = match.predictions.find((p) => p.userId === user.id);
          const others = match.predictions.filter((p) => p.userId !== user.id);

          return (
            <div className="match" key={match.id}>
              <div className="match-header">
                <span>{dataCompletaBR.format(match.kickoff)}</span>
                {match.finished ? (
                  <span className="badge badge-gray">Encerrado</span>
                ) : locked ? (
                  <span className="badge badge-yellow">🔒 Palpite bloqueado</span>
                ) : (
                  <span className="badge badge-green">Aberto para palpites</span>
                )}
              </div>

              <div className="match-teams">
                <span className="team home">
                  <span className="team-name">{match.homeTeam}</span>
                  <TeamCrest url={match.homeCrest} name={match.homeTeam} size={26} />
                </span>
                {match.finished ? (
                  <span className="score-final">
                    {match.homeScore} x {match.awayScore}
                  </span>
                ) : (
                  <span className="score-final muted">vs</span>
                )}
                <span className="team away">
                  <TeamCrest url={match.awayCrest} name={match.awayTeam} size={26} />
                  <span className="team-name">{match.awayTeam}</span>
                </span>
              </div>

              <div className="match-footer">
                {!locked && !round.canceled ? (
                  <PredictionForm
                    matchId={match.id}
                    defaultHome={mine?.homeScore ?? null}
                    defaultAway={mine?.awayScore ?? null}
                  />
                ) : (
                  <div>
                    <span className="muted">Seu palpite: </span>
                    {mine ? (
                      <strong>
                        {mine.homeScore} x {mine.awayScore}
                      </strong>
                    ) : (
                      <span className="badge badge-red">Não palpitou</span>
                    )}{" "}
                    {mine && pointsBadge(mine.points)}
                  </div>
                )}
              </div>

              {/* Palpites dos demais jogadores só ficam visíveis após o início da partida */}
              {locked && others.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary className="muted" style={{ cursor: "pointer" }}>
                    Palpites dos outros jogadores ({others.length})
                  </summary>
                  <table style={{ marginTop: 8 }}>
                    <tbody>
                      {others.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="player-cell">
                              <Avatar name={p.user.name} photoUrl={p.user.photoUrl} />
                              {p.user.name}
                            </span>
                          </td>
                          <td className="num">
                            {p.homeScore} x {p.awayScore}
                          </td>
                          <td className="num">{pointsBadge(p.points)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Ranking da rodada</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Jogador</th>
                <th className="num hide-sm">Palpites</th>
                <th className="num">Placares exatos</th>
                <th className="num">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry, i) => (
                <tr key={entry.user.id} className={entry.user.id === user.id ? "row-me" : ""}>
                  <td>
                    <span className={`pos ${i < 3 ? `pos-${i + 1}` : ""}`}>{i + 1}</span>
                  </td>
                  <td>
                    <span className="player-cell">
                      <Avatar name={entry.user.name} photoUrl={entry.user.photoUrl} />
                      {entry.user.name}
                    </span>
                  </td>
                  <td className="num hide-sm">{entry.predictedCount}</td>
                  <td className="num">{entry.exactCount}</td>
                  <td className="num points-badge">{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
