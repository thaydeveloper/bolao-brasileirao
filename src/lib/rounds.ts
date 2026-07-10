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

/** A "rodada atual": a rodada não cancelada com jogos ainda não encerrados e o menor horário de início. */
export async function getCurrentRound(): Promise<RoundWithMatches | null> {
  const rounds = await prisma.round.findMany({
    where: { canceled: false },
    include: { matches: { orderBy: { kickoff: "asc" } } },
  });
  const open = rounds
    .filter((r) => r.matches.length > 0 && !r.matches.every((m) => m.finished))
    .sort((a, b) => firstKickoff(a)!.getTime() - firstKickoff(b)!.getTime());
  return open[0] ?? null;
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
