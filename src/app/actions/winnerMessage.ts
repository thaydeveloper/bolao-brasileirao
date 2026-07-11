"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { getWinnerMessageState, WINNER_MESSAGE_MAX, winnerMessageText } from "@/lib/winnerMessage";
import type { FormState } from "./auth";

/**
 * Salva (cria ou atualiza) o recado do campeão da última rodada encerrada.
 * Só o vencedor da rodada pode escrever, e apenas enquanto a próxima rodada não
 * começou. O admin pode escrever/editar sempre (modo teste / moderação).
 */
export async function saveWinnerMessageAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const message = String(formData.get("message") ?? "").trim();

  if (!message) return { error: "Escreva um recado antes de enviar." };
  if (message.length > WINNER_MESSAGE_MAX) {
    return { error: `O recado deve ter no máximo ${WINNER_MESSAGE_MAX} caracteres.` };
  }

  const state = await getWinnerMessageState();
  if (!state) return { error: "Ainda não há uma rodada encerrada." };
  if (!state.winnerIds.includes(user.id) && !user.isAdmin) {
    return { error: "Apenas o vencedor da rodada pode deixar um recado." };
  }
  if (!state.open && !user.isAdmin) {
    return { error: "O prazo encerrou: a próxima rodada já começou." };
  }

  await prisma.roundMessage.upsert({
    where: { roundId: state.round.id },
    create: { roundId: state.round.id, authorId: user.id, message },
    update: { message, authorId: user.id },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: "Recado salvo! Ele será enviado 3× por dia até o início da próxima rodada." };
}

/**
 * Envia AGORA a notificação do recado atual, apenas para o próprio admin (sininho 🔔).
 * Sem dedupe: pode repetir o teste quantas vezes quiser, sem incomodar o grupo.
 */
export async function sendWinnerMessageTestAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();

  const state = await getWinnerMessageState();
  if (!state) return { error: "Ainda não há uma rodada encerrada." };
  if (!state.message) {
    return { error: `Nenhum recado cadastrado para a rodada ${state.round.number}. Escreva um acima.` };
  }

  await notify(
    admin.id,
    "recado-campeao",
    `${winnerMessageText(state.round.number, state.message.message)} [teste]`
  );

  revalidatePath("/", "layout");
  return { ok: "Notificação de teste enviada para você — confira o sininho 🔔." };
}
