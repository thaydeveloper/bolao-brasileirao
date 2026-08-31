import { test } from "node:test";
import assert from "node:assert/strict";
import { isMatchLive, MAX_LIVE_AGE_MS } from "../src/lib/rounds";

const now = new Date("2026-08-30T23:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

test("ao vivo: em andamento e dentro de 3,5h do início", () => {
  assert.equal(isMatchLive({ finished: false, liveStatus: "IN_PLAY", kickoff: ago(60 * 60 * 1000) }, now), true);
  assert.equal(isMatchLive({ finished: false, liveStatus: "PAUSED", kickoff: ago(90 * 60 * 1000) }, now), true);
});

test("NÃO ao vivo: passou de 3,5h sem finalizar (API travada)", () => {
  assert.equal(
    isMatchLive({ finished: false, liveStatus: "IN_PLAY", kickoff: ago(MAX_LIVE_AGE_MS + 60_000) }, now),
    false
  );
});

test("NÃO ao vivo: encerrado ou sem status de jogo", () => {
  assert.equal(isMatchLive({ finished: true, liveStatus: "IN_PLAY", kickoff: ago(60 * 60 * 1000) }, now), false);
  assert.equal(isMatchLive({ finished: false, liveStatus: "TIMED", kickoff: ago(60 * 60 * 1000) }, now), false);
  assert.equal(isMatchLive({ finished: false, liveStatus: null, kickoff: ago(60 * 60 * 1000) }, now), false);
});
