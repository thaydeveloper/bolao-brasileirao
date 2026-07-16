import { prisma } from "./db";
import { calcularPontos } from "./scoring";

/**
 * Recalcula os pontos de todos os palpites de uma partida.
 * `result` = placar oficial (finaliza a pontuação) ou null (zera os pontos).
 * Usado pelo admin (registro manual/importação) e pelo sync ao vivo (finalização automática).
 */
export async function recomputeMatchPoints(
  matchId: number,
  result: { home: number; away: number } | null
) {
  const predictions = await prisma.prediction.findMany({ where: { matchId } });
  for (const pred of predictions) {
    const points = result
      ? calcularPontos({ home: pred.homeScore, away: pred.awayScore }, result)
      : null;
    await prisma.prediction.update({ where: { id: pred.id }, data: { points } });
  }
}
