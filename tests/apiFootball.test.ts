import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapFixture,
  normalizeStatus,
  teamSimilarity,
  fixtureScore,
  bestFixtureFor,
  type ApiFixture,
} from "../src/lib/apiFootball";

test("normalizeStatus mapeia os códigos da API-Football", () => {
  assert.equal(normalizeStatus("1H"), "IN_PLAY");
  assert.equal(normalizeStatus("2H"), "IN_PLAY");
  assert.equal(normalizeStatus("HT"), "PAUSED");
  assert.equal(normalizeStatus("FT"), "FINISHED");
  assert.equal(normalizeStatus("NS"), "TIMED");
  assert.equal(normalizeStatus("PST"), "OTHER");
  assert.equal(normalizeStatus(null), "OTHER");
});

test("mapFixture extrai placar, status e minuto", () => {
  const f = mapFixture({
    fixture: { date: "2026-08-10T19:00:00+00:00", status: { short: "2H", elapsed: 67 } },
    teams: { home: { name: "Flamengo" }, away: { name: "Palmeiras" } },
    goals: { home: 2, away: 1 },
  });
  assert.equal(f.status, "IN_PLAY");
  assert.equal(f.minute, 67);
  assert.equal(f.home, 2);
  assert.equal(f.away, 1);
  assert.equal(f.homeName, "Flamengo");
  assert.equal(f.kickoff.toISOString(), "2026-08-10T19:00:00.000Z");
});

test("teamSimilarity ignora acentos e siglas", () => {
  assert.ok(teamSimilarity("Sao Paulo", "São Paulo FC") >= 2);
  assert.equal(teamSimilarity("Flamengo", "CR Flamengo"), 1);
  assert.equal(teamSimilarity("Flamengo", "Palmeiras"), 0);
  // "Atlético-MG" casa melhor com "Atletico MG" (2 tokens) do que com "Atletico GO" (1)
  assert.ok(teamSimilarity("Atletico MG", "Atlético-MG") > teamSimilarity("Atletico MG", "Atletico GO"));
});

const fix = (over: Partial<ApiFixture>): ApiFixture => ({
  kickoff: new Date("2026-08-10T19:00:00Z"),
  homeName: "Flamengo",
  awayName: "Palmeiras",
  status: "IN_PLAY",
  home: 1,
  away: 0,
  minute: 30,
  ...over,
});

test("fixtureScore exige os dois times e janela de horário", () => {
  const our = { homeTeam: "Flamengo", awayTeam: "Palmeiras", kickoff: new Date("2026-08-10T19:00:00Z") };
  assert.ok(fixtureScore(our, fix({})) > 0);
  // horário fora da janela (±3h)
  assert.equal(fixtureScore(our, fix({ kickoff: new Date("2026-08-10T23:30:00Z") })), 0);
  // só um time bate
  assert.equal(fixtureScore(our, fix({ awayName: "Santos" })), 0);
});

test("bestFixtureFor escolhe o de maior pontuação", () => {
  const our = { homeTeam: "Sao Paulo", awayTeam: "Corinthians", kickoff: new Date("2026-08-10T21:30:00Z") };
  const fixtures = [
    fix({ homeName: "Flamengo", awayName: "Palmeiras", kickoff: new Date("2026-08-10T19:00:00Z") }),
    fix({ homeName: "São Paulo", awayName: "Corinthians", kickoff: new Date("2026-08-10T21:30:00Z"), home: 0, away: 0 }),
  ];
  const best = bestFixtureFor(our, fixtures);
  assert.equal(best?.homeName, "São Paulo");
});

test("bestFixtureFor devolve null quando nada corresponde", () => {
  const our = { homeTeam: "Bahia", awayTeam: "Fortaleza", kickoff: new Date("2026-08-10T19:00:00Z") };
  assert.equal(bestFixtureFor(our, [fix({})]), null);
});
