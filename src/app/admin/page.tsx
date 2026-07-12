import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dataCompletaBR, roundStatus, STATUS_LABEL } from "@/lib/rounds";
import { removeMemberAction, toggleCancelRoundAction } from "@/app/actions/admin";
import { isConfigured } from "@/lib/football";
import { getWinnerMessageState, WINNER_MESSAGE_MAX } from "@/lib/winnerMessage";
import NewRoundForm from "./NewRoundForm";
import ImportForm from "./ImportForm";
import WinnerMessageTest from "./WinnerMessageTest";
import AdminBroadcastForm from "./AdminBroadcastForm";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [rounds, users, winnerMsgState] = await Promise.all([
    prisma.round.findMany({ include: { matches: true }, orderBy: { number: "desc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    // .catch: tolera o intervalo entre o deploy e o `db push` da tabela RoundMessage
    getWinnerMessageState().catch(() => null),
  ]);

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Administração</h1>
          <p className="muted">Rodadas, resultados e participantes.</p>
        </div>
      </div>

      <AdminBroadcastForm />

      <ImportForm configured={isConfigured()} />

      <NewRoundForm />

      <div className="card">
        <h2>💬 Recado do campeão</h2>
        {winnerMsgState ? (
          <WinnerMessageTest
            roundNumber={winnerMsgState.round.number}
            defaultMessage={winnerMsgState.message?.message ?? ""}
            deadlineLabel={
              winnerMsgState.deadline ? dataCompletaBR.format(winnerMsgState.deadline) : null
            }
            maxLength={WINNER_MESSAGE_MAX}
            windowOpen={winnerMsgState.open}
          />
        ) : (
          <p className="muted">
            Disponível quando houver uma rodada encerrada (e a tabela RoundMessage criada via{" "}
            <code>pnpm run db:push</code>).
          </p>
        )}
      </div>

      <div className="card">
        <h2>Rodadas</h2>
        {rounds.length === 0 && <p className="muted">Nenhuma rodada cadastrada.</p>}
        <div className="table-wrap">
          <table>
            <tbody>
              {rounds.map((round) => {
                const status = roundStatus(round);
                return (
                  <tr key={round.id}>
                    <td>
                      <strong>Rodada {round.number}</strong>
                      <div className="muted">
                        {round.matches.length} jogos · {STATUS_LABEL[status]}
                      </div>
                    </td>
                    <td className="num">
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Link href={`/admin/rodadas/${round.id}`} className="btn btn-sm">
                          Resultados
                        </Link>
                        <form action={toggleCancelRoundAction.bind(null, round.id)}>
                          <button className="btn btn-sm btn-secondary">
                            {round.canceled ? "Reativar" : "Cancelar"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Participantes ({users.length}/8)</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className="player-cell">
                      <Avatar name={user.name} photoUrl={user.photoUrl} />
                      <span>
                        {user.name} {user.isAdmin && <span className="badge badge-blue">admin</span>}
                        <div className="muted">{user.email}</div>
                      </span>
                    </span>
                  </td>
                  <td className="num">
                    {user.id !== admin.id && (
                      <form action={removeMemberAction.bind(null, user.id)}>
                        <button className="btn btn-sm btn-danger">Remover</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
