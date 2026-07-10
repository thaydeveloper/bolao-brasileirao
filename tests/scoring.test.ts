import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPontos } from "../src/lib/scoring";

const p = (home: number, away: number) => ({ home, away });

test("placar exato vale 40 pontos", () => {
  assert.equal(calcularPontos(p(2, 1), p(2, 1)), 40);
  assert.equal(calcularPontos(p(0, 0), p(0, 0)), 40);
  assert.equal(calcularPontos(p(1, 3), p(1, 3)), 40);
});

test("vencedor + gols do vencedor vale 15 pontos", () => {
  // Exemplo da spec: palpite 2x1, resultado 2x0
  assert.equal(calcularPontos(p(2, 1), p(2, 0)), 15);
  // Vencedor visitante: palpite 1x3, resultado 0x3
  assert.equal(calcularPontos(p(1, 3), p(0, 3)), 15);
});

test("vencedor + saldo de gols vale 12 pontos", () => {
  // Exemplo da spec: palpite 2x1, resultado 1x0 (saldo 1)
  assert.equal(calcularPontos(p(2, 1), p(1, 0)), 12);
  // Visitante: palpite 0x2, resultado 1x3 (saldo -2)
  assert.equal(calcularPontos(p(0, 2), p(1, 3)), 12);
});

test("acertar o empate (placar diferente) vale 15 pontos", () => {
  // Exemplo da spec: palpite 2x2, resultado 1x1
  assert.equal(calcularPontos(p(2, 2), p(1, 1)), 15);
  assert.equal(calcularPontos(p(0, 0), p(3, 3)), 15);
});

test("acertar apenas o vencedor vale 10 pontos", () => {
  // Exemplo da spec: palpite 2x0, resultado 3x2
  assert.equal(calcularPontos(p(2, 0), p(3, 2)), 10);
  // Visitante: palpite 0x1, resultado 2x4 (gols do vencedor e saldo diferentes)
  assert.equal(calcularPontos(p(0, 1), p(2, 4)), 10);
});

test("errar tudo vale 0 pontos", () => {
  assert.equal(calcularPontos(p(2, 1), p(1, 2)), 0); // inverteu o vencedor
  assert.equal(calcularPontos(p(1, 1), p(2, 1)), 0); // palpitou empate, teve vencedor
  assert.equal(calcularPontos(p(2, 0), p(0, 0)), 0); // palpitou vencedor, deu empate
});

test("prioridade: gols do vencedor (15) vence saldo (12)", () => {
  // palpite 3x1: acertou vencedor; resultado 3x2 → gols do vencedor iguais (3) → 15
  assert.equal(calcularPontos(p(3, 1), p(3, 2)), 15);
});
