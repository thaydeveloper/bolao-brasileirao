import type { Match, Round } from "@prisma/client";
import { prisma } from "./db";

export type RoundWithMatches = Round & { matches: Match[] };

export type RoundStatus = "aberta" | "em-andamento" | "encerrada" | "cancelada";

export function roundStatus(round: RoundWithMatches, now = new Date()): RoundStatus {
  if (round.canceled) return "cancelada";
  if (round.matches.length === 0) return "aberta";
  if (round.matches.every((m) => m.finished)) return "encerrada";
  if (round.matches.some((m) => m.finished || m.kickoff <= now)) return "em-andamento";
  return "aberta";
}

export const STATUS_LABEL: Record<RoundStatus, string> = {
  aberta: "Aberta para palpites",
  "em-andamento": "Em andamento",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export function firstKickoff(round: RoundWithMatches): Date | null {
  if (round.matches.length === 0) return null;
  return round.matches.reduce(
    (min, m) => (m.kickoff < min ? m.kickoff : min),
    round.matches[0].kickoff
  );
}

/**
 * A "rodada vigente": a rodada do PRÓXIMO jogo a acontecer (kickoff no futuro).
 * Usa o próximo jogo em vez do menor horário entre rodadas abertas, para que um
 * jogo adiado de uma rodada antiga não faça uma rodada passada parecer a atual.
 * Se não houver jogos futuros, cai para a rodada aberta de menor número.
 */
export async function getCurrentRound(now = new Date()): Promise<RoundWithMatches | null> {
  const nextMatch = await prisma.match.findFirst({
    where: { finished: false, kickoff: { gte: now }, round: { canceled: false } },
    orderBy: { kickoff: "asc" },
    select: { roundId: true },
  });

  if (nextMatch) {
    return prisma.round.findUnique({
      where: { id: nextMatch.roundId },
      include: { matches: { orderBy: { kickoff: "asc" } } },
    });
  }

  // Sem jogos futuros: pega a rodada aberta (não totalmente encerrada) de menor número
  const rounds = await prisma.round.findMany({
    where: { canceled: false },
    include: { matches: { orderBy: { kickoff: "asc" } } },
    orderBy: { number: "asc" },
  });
  return rounds.find((r) => r.matches.length > 0 && !r.matches.every((m) => m.finished)) ?? null;
}

/** A última rodada totalmente encerrada (para exibir o vencedor e a chave PIX). */
export async function getLastFinishedRound(): Promise<RoundWithMatches | null> {
  const rounds = await prisma.round.findMany({
    where: { canceled: false },
    include: { matches: { orderBy: { kickoff: "asc" } } },
  });
  const finished = rounds
    .filter((r) => r.matches.length > 0 && r.matches.every((m) => m.finished))
    .sort((a, b) => firstKickoff(b)!.getTime() - firstKickoff(a)!.getTime());
  return finished[0] ?? null;
}

export function isMatchLocked(match: Match, now = new Date()): boolean {
  return match.finished || match.kickoff <= now;
}

export const dataHoraBR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const dataCompletaBR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
