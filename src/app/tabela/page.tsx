import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchStandings, isConfigured, FootballApiError, SETUP_MESSAGE } from "@/lib/football";
import TeamCrest from "@/components/TeamCrest";

export const dynamic = "force-dynamic";

const SEASON = "2026";

// Zonas de classificação do Brasileirão (Série A com 20 clubes)
function zoneClass(position: number): string {
  if (position <= 4) return "zone-libertadores"; // G4
  if (position <= 6) return "zone-libertadores-q";
  if (position <= 12) return "zone-sula";
  if (position >= 17) return "zone-rebaixamento"; // Z4
  return "";
}

export default async function TabelaPage() {
  await requireUser();

  if (!isConfigured()) {
    return (
      <main>
        <div className="section-header">
          <h1>Tabela do Brasileirão</h1>
        </div>
        <div className="card">
          <h2>Integração não configurada</h2>
          <p className="muted" style={{ marginBottom: 12 }}>{SETUP_MESSAGE}</p>
          <a
            className="btn"
            href="https://www.football-data.org/client/register"
            target="_blank"
            rel="noreferrer"
          >
            Obter token grátis
          </a>
        </div>
      </main>
    );
  }

  let standings;
  let error: string | null = null;
  try {
    standings = await fetchStandings(SEASON);
  } catch (e) {
    error = e instanceof FootballApiError ? e.message : "Falha ao carregar a tabela.";
  }

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Tabela do Brasileirão</h1>
          <p className="muted">Série A · Temporada {SEASON} · dados oficiais</p>
        </div>
      </div>

      {error && <div className="card"><div className="form-error" style={{ marginBottom: 0 }}>{error}</div></div>}

      {standings && (
        <>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrap">
              <table className="standings">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Time</th>
                    <th className="num">P</th>
                    <th className="num">J</th>
                    <th className="num hide-sm">V</th>
                    <th className="num hide-sm">E</th>
                    <th className="num hide-sm">D</th>
                    <th className="num hide-sm">GP</th>
                    <th className="num hide-sm">GC</th>
                    <th className="num">SG</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.rows.map((row) => (
                    <tr key={row.position} className={zoneClass(row.position)}>
                      <td>
                        <span className="standings-pos">{row.position}</span>
                      </td>
                      <td>
                        <span className="player-cell">
                          <TeamCrest url={row.crest} name={row.team} />
                          <span className="team-name">{row.team}</span>
                        </span>
                      </td>
                      <td className="num" style={{ fontWeight: 800 }}>{row.points}</td>
                      <td className="num">{row.played}</td>
                      <td className="num hide-sm">{row.won}</td>
                      <td className="num hide-sm">{row.draw}</td>
                      <td className="num hide-sm">{row.lost}</td>
                      <td className="num hide-sm">{row.goalsFor}</td>
                      <td className="num hide-sm">{row.goalsAgainst}</td>
                      <td className="num">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="legend">
              <span><i className="dot zone-libertadores" /> Libertadores (G4)</span>
              <span><i className="dot zone-libertadores-q" /> Pré-Libertadores</span>
              <span><i className="dot zone-sula" /> Sul-Americana</span>
              <span><i className="dot zone-rebaixamento" /> Rebaixamento (Z4)</span>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              P: pontos · J: jogos · V: vitórias · E: empates · D: derrotas · GP/GC: gols pró/contra · SG: saldo.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
