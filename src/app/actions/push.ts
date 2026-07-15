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

/**
 * Envia o lembrete da rodada em andamento SÓ para o admin — mesmo que ele já
 * tenha palpitado (o lembrete normal pula quem completou). Sem dedupe: serve
 * para testar o pop-up quando quiser.
 */
export async function sendReminderTestToMeAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  const now = new Date();

  // Mesmas 2 rodadas do lembrete real (vigente + próxima, incluindo jogos atrasados)
  const rounds = await prisma.round.findMany({
    where: { canceled: false, matches: { some: { finished: false, kickoff: { gt: now } } } },
    include: { matches: { include: { predictions: { select: { userId: true } } } } },
  });
  if (rounds.length === 0) return { error: "Nenhuma rodada com jogos abertos no momento." };

  const nextOpen = (r: (typeof rounds)[number]) =>
    Math.min(...r.matches.filter((m) => !m.finished && m.kickoff > now).map((m) => m.kickoff.getTime()));
  const target = rounds.sort((a, b) => nextOpen(a) - nextOpen(b)).slice(0, 2);

  for (const round of target) {
    const open = round.matches.filter((m) => !m.finished && m.kickoff > now);
    const pending = open.filter((m) => !m.predictions.some((p) => p.userId === admin.id)).length;
    const message =
      pending > 0
        ? `Você ainda tem ${pending} jogo(s) sem palpite na rodada ${round.number}. Não perca o prazo!`
        : `Teste ✅ — rodada ${round.number}: ${open.length} jogo(s) aberto(s) (você já palpitou todos).`;
    await notify(admin.id, "palpite-pendente", message, undefined, {
      title: "⏰ Palpites pendentes",
      url: `/rodadas/${round.id}`,
    });
  }

  const nums = target.map((r) => r.number).join(" e ");
  return { ok: `Lembrete de teste enviado pra você (rodadas ${nums}) — veja o sininho 🔔 e o pop-up.` };
}
