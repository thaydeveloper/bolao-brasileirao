import { test } from "node:test";
import assert from "node:assert/strict";
import { perWinnerPayout, computeSettlementCore } from "../src/lib/settlement";

test("perWinnerPayout: rateio de um jogo (grupo de 8, R$5)", () => {
  assert.equal(perWinnerPayout(8, 1), 35); // 1 cravou → recebe dos 7
  assert.equal(perWinnerPayout(8, 2), 15); // 2 cravaram → 30/2
  assert.equal(perWinnerPayout(8, 4), 5); // 4 cravaram → 20/4
  assert.equal(perWinnerPayout(8, 0), 0); // ninguém cravou → sem pagamento
  assert.equal(perWinnerPayout(8, 8), 0); // todos cravaram → sem pagamento
});

test("um jogo com 2 cravadores: +15 pra cada, -5 pros outros 6 (fecha em zero)", () => {
  const players = [1, 2, 3, 4, 5, 6, 7, 8];
  const acc = computeSettlementCore(players, [{ winnerIds: [1, 2] }]);
  assert.equal(acc.get(1)!.received, 15);
  assert.equal(acc.get(1)!.paid, 0);
  assert.equal(acc.get(1)!.cravadas, 1);
  assert.equal(acc.get(3)!.paid, 5);
  assert.equal(acc.get(3)!.received, 0);
  const net = players.reduce((s, id) => s + (acc.get(id)!.received - acc.get(id)!.paid), 0);
  assert.equal(net, 0); // dinheiro se conserva
});

test("quem cravou não paga NAQUELE jogo, mas paga nos que não cravou", () => {
  const players = [1, 2, 3, 4, 5, 6, 7, 8];
  // Jogo A: jogador 1 cravou sozinho (recebe 35). Jogo B: jogador 2 cravou sozinho.
  const acc = computeSettlementCore(players, [{ winnerIds: [1] }, { winnerIds: [2] }]);
  // Jogador 1: recebe 35 no A, paga 5 no B → net +30
  assert.equal(acc.get(1)!.received, 35);
  assert.equal(acc.get(1)!.paid, 5);
  // Jogador 3 (não cravou nada): paga 5 + 5 = 10
  assert.equal(acc.get(3)!.paid, 10);
  assert.equal(acc.get(3)!.received, 0);
});

test("ninguém cravou o jogo → jogo sem pagamento", () => {
  const players = [1, 2, 3, 4, 5, 6, 7, 8];
  const acc = computeSettlementCore(players, [{ winnerIds: [] }]);
  for (const id of players) {
    assert.equal(acc.get(id)!.paid, 0);
    assert.equal(acc.get(id)!.received, 0);
  }
});

test("todos cravaram → ninguém paga, mas conta a cravada", () => {
  const players = [1, 2, 3];
  const acc = computeSettlementCore(players, [{ winnerIds: [1, 2, 3] }]);
  for (const id of players) {
    assert.equal(acc.get(id)!.paid, 0);
    assert.equal(acc.get(id)!.received, 0);
    assert.equal(acc.get(id)!.cravadas, 1);
  }
});
