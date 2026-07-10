import { requireUser } from "@/lib/auth";
import { computeGeneralRanking } from "@/lib/ranking";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const user = await requireUser();
  const ranking = await computeGeneralRanking();

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Ranking geral</h1>
          <p className="muted">Classificação acumulada do campeonato.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Jogador</th>
                <th className="num">Vitórias em rodadas</th>
                <th className="num">Placares exatos</th>
                <th className="num hide-sm">Aproveitamento</th>
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
                  <td className="num">{entry.roundWins}</td>
                  <td className="num">{entry.exactCount}</td>
                  <td className="num hide-sm">{entry.efficiency}%</td>
                  <td className="num points-badge">{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Aproveitamento = pontos conquistados ÷ pontos máximos possíveis (40 por jogo encerrado).
        </p>
      </div>
    </main>
  );
}
