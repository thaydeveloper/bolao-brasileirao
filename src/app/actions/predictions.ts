"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isMatchLocked } from "@/lib/rounds";
import type { FormState } from "./auth";

export async function savePredictionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const matchId = Number(formData.get("matchId"));
  const homeScore = Number(formData.get("homeScore"));
  const awayScore = Number(formData.get("awayScore"));

  if (!Number.isInteger(matchId)) return { error: "Partida inválida." };
  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0 ||
    homeScore > 99 ||
    awayScore > 99
  ) {
    return { error: "Informe um placar válido." };
  }

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { round: true } });
  if (!match) return { error: "Partida não encontrada." };
  if (match.round.canceled) return { error: "Esta rodada foi cancelada." };

  // Regra central do bolão: nenhum palpite pode ser criado/alterado após o início da partida
  if (isMatchLocked(match)) {
    return { error: "Palpite bloqueado: a partida já começou." };
  }

  await prisma.prediction.upsert({
    where: { userId_matchId: { userId: user.id, matchId } },
    create: { userId: user.id, matchId, homeScore, awayScore },
    update: { homeScore, awayScore },
  });

  revalidatePath(`/rodadas/${match.roundId}`);
  revalidatePath("/");
  return {};
}
