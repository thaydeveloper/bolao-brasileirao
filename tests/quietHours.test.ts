import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuietHours } from "../src/lib/notifications";

// Brasília = UTC-3 (sem horário de verão). Datas abaixo em UTC.
test("silêncio das 23h às 8h (Brasília)", () => {
  assert.equal(isQuietHours(new Date("2026-07-27T02:00:00Z")), true); // 23:00 BRT
  assert.equal(isQuietHours(new Date("2026-07-27T06:00:00Z")), true); // 03:00 BRT
  assert.equal(isQuietHours(new Date("2026-07-27T10:59:00Z")), true); // 07:59 BRT
});

test("fora do silêncio: das 8h às 23h (Brasília)", () => {
  assert.equal(isQuietHours(new Date("2026-07-27T11:00:00Z")), false); // 08:00 BRT
  assert.equal(isQuietHours(new Date("2026-07-27T15:00:00Z")), false); // 12:00 BRT
  assert.equal(isQuietHours(new Date("2026-07-27T01:59:00Z")), false); // 22:59 BRT
});
