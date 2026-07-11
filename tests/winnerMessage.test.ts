import { test } from "node:test";
import assert from "node:assert/strict";
import { dueSlotsToday, NOTIF_SLOTS_BR } from "../src/lib/winnerMessage";

// Slots em Brasília (UTC-3): 09h, 14h, 20h  →  em UTC: 12h, 17h, 23h
const OLD = new Date("2000-01-01T00:00:00Z"); // notBefore bem antigo (não limita)

test("slots [9,14,20] estão configurados", () => {
  assert.deepEqual([...NOTIF_SLOTS_BR], [9, 14, 20]);
});

test("meio da tarde: só os slots das 09h e 14h venceram", () => {
  // now = 15h de Brasília (18h UTC)
  const due = dueSlotsToday(new Date("2026-07-11T18:00:00Z"), OLD);
  assert.deepEqual(due, [
    { date: "2026-07-11", index: 0 },
    { date: "2026-07-11", index: 1 },
  ]);
});

test("fim da noite: os 3 slots do dia venceram", () => {
  // now = 23h30 de Brasília (02h30 UTC do dia seguinte) — ainda é o dia 11 em Brasília
  const due = dueSlotsToday(new Date("2026-07-12T02:30:00Z"), OLD);
  assert.deepEqual(due, [
    { date: "2026-07-11", index: 0 },
    { date: "2026-07-11", index: 1 },
    { date: "2026-07-11", index: 2 },
  ]);
});

test("antes das 09h de Brasília: nenhum slot venceu", () => {
  // now = 08h de Brasília (11h UTC)
  const due = dueSlotsToday(new Date("2026-07-11T11:00:00Z"), OLD);
  assert.deepEqual(due, []);
});

test("notBefore descarta slots anteriores à criação do recado", () => {
  // Recado criado 13h de Brasília (16h UTC); agora são 15h de Brasília (18h UTC).
  // O slot das 09h (index 0) é anterior à criação → só o das 14h (index 1) conta.
  const created = new Date("2026-07-11T16:00:00Z");
  const due = dueSlotsToday(new Date("2026-07-11T18:00:00Z"), created);
  assert.deepEqual(due, [{ date: "2026-07-11", index: 1 }]);
});

test("usa o dia de Brasília, não o dia UTC", () => {
  // now = 00h30 UTC do dia 11 = 21h30 de Brasília do dia 10.
  // Ainda é o dia 10 em Brasília e os 3 slots (09h/14h/20h) desse dia já venceram.
  const due = dueSlotsToday(new Date("2026-07-11T00:30:00Z"), OLD);
  assert.deepEqual(due, [
    { date: "2026-07-10", index: 0 },
    { date: "2026-07-10", index: 1 },
    { date: "2026-07-10", index: 2 },
  ]);
});
