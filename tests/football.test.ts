import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMatch, mapStandingRow } from "../src/lib/football";

// Amostras no formato real da API football-data.org (v4)
const rawFinished = {
  id: 500123,
  matchday: 15,
  utcDate: "2026-08-10T19:00:00Z",
  status: "FINISHED",
  homeTeam: { name: "CR Flamengo", shortName: "Flamengo", crest: "https://crests.football-data.org/1783.png" },
  awayTeam: { name: "SE Palmeiras", shortName: "Palmeiras", crest: "https://crests.football-data.org/1769.png" },
  score: { fullTime: { home: 2, away: 1 } },
};

const rawScheduled = {
  id: 500124,
  matchday: 16,
  utcDate: "2026-08-17T21:30:00Z",
  status: "TIMED",
  homeTeam: { name: "São Paulo FC", shortName: "Sao Paulo", crest: "https://crests.football-data.org/1776.png" },
  awayTeam: { name: "SC Corinthians Paulista", shortName: "Corinthians", crest: null },
  score: { fullTime: { home: null, away: null } },
};

test("mapMatch converte partida encerrada com placar", () => {
  const m = mapMatch(rawFinished);
  assert.equal(m.externalId, 500123);
  assert.equal(m.matchday, 15);
  assert.equal(m.homeTeam, "Flamengo");
  assert.equal(m.awayTeam, "Palmeiras");
  assert.equal(m.homeCrest, "https://crests.football-data.org/1783.png");
  assert.equal(m.finished, true);
  assert.equal(m.homeScore, 2);
  assert.equal(m.awayScore, 1);
  assert.ok(m.kickoff instanceof Date);
  assert.equal(m.kickoff.toISOString(), "2026-08-10T19:00:00.000Z");
});

test("mapMatch não expõe placar de jogo não encerrado", () => {
  const m = mapMatch(rawScheduled);
  assert.equal(m.finished, false);
  assert.equal(m.homeScore, null);
  assert.equal(m.awayScore, null);
  assert.equal(m.awayCrest, null);
});

test("mapStandingRow converte linha da tabela", () => {
  const row = mapStandingRow({
    position: 1,
    team: { name: "SE Palmeiras", shortName: "Palmeiras", crest: "https://crests.football-data.org/1769.png" },
    playedGames: 18,
    won: 12,
    draw: 5,
    lost: 1,
    goalsFor: 34,
    goalsAgainst: 12,
    goalDifference: 22,
    points: 41,
    form: "W,W,D,W,L",
  });
  assert.equal(row.position, 1);
  assert.equal(row.team, "Palmeiras");
  assert.equal(row.points, 41);
  assert.equal(row.goalDifference, 22);
  assert.equal(row.played, 18);
});
