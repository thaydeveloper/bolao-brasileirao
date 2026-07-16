import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkReminders, checkPendingReminders, checkWinnerMessages } from "@/lib/notifications";
import { computeGeneralRanking, computeRoundRanking, getRoundWinners } from "@/lib/ranking";
import {
  dataCompletaBR,
  firstKickoff,
  getCurrentRound,
  getLastFinishedRound,
  isMatchLocked,
} from "@/lib/rounds";
import { WINNER_MESSAGE_MAX } from "@/lib/winnerMessage";
import Countdown from "@/components/Countdown";
import CopyButton from "@/components/CopyButton";
import PlayerLink from "@/components/PlayerLink";
import WinnerMessageForm from "@/components/WinnerMessageForm";
import PredictionForm from "@/components/PredictionForm";
import TeamCrest from "@/components/TeamCrest";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // Dispara as verificações idempotentes (lembretes + recado do campeão) a cada carregamento
  await checkReminders().catch(() => {});
  await checkPendingReminders().catch(() => {});
  await checkWinnerMessages().catch(() => {});

  const [currentRound, lastFinished, generalRanking] = await Promise.all([
    getCurrentRound(),
    getLastFinishedRound(),
    computeGeneralRanking(),
  ]);

  const now = new Date();
  let roundInfo: {
    kickoff: Date | null;
    remainingGames: number;
    myPredictions: number;
    totalGames: number;
  } | null = null;

  if (currentRound) {
    const myPreds = await prisma.prediction.count({
      where: { userId: user.id, match: { roundId: currentRound.id } },
    });
    roundInfo = {
      kickoff: firstKickoff(currentRound),
      remainingGames: currentRound.matches.filter((m) => !m.finished).length,
      myPredictions: myPreds,
      totalGames: currentRound.matches.length,
    };
  }

  const roundRanking = currentRound ? await computeRoundRanking(currentRound.id) : [];
  const winners = lastFinished ? await getRoundWinners(lastFinished) : [];

  // Todas as rodadas com jogos abertos (vigente + próxima/atrasada), para palpitar na home
  const openRounds = await prisma.round.findMany({
    where: { canceled: false, matches: { some: { finished: false, kickoff: { gt: now } } } },
    include: { matches: { orderBy: { kickoff: "asc" } } },
  });
  const nextOpenTime = (r: (typeof openRounds)[number]) =>
    Math.min(...r.matches.filter((m) => !m.finished && m.kickoff > now).map((m) => m.kickoff.getTime()));
  const palpitarRounds = openRounds
    .sort((a, b) => nextOpenTime(a) - nextOpenTime(b))
    .slice(0, 2)
    .map((r) => ({ round: r, open: r.matches.filter((m) => !m.finished && m.kickoff > now) }));

  const myPredByMatch = new Map<number, { homeScore: number; awayScore: number }>();
  if (palpitarRounds.length > 0) {
    const myPreds = await prisma.prediction.findMany({
      where: { userId: user.id, match: { roundId: { in: palpitarRounds.map((p) => p.round.id) } } },
      select: { matchId: true, homeScore: true, awayScore: true },
    });
    for (const p of myPreds) myPredByMatch.set(p.matchId, { homeScore: p.homeScore, awayScore: p.awayScore });
  }

  // Recado do campeão: janela aberta até o início da próxima rodada.
  // .catch: tolera o intervalo entre o deploy e o `db push` da tabela RoundMessage.
  const winnerMessage = lastFinished
    ? await prisma.roundMessage
        .findUnique({ where: { roundId: lastFinished.id } })
        .catch(() => null)
    : null;
  const nextDeadline = currentRound ? firstKickoff(currentRound) : null;
  const messageWindowOpen = nextDeadline === null || now < nextDeadline;
  const iAmWinner = winners.some((w) => w.user.id === user.id);

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Olá, {user.name.split(" ")[0]}! 👋</h1>
          <p className="muted">Bem-vindo ao bolão do Brasileirão.</p>
        </div>
      </div>

      {currentRound && roundInfo ? (
        <div className="card">
          <div className="card-title">
            <h2>Rodada {currentRound.number}</h2>
            <Link href={`/rodadas/${currentRound.id}`} className="btn">
              Palpitar agora
            </Link>
          </div>
          <div className="stat-row" style={{ marginBottom: 0 }}>
            <div className="stat">
              <div className="label">Fecha em</div>
              <div className="value">
                {roundInfo.kickoff && roundInfo.kickoff > now ? (
                  <Countdown target={roundInfo.kickoff.toISOString()} />
                ) : (
                  <span className="badge badge-yellow">Em andamento</span>
                )}
              </div>
              {roundInfo.kickoff && (
                <div className="muted">{dataCompletaBR.format(roundInfo.kickoff)}</div>
              )}
            </div>
            <div className="stat">
              <div className="label">Jogos restantes</div>
              <div className="value">{roundInfo.remainingGames}</div>
            </div>
            <div className="stat">
              <div className="label">Seus palpites</div>
              <div className="value">
                {roundInfo.myPredictions}/{roundInfo.totalGames}
              </div>
              {roundInfo.myPredictions < roundInfo.totalGames ? (
                <div className="muted" style={{ color: "var(--yellow)" }}>
                  Palpites pendentes!
                </div>
              ) : (
                <div className="muted" style={{ color: "var(--green)" }}>
                  Tudo enviado ✓
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>Nenhuma rodada aberta</h2>
          <p className="muted">Aguarde o administrador cadastrar a próxima rodada.</p>
        </div>
      )}

      {palpitarRounds.map(({ round, open }) => {
        const atrasada = currentRound && round.id !== currentRound.id;
        return (
          <div className="card" key={round.id}>
            <div className="card-title">
              <h2>
                ⚽ Palpitar — Rodada {round.number}{" "}
                {atrasada && <span className="badge badge-yellow">jogos atrasados</span>}
              </h2>
              <Link href={`/rodadas/${round.id}`} className="muted">
                Ver rodada completa →
              </Link>
            </div>
            {open.map((match) => {
              const mine = myPredByMatch.get(match.id);
              return (
                <div className="match" key={match.id}>
                  <div className="match-header">
                    <span>
                      {dataCompletaBR.format(match.kickoff)}
                      {" · fecha em "}
                      <Countdown target={match.kickoff.toISOString()} className="countdown-inline" />
                    </span>
                    {mine ? (
                      <span className="badge badge-green">✓ palpitado</span>
                    ) : (
                      <span className="badge badge-yellow">falta palpitar</span>
                    )}
                  </div>
                  <div className="match-teams">
                    <span className="team home">
                      <span className="team-name">{match.homeTeam}</span>
                      <TeamCrest url={match.homeCrest} name={match.homeTeam} size={26} />
                    </span>
                    <span className="score-final muted">vs</span>
                    <span className="team away">
                      <TeamCrest url={match.awayCrest} name={match.awayTeam} size={26} />
                      <span className="team-name">{match.awayTeam}</span>
                    </span>
                  </div>
                  <div className="match-footer">
                    <PredictionForm
                      matchId={match.id}
                      defaultHome={mine?.homeScore ?? null}
                      defaultAway={mine?.awayScore ?? null}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {winners.length > 0 && lastFinished && (
        <div className="card winner-card">
          <h2>
            🏆 {winners.map((w) => w.user.name).join(" e ")}{" "}
            {winners.length > 1 ? "venceram" : "venceu"} a rodada {lastFinished.number}!
          </h2>
          <p className="muted">
            {winners[0].points} pontos
            {winners.length > 1 && " — prêmio dividido entre os empatados"}
          </p>
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

          {winnerMessage && (
            <div className="winner-msg">
              <div className="muted">💬 Recado do campeão</div>
              <p className="winner-msg-text">“{winnerMessage.message}”</p>
            </div>
          )}

          {iAmWinner && messageWindowOpen && (
            <WinnerMessageForm
              roundNumber={lastFinished.number}
              defaultMessage={winnerMessage?.message ?? ""}
              deadlineLabel={nextDeadline ? dataCompletaBR.format(nextDeadline) : null}
              maxLength={WINNER_MESSAGE_MAX}
            />
          )}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">
            <h2>Ranking geral</h2>
            <Link href="/ranking" className="muted">
              Ver completo →
            </Link>
          </div>
          <table>
            <tbody>
              {generalRanking.slice(0, 5).map((entry, i) => (
                <tr key={entry.user.id} className={entry.user.id === user.id ? "row-me" : ""}>
                  <td style={{ width: 36 }}>
                    <span className={`pos ${i < 3 ? `pos-${i + 1}` : ""}`}>{i + 1}</span>
                  </td>
                  <td>
                    <PlayerLink id={entry.user.id} name={entry.user.name} photoUrl={entry.user.photoUrl} />
                  </td>
                  <td className="num points-badge">{entry.points} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">
            <h2>Ranking da rodada {currentRound ? currentRound.number : ""}</h2>
            {currentRound && (
              <Link href={`/rodadas/${currentRound.id}`} className="muted">
                Detalhes →
              </Link>
            )}
          </div>
          {currentRound ? (
            <table>
              <tbody>
                {roundRanking.slice(0, 5).map((entry, i) => (
                  <tr key={entry.user.id} className={entry.user.id === user.id ? "row-me" : ""}>
                    <td style={{ width: 36 }}>
                      <span className={`pos ${i < 3 ? `pos-${i + 1}` : ""}`}>{i + 1}</span>
                    </td>
                    <td>
                      <PlayerLink id={entry.user.id} name={entry.user.name} photoUrl={entry.user.photoUrl} />
                    </td>
                    <td className="num points-badge">{entry.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Sem rodada em disputa.</p>
          )}
        </div>
      </div>
    </main>
  );
}
