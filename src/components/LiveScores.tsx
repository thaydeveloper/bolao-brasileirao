"use client";

import { useEffect, useState } from "react";
import TeamCrest from "./TeamCrest";
import Avatar from "./Avatar";

type LiveMatch = {
  id: number;
  roundNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeCrest: string | null;
  awayCrest: string | null;
  homeScore: number;
  awayScore: number;
  status: string | null;
  minute: number | null;
  kickoff: string;
  liveAt: string | null;
  myPrediction: { home: number; away: number } | null;
};

type LiveRankingEntry = {
  id: number;
  name: string;
  photoUrl: string | null;
  points: number;
  exact: number;
  isMe: boolean;
};

type LiveRanking = { roundNumbers: number[]; entries: LiveRankingEntry[] } | null;

/**
 * Tempo de jogo: usa o minuto da API quando disponível; senão estima a partir do
 * horário do jogo (marcado com "~", pois não desconta intervalo/acréscimos).
 */
function MatchClock({
  status,
  minute,
  kickoff,
}: {
  status: string | null;
  minute: number | null;
  kickoff: string;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (status === "PAUSED") return <>Intervalo</>;
  if (minute != null) return <>AO VIVO · {minute}&rsquo;</>;
  const est = Math.floor((Date.now() - new Date(kickoff).getTime()) / 60000);
  const shown = Math.min(Math.max(est, 0), 130);
  return <>AO VIVO · ~{shown}&rsquo;</>;
}

export default function LiveScores({
  pollMs = 15000,
  showEmpty = false,
}: {
  pollMs?: number;
  showEmpty?: boolean;
}) {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [ranking, setRanking] = useState<LiveRanking>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const data = await res.json();
        if (alive) {
          setMatches(Array.isArray(data.matches) ? data.matches : []);
          setRanking(data.ranking ?? null);
          setLoaded(true);
        }
      } catch {
        if (alive) setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, pollMs);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollMs]);

  if (matches.length === 0) {
    if (!showEmpty || !loaded) return null;
    return (
      <div className="card">
        <div className="card-title">
          <h2>🔴 Ao vivo</h2>
        </div>
        <p className="muted">Nenhum jogo em andamento agora. Volte na hora dos jogos! ⚽</p>
      </div>
    );
  }

  return (
    <>
    <div className="card">
      <div className="card-title">
        <h2>
          <span className="live-dot" /> Ao vivo — seus palpites
        </h2>
        <span className="muted">atualiza sozinho</span>
      </div>
      {matches.map((m) => {
        const acertando =
          m.myPrediction &&
          m.myPrediction.home === m.homeScore &&
          m.myPrediction.away === m.awayScore;
        return (
          <div className="match" key={m.id}>
            <div className="match-header">
              <span>
                <span className="badge badge-gray">R{m.roundNumber}</span>{" "}
                <span className={`live-tag ${m.status === "PAUSED" ? "paused" : ""}`}>
                  <MatchClock status={m.status} minute={m.minute} kickoff={m.kickoff} />
                </span>
              </span>
              {m.myPrediction ? (
                acertando ? (
                  <span className="badge badge-green">acertando ✓</span>
                ) : (
                  <span className="badge badge-gray">no momento não</span>
                )
              ) : (
                <span className="badge badge-yellow">sem palpite</span>
              )}
            </div>

            <div className="match-teams">
              <span className="team home">
                <span className="team-name">{m.homeTeam}</span>
                <TeamCrest url={m.homeCrest} name={m.homeTeam} size={26} />
              </span>
              <span className="score-final live-score-big">
                {m.homeScore} <span className="x">×</span> {m.awayScore}
              </span>
              <span className="team away">
                <TeamCrest url={m.awayCrest} name={m.awayTeam} size={26} />
                <span className="team-name">{m.awayTeam}</span>
              </span>
            </div>

            <div className="match-footer">
              {m.myPrediction ? (
                <span>
                  Seu palpite:{" "}
                  <strong>
                    {m.myPrediction.home} × {m.myPrediction.away}
                  </strong>
                </span>
              ) : (
                <span className="muted">Você não palpitou neste jogo.</span>
              )}
            </div>
          </div>
        );
      })}
    </div>

    {ranking && ranking.entries.length > 0 && (
      <div className="card">
        <div className="card-title">
          <h2>
            <span className="live-dot" /> Ranking ao vivo
            {ranking.roundNumbers.length > 0 && (
              <span className="muted"> — rodada {ranking.roundNumbers.join(" e ")}</span>
            )}
          </h2>
          <span className="muted">pontos provisórios</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Jogador</th>
                <th className="num">Exatos</th>
                <th className="num">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.entries.map((e, i) => (
                <tr key={e.id} className={e.isMe ? "row-me" : ""}>
                  <td>
                    <span className={`pos ${i < 3 ? `pos-${i + 1}` : ""}`}>{i + 1}</span>
                  </td>
                  <td>
                    <span className="player-cell">
                      <Avatar name={e.name} photoUrl={e.photoUrl} />
                      {e.name}
                    </span>
                  </td>
                  <td className="num">{e.exact}</td>
                  <td className="num points-badge">{e.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Atualiza a cada gol — os pontos se confirmam quando cada jogo termina.
        </p>
      </div>
    )}
    </>
  );
}
