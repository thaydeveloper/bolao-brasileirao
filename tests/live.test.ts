import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMatchLive, liveTransitions, parseMinute, type LiveSnapshot } from "../src/lib/football";

const snap = (over: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  externalId: 1,
  status: null,
  home: null,
  away: null,
  minute: null,
  ...over,
});

test("parseMinute normaliza número, string, '45+2' e nulo", () => {
  assert.equal(parseMinute(37), 37);
  assert.equal(parseMinute("52"), 52);
  assert.equal(parseMinute("45+2"), 45);
  assert.equal(parseMinute(null), null);
  assert.equal(parseMinute(undefined), null);
  assert.equal(parseMinute("abc"), null);
});

test("mapMatchLive extrai status, placar corrente e minuto", () => {
  const s = mapMatchLive({
    id: 900,
    status: "IN_PLAY",
    minute: 63,
    score: { fullTime: { home: 1, away: 2 } },
  });
  assert.equal(s.externalId, 900);
  assert.equal(s.status, "IN_PLAY");
  assert.equal(s.home, 1);
  assert.equal(s.away, 2);
  assert.equal(s.minute, 63);
});

test("liveTransitions: bola começa a rolar", () => {
  const t = liveTransitions(snap({ status: "TIMED" }), snap({ status: "IN_PLAY", home: 0, away: 0 }));
  assert.equal(t.started, true);
  assert.equal(t.goal, false);
  assert.equal(t.finished, false);
});

test("liveTransitions: gol só conta com base anterior (não avisa gol antigo na 1ª leitura)", () => {
  // 1ª leitura já pegou 1x0: sem base anterior → não notifica
  const first = liveTransitions(snap({ status: "TIMED" }), snap({ status: "IN_PLAY", home: 1, away: 0 }));
  assert.equal(first.goal, false);

  // Tinha 1x0, agora 2x0 → gol
  const g = liveTransitions(
    snap({ status: "IN_PLAY", home: 1, away: 0 }),
    snap({ status: "IN_PLAY", home: 2, away: 0 })
  );
  assert.equal(g.goal, true);
});

test("liveTransitions: placar corrigido para baixo não vira gol", () => {
  const t = liveTransitions(
    snap({ status: "IN_PLAY", home: 2, away: 1 }),
    snap({ status: "IN_PLAY", home: 1, away: 1 })
  );
  assert.equal(t.goal, false);
});

test("liveTransitions: fim de jogo dispara uma vez", () => {
  const end = liveTransitions(
    snap({ status: "IN_PLAY", home: 2, away: 1 }),
    snap({ status: "FINISHED", home: 2, away: 1 })
  );
  assert.equal(end.finished, true);

  // Já estava FINISHED → não repete
  const again = liveTransitions(
    snap({ status: "FINISHED", home: 2, away: 1 }),
    snap({ status: "FINISHED", home: 2, away: 1 })
  );
  assert.equal(again.finished, false);
});
