"use server";

import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import type { FormState } from "./auth";

type SubJSON = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

/** Salva a inscrição de push do dispositivo atual do usuário. */
export async function subscribePushAction(sub: SubJSON): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Inscrição inválida." };
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return { ok: true };
}

/** Remove a inscrição (quando o usuário desativa as notificações). */
export async function unsubscribePushAction(endpoint: string): Promise<{ ok: boolean }> {
  await requireUser();
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
  return { ok: true };
}

/**
 * Broadcast livre do admin: envia uma mensagem para TODOS os participantes
 * (in-app + push) a qualquer momento — independente de haver rodada ou vencedor.
 */
export async function sendAdminBroadcastAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Escreva uma mensagem antes de enviar." };
  if (message.length > 500) return { error: "A mensagem deve ter no máximo 500 caracteres." };

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await notify(u.id, "aviso-admin", message, undefined, { title: "📣 Aviso do bolão" });
  }
  return { ok: `Mensagem enviada para ${users.length} participantes (in-app + push) 🔔.` };
}
