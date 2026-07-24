import { test } from "node:test";
import assert from "node:assert/strict";
import { winnersFromRanking, payeesFromRanking, type RoundRankingEntry } from "../src/lib/ranking";
import type { RoundWithMatches } from "../src/lib/rounds";

// Rodada "encerrada": tem ao menos um jogo e todos finalizados.
// number < 20 → regra antiga (quem cravou mais).
const roundEncerrada = {
  number: 19,
  canceled: false,
  matches: [{ finished: true }],
} as unknown as RoundWithMatches;

// number >= 20 → pagamento por cravada (todos que cravaram).
const roundEncerrada20 = {
  number: 20,
  canceled: false,
  matches: [{ finished: true }],
} as unknown as RoundWithMatches;

const roundEmAndamento = {
  number: 21,
  canceled: false,
  matches: [{ finished: false, kickoff: new Date(0) }],
} as unknown as RoundWithMatches;

function entry(name: string, points: number, exactCount: number): RoundRankingEntry {
  return {
    user: { id: name.charCodeAt(0), name, photoUrl: null, pixKey: `pix-${name}`, pixKeyType: null },
    points,
    exactCount,
    predictedCount: 10,
  };
}

const names = (es: RoundRankingEntry[]) => es.map((e) => e.user.name).sort();

test("pagamento vai para quem cravou mais, mesmo não sendo o vencedor em pontos", () => {
  // Ranking ordenado por pontos (como computeRoundRanking devolve)
  const ranking = [entry("Ana", 50, 1), entry("Bia", 30, 2), entry("Caio", 20, 0)];
  assert.deepEqual(names(winnersFromRanking(ranking, roundEncerrada)), ["Ana"]); // troféu = mais pontos
  assert.deepEqual(names(payeesFromRanking(ranking, roundEncerrada)), ["Bia"]); // pagamento = mais cravadas
});

test("empate no nº de cravadas divide o pagamento", () => {
  // Ordenado por pontos desc, como computeRoundRanking devolve
  const ranking = [entry("Caio", 60, 1), entry("Ana", 50, 2), entry("Bia", 40, 2)];
  assert.deepEqual(names(winnersFromRanking(ranking, roundEncerrada)), ["Caio"]); // mais pontos
  assert.deepEqual(names(payeesFromRanking(ranking, roundEncerrada)), ["Ana", "Bia"]); // dividem cravadas
});

test("ninguém cravou → pagamento cai para o vencedor em pontos", () => {
  const ranking = [entry("Ana", 30, 0), entry("Bia", 25, 0)];
  assert.deepEqual(names(payeesFromRanking(ranking, roundEncerrada)), ["Ana"]);
});

test("ninguém cravou e empate em pontos → divide entre os líderes em pontos", () => {
  const ranking = [entry("Ana", 30, 0), entry("Bia", 30, 0), entry("Caio", 10, 0)];
  assert.deepEqual(names(payeesFromRanking(ranking, roundEncerrada)), ["Ana", "Bia"]);
});

test("rodada não encerrada não tem vencedor nem pagamento", () => {
  const ranking = [entry("Ana", 50, 3)];
  assert.deepEqual(payeesFromRanking(ranking, roundEmAndamento), []);
  assert.deepEqual(winnersFromRanking(ranking, roundEmAndamento), []);
});

test("rodada >= 20: pagamento por cravada paga TODOS que cravaram (não só quem cravou mais)", () => {
  const ranking = [entry("Ana", 60, 3), entry("Bia", 40, 1), entry("Caio", 30, 0)];
  assert.deepEqual(names(winnersFromRanking(ranking, roundEncerrada20)), ["Ana"]); // troféu = mais pontos
  assert.deepEqual(names(payeesFromRanking(ranking, roundEncerrada20)), ["Ana", "Bia"]); // todos que cravaram
});

test("rodada >= 20: ninguém cravou → ninguém recebe", () => {
  const ranking = [entry("Ana", 30, 0), entry("Bia", 25, 0)];
  assert.deepEqual(payeesFromRanking(ranking, roundEncerrada20), []);
});
