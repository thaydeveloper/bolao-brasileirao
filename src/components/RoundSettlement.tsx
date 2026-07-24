import CopyButton from "./CopyButton";
import Avatar from "./Avatar";
import type { RoundSettlement as Settlement } from "@/lib/settlement";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Acerto financeiro da rodada (a partir da rodada 20): R$5 por jogo, por cravada.
 * Em cada jogo, quem não cravou paga R$5 e o bolo é dividido entre quem cravou.
 * Mostra o saldo de cada um, a chave PIX de quem recebe e o detalhe por jogo.
 */
export default function RoundSettlement({ settlement }: { settlement: Settlement }) {
  const { amountPerGame, players, perGame, gamesPaid } = settlement;
  const receivers = players.filter((p) => p.net > 0);

  return (
    <div className="payout">
      <h3 className="payout-title">💸 Pagamento da rodada — {brl(amountPerGame)} por jogo</h3>
      <p className="muted">
        Em cada jogo, quem <strong>não cravou</strong> paga {brl(amountPerGame)} e o total é dividido
        entre quem <strong>cravou</strong> o placar exato.
      </p>

      {gamesPaid === 0 ? (
        <p className="muted">Ninguém cravou nenhum jogo desta rodada — sem pagamento.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th className="num">Cravadas</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.user.id}>
                    <td>
                      <span className="player-cell">
                        <Avatar name={p.user.name} photoUrl={p.user.photoUrl} />
                        {p.user.name}
                      </span>
                    </td>
                    <td className="num">{p.cravadas}</td>
                    <td className="num">
                      {p.net > 0 ? (
                        <span className="badge badge-green">recebe {brl(p.net)}</span>
                      ) : p.net < 0 ? (
                        <span className="badge badge-red">paga {brl(-p.net)}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {receivers.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Chaves PIX de quem recebe:
              </div>
              {receivers.map((p) =>
                p.user.pixKey ? (
                  <div className="pix-box" key={p.user.id}>
                    <div>
                      <div className="muted">
                        PIX de {p.user.name} · recebe {brl(p.net)}{" "}
                        {p.user.pixKeyType ? `(${p.user.pixKeyType})` : ""}
                      </div>
                      <div className="pix-key">{p.user.pixKey}</div>
                    </div>
                    <CopyButton value={p.user.pixKey} />
                  </div>
                ) : (
                  <p className="muted" key={p.user.id}>
                    {p.user.name} recebe {brl(p.net)}, mas ainda não cadastrou a chave PIX.
                  </p>
                )
              )}
            </div>
          )}

          <details style={{ marginTop: 12 }}>
            <summary className="muted" style={{ cursor: "pointer" }}>
              Detalhe por jogo
            </summary>
            <div style={{ marginTop: 8 }}>
              {perGame.map((g) => (
                <div key={g.matchId} className="settlement-game">
                  <div>
                    <strong>
                      {g.homeTeam} {g.homeScore} x {g.awayScore} {g.awayTeam}
                    </strong>
                  </div>
                  {g.winners.length === 0 ? (
                    <div className="muted">Ninguém cravou — sem pagamento.</div>
                  ) : g.payersCount === 0 ? (
                    <div className="muted">
                      Todos cravaram ({g.winners.map((w) => w.name).join(", ")}) — sem pagamento.
                    </div>
                  ) : (
                    <div className="muted">
                      Cravou: <strong>{g.winners.map((w) => w.name).join(", ")}</strong> — recebe{" "}
                      <strong>{brl(g.perWinner)}</strong> cada ({g.payersCount} pagam {brl(amountPerGame)}
                      ).
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
