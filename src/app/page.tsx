import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkReminders } from "@/lib/notifications";
import { computeGeneralRanking, computeRoundRanking, getRoundWinners } from "@/lib/ranking";
import {
  dataCompletaBR,
  firstKickoff,
  getCurrentRound,
  getLastFinishedRound,
  isMatchLocked,
} from "@/lib/rounds";
import Countdown from "@/components/Countdown";
import CopyButton from "@/components/CopyButton";
import PlayerLink from "@/components/PlayerLink";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // Dispara a verificação de lembretes (idempotente) a cada carregamento do dashboard
  await checkReminders().catch(() => {});

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
