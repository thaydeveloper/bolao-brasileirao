import { prisma } from "./db";
import { firstKickoff, getCurrentRound, getLastFinishedRound, type RoundWithMatches } from "./rounds";
import { getRoundWinners } from "./ranking";

/** Horários (em Brasília, UTC-3) das 3 notificações diárias do recado do campeão. */
export const NOTIF_SLOTS_BR = [9, 14, 20] as const;

/** Tamanho máximo do recado do campeão. */
export const WINNER_MESSAGE_MAX = 280;

/** Texto padrão da notificação do recado (usado no envio real e no teste do admin). */
export function winnerMessageText(roundNumber: number, message: string): string {
  return `💬 Recado do campeão da rodada ${roundNumber}: "${message}"`;
}

const BR_OFFSET_MS = 3 * 60 * 60 * 1000; // Brasília = UTC-3 (sem horário de verão)

export type WinnerMessage = {
  id: number;
  authorId: number;
  message: string;
  createdAt: Date;
};

export type WinnerMessageState = {
  /** Rodada encerrada mais recente — a "dona" do recado. */
  round: RoundWithMatches;
  /** Início da próxima rodada (fim da janela). null = próxima rodada ainda não agendada. */
  deadline: Date | null;
  /** true enquanto a próxima rodada não começou: o vencedor pode escrever e as notificações saem. */
  open: boolean;
  /** Recado já escrito (ou null se ainda não há). */
  message: WinnerMessage | null;
  /** IDs dos vencedores da rodada (não recebem a própria notificação). */
  winnerIds: number[];
};

/**
 * Estado do "recado do campeão": qual rodada encerrada está no comando, se a janela
 * de envio ainda está aberta (até o início da próxima rodada) e quem são os vencedores.
 * Usado tanto pela UI (dashboard) quanto pelo verificador de notificações e pela action.
 */
export async function getWinnerMessageState(now = new Date()): Promise<WinnerMessageState | null> {
  const [lastFinished, currentRound] = await Promise.all([
    getLastFinishedRound(),
    getCurrentRound(now),
  ]);
  if (!lastFinished) return null;

  const deadline = currentRound ? firstKickoff(currentRound) : null;
  const open = deadline === null || now < deadline;

  const [message, winners] = await Promise.all([
    prisma.roundMessage.findUnique({ where: { roundId: lastFinished.id } }),
    getRoundWinners(lastFinished),
  ]);

  return {
    round: lastFinished,
    deadline,
    open,
    message: message
      ? { id: message.id, authorId: message.authorId, message: message.message, createdAt: message.createdAt }
      : null,
    winnerIds: winners.map((w) => w.user.id),
  };
}

/**
 * Quais dos 3 horários diários já "venceram" no dia de hoje (horário de Brasília).
 * Função pura e determinística — a base do envio idempotente (dedupe por data+slot).
 *
 * @param now       instante atual
 * @param notBefore não gera slots anteriores a esta data (ex.: criação do recado),
 *                  evitando um disparo em lote dos horários já passados no dia da criação
 */
export function dueSlotsToday(
  now: Date,
  notBefore: Date,
  slotsBR: readonly number[] = NOTIF_SLOTS_BR
): { date: string; index: number }[] {
  // Desloca para tratar os campos UTC como o calendário de Brasília.
  const b = new Date(now.getTime() - BR_OFFSET_MS);
  const y = b.getUTCFullYear();
  const mo = b.getUTCMonth();
  const d = b.getUTCDate();
  const date = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const due: { date: string; index: number }[] = [];
  slotsBR.forEach((hour, index) => {
    // Brasília HH:00 = UTC (HH+3):00
    const slotMs = Date.UTC(y, mo, d, hour + 3, 0, 0);
    if (now.getTime() >= slotMs && slotMs >= notBefore.getTime()) {
      due.push({ date, index });
    }
  });
  return due;
}
