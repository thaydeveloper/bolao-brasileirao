import { requireUser } from "@/lib/auth";
import { computeGeneralRanking } from "@/lib/ranking";
import PlayerLink from "@/components/PlayerLink";

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

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Jogador</th>
                <th className="num" title="Pontos">Pts</th>
                <th className="num" title="Vitórias em rodadas">Vit.</th>
                <th className="num" title="Placares exatos">Exatos</th>
                <th className="num hide-sm" title="Aproveitamento">Aprov.</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry, i) => (
                <tr key={entry.user.id} className={entry.user.id === user.id ? "row-me" : ""}>
                  <td>
                    <span className={`pos ${i < 3 ? `pos-${i + 1}` : ""}`}>{i + 1}</span>
                  </td>
                  <td>
                    <PlayerLink id={entry.user.id} name={entry.user.name} photoUrl={entry.user.photoUrl} />
                  </td>
                  <td className="num points-badge">{entry.points}</td>
                  <td className="num">{entry.roundWins}</td>
                  <td className="num">{entry.exactCount}</td>
                  <td className="num hide-sm">{entry.efficiency}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          <strong>Pts</strong> pontos · <strong>Vit.</strong> vitórias em rodadas ·{" "}
          <strong>Exatos</strong> placares cravados · <strong>Aprov.</strong> aproveitamento
          (pontos ÷ máximo possível, 40 por jogo encerrado). Toque em um jogador para ver o perfil.
        </p>
      </div>
    </main>
  );
}
