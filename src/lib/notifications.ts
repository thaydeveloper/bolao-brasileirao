import { prisma } from "./db";
import { getGeneralLeaders } from "./ranking";
import { firstKickoff } from "./rounds";

const REMINDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutos

/** Cria uma notificação. Com dedupeKey, nunca duplica para o mesmo usuário. */
export async function notify(
  userId: number,
  type: string,
  message: string,
  dedupeKey?: string
) {
  if (!dedupeKey) {
    await prisma.notification.create({ data: { userId, type, message } });
    return;
  }
  try {
    await prisma.notification.create({ data: { userId, type, message, dedupeKey } });
  } catch {
    // já enviada (violação de unique userId+dedupeKey) — ignora
  }
}

/**
 * Verifica lembretes pendentes. Idempotente (dedupe por usuário+chave), pode ser
 * chamada com frequência: pelo endpoint /api/cron/reminders ou no carregamento do dashboard.
 */
export async function checkReminders(now = new Date()) {
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const [users, rounds] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    // Só carrega rodadas que têm ALGUM jogo começando na janela de lembrete.
    // Na maioria das visitas isso retorna vazio → dashboard rápido.
    prisma.round.findMany({
      where: {
        canceled: false,
        matches: { some: { kickoff: { gt: now, lte: windowEnd } } },
      },
      include: {
        matches: {
          orderBy: { kickoff: "asc" },
          include: { predictions: { select: { userId: true } } },
        },
      },
    }),
  ]);

  for (const round of rounds) {
    if (round.matches.length === 0) continue;
    const first = firstKickoff(round)!;

    // Lembrete da rodada: ~30 min antes do primeiro jogo, para quem não palpitou tudo
    if (first > now && first <= windowEnd) {
      for (const user of users) {
        const missing = round.matches.some(
          (m) => !m.predictions.some((p) => p.userId === user.id)
        );
        if (missing) {
          await notify(
            user.id,
            "lembrete-rodada",
            `Você ainda não enviou todos os seus palpites da rodada ${round.number}.`,
            `lembrete-rodada-${round.id}`
          );
        }
      }
    }

    // Lembrete por jogo: ~30 min antes de cada partida sem palpite
    for (const match of round.matches) {
      if (match.kickoff <= now || match.kickoff > windowEnd) continue;
      for (const user of users) {
        if (!match.predictions.some((p) => p.userId === user.id)) {
          await notify(
            user.id,
            "lembrete-jogo",
            `O jogo ${match.homeTeam} x ${match.awayTeam} começa em 30 minutos e você ainda não palpitou.`,
            `lembrete-jogo-${match.id}`
          );
        }
      }
    }
  }
}

/** Avisa a todos que a pontuação da rodada foi atualizada (rodada totalmente encerrada). */
export async function notifyRoundFinished(roundId: number, roundNumber: number) {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await notify(
      user.id,
      "resultado-rodada",
      `A pontuação da rodada ${roundNumber} foi atualizada. Confira o resultado!`,
      `resultado-rodada-${roundId}`
    );
  }
}

/** Compara líderes antes/depois de uma atualização de resultado e notifica novos líderes. */
export async function checkNewLeader(previousLeaderIds: number[]) {
  const current = await getGeneralLeaders();
  for (const userId of current) {
    if (!previousLeaderIds.includes(userId)) {
      await notify(userId, "novo-lider", "Você assumiu a liderança do bolão! 🏆");
    }
  }
}
