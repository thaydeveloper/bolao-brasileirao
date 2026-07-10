import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPlayerProfile } from "@/lib/ranking";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

const medal = (pos: number) => (pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}º`);

export default async function JogadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();

  const profile = await getPlayerProfile(Number(id));
  if (!profile) notFound();

  const isMe = profile.user.id === me.id;
  const bestRound = profile.rounds.reduce(
    (best, r) => (best && best.points >= r.points ? best : r),
    profile.rounds[0]
  );

  return (
    <main>
      <div className="section-header">
        <Link href="/ranking" className="btn btn-secondary btn-sm">
          ← Ranking
        </Link>
      </div>

      <div className="card profile-header">
        <Avatar name={profile.user.name} photoUrl={profile.user.photoUrl} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ marginBottom: 2 }}>
            {profile.user.name} {isMe && <span className="badge badge-green">você</span>}
          </h1>
          <p className="muted">
            {medal(profile.position)} lugar de {profile.totalPlayers} no ranking geral
          </p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Pontos totais</div>
          <div className="value">{profile.points}</div>
        </div>
        <div className="stat">
          <div className="label">Vitórias em rodadas</div>
          <div className="value">{profile.roundWins}</div>
        </div>
        <div className="stat">
          <div className="label">Placares exatos</div>
          <div className="value">{profile.exactCount}</div>
        </div>
        <div className="stat">
          <div className="label">Aproveitamento</div>
          <div className="value">{profile.efficiency}%</div>
        </div>
      </div>

      <div className="card">
        <h2>Desempenho por rodada</h2>
        {profile.rounds.length === 0 ? (
          <p className="muted">Ainda não pontuou em nenhuma rodada encerrada.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rodada</th>
                  <th className="num">Palpites</th>
                  <th className="num">Exatos</th>
                  <th className="num">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {profile.rounds.map((r) => (
                  <tr key={r.roundId}>
                    <td>
                      <Link href={`/rodadas/${r.roundId}`} className="player-link">
                        Rodada {r.number}
                        {bestRound && r.roundId === bestRound.roundId && r.points > 0 && (
                          <span className="badge badge-green" style={{ marginLeft: 6 }}>melhor</span>
                        )}
                      </Link>
                    </td>
                    <td className="num">{r.predicted}</td>
                    <td className="num">{r.exact}</td>
                    <td className="num points-badge">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
