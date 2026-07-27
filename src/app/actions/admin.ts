"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { checkNewLeader, notifyRoundFinished } from "@/lib/notifications";
import { getGeneralLeaders } from "@/lib/ranking";
import { recomputeMatchPoints } from "@/lib/results";
import { fetchMatches, FootballApiError } from "@/lib/football";
import type { FormState } from "./auth";

/**
 * Cria uma rodada a partir de texto, uma partida por linha:
 *   Flamengo; Palmeiras; 2026-07-20 16:00
 * (horário de Brasília)
 */
export async function createRoundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const number = Number(formData.get("number"));
  const season = String(formData.get("season") ?? "2026").trim() || "2026";
  const matchesText = String(formData.get("matches") ?? "").trim();

  if (!Number.isInteger(number) || number < 1) return { error: "Número da rodada inválido." };
  if (!matchesText) return { error: "Informe as partidas da rodada." };

  const lines = matchesText.split("\n").map((l) => l.trim()).filter(Boolean);
  const matches: { homeTeam: string; awayTeam: string; kickoff: Date }[] = [];

  for (const [i, line] of lines.entries()) {
    const parts = line.split(";").map((p) => p.trim());
    if (parts.length < 3) {
      return { error: `Linha ${i + 1} inválida. Use: Mandante; Visitante; AAAA-MM-DD HH:MM` };
    }
    const [homeTeam, awayTeam, dateStr] = parts;
    // Interpreta o horário como horário de Brasília (UTC-3)
    const iso = dateStr.replace(" ", "T") + ":00-03:00";
    const kickoff = new Date(iso);
    if (!homeTeam || !awayTeam || isNaN(kickoff.getTime())) {
      return { error: `Linha ${i + 1} inválida. Use: Mandante; Visitante; AAAA-MM-DD HH:MM` };
    }
    matches.push({ homeTeam, awayTeam, kickoff });
  }

  const existing = await prisma.round.findUnique({
    where: { season_number: { season, number } },
  });
  if (existing) return { error: `A rodada ${number} da temporada ${season} já existe.` };

  await prisma.round.create({
    data: { number, season, matches: { create: matches } },
  });

  revalidatePath("/admin");
  revalidatePath("/rodadas");
  return {};
}

/**
 * Importa as rodadas e partidas reais do Brasileirão via API (football-data.org).
 * É idempotente: cada partida é sincronizada pelo seu id externo, então rodar de
 * novo apenas atualiza datas/placares sem duplicar jogos. Placares oficiais já
 * disponíveis são importados e os palpites existentes são repontuados.
 */
export async function importFromApiAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const season = String(formData.get("season") ?? "2026").trim() || "2026";

  let matches;
  try {
    matches = await fetchMatches(season);
  } catch (e) {
    if (e instanceof FootballApiError) return { error: e.message };
    return { error: "Falha ao consultar a API de futebol. Tente novamente." };
  }

  if (matches.length === 0) {
    return { error: `A API não retornou partidas para a temporada ${season}.` };
  }

  const previousLeaders = await getGeneralLeaders();
  let created = 0;
  let updated = 0;

  // Garante que cada rodada (matchday) exista e faz upsert de cada partida
  const roundIdByNumber = new Map<number, number>();
  for (const m of matches) {
    let roundId = roundIdByNumber.get(m.matchday);
    if (!roundId) {
      const round = await prisma.round.upsert({
        where: { season_number: { season, number: m.matchday } },
        create: { season, number: m.matchday },
        update: {},
      });
      roundId = round.id;
      roundIdByNumber.set(m.matchday, roundId);
    }

    const existing = await prisma.match.findUnique({ where: { externalId: m.externalId } });
    const data = {
      roundId,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeCrest: m.homeCrest,
      awayCrest: m.awayCrest,
      kickoff: m.kickoff,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      finished: m.finished,
    };

    if (existing) {
      await prisma.match.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.match.create({ data: { ...data, externalId: m.externalId } });
      created++;
    }
  }

  // Repontua os palpites das partidas encerradas importadas
  const affectedRounds = [...roundIdByNumber.values()];
  for (const roundId of affectedRounds) {
    const roundMatches = await prisma.match.findMany({ where: { roundId } });
    for (const match of roundMatches) {
      await recomputeMatchPoints(
        match.id,
        match.finished && match.homeScore !== null && match.awayScore !== null
          ? { home: match.homeScore, away: match.awayScore }
          : null
      );
    }
  }

  await checkNewLeader(previousLeaders);

  revalidatePath("/admin");
  revalidatePath("/rodadas");
  revalidatePath("/ranking");
  revalidatePath("/tabela");
  revalidatePath("/");
  return { ok: `Importação concluída: ${created} novas partidas, ${updated} atualizadas.` };
}

/** Registra o resultado oficial de uma partida e recalcula os pontos dos palpites. */
export async function updateResultAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const matchId = Number(formData.get("matchId"));
  const homeScore = Number(formData.get("homeScore"));
  const awayScore = Number(formData.get("awayScore"));
  const finished = formData.get("finished") === "on";

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    return { error: "Placar inválido." };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { round: { include: { matches: true } } },
  });
  if (!match) return { error: "Partida não encontrada." };

  const previousLeaders = await getGeneralLeaders();

  await prisma.match.update({
    where: { id: matchId },
    // manualResult: o reconcile automático não sobrescreve o que o admin lançou.
    data: { homeScore, awayScore, finished, manualResult: true },
  });

  await recomputeMatchPoints(matchId, finished ? { home: homeScore, away: awayScore } : null);

  // Rodada totalmente encerrada? Notifica a todos e verifica novo líder
  const roundMatches = await prisma.match.findMany({ where: { roundId: match.roundId } });
  if (roundMatches.every((m) => m.finished)) {
    await notifyRoundFinished(match.roundId, match.round.number);
  }
  if (finished) {
    await checkNewLeader(previousLeaders);
  }

  revalidatePath(`/admin/rodadas/${match.roundId}`);
  revalidatePath(`/rodadas/${match.roundId}`);
  revalidatePath("/ranking");
  revalidatePath("/");
  return {};
}

/** Reprocessa a pontuação de todos os jogos encerrados de uma rodada. */
export async function reprocessRoundAction(roundId: number) {
  await requireAdmin();

  const matches = await prisma.match.findMany({ where: { roundId } });
  for (const match of matches) {
    await recomputeMatchPoints(
      match.id,
      match.finished && match.homeScore !== null && match.awayScore !== null
        ? { home: match.homeScore, away: match.awayScore }
        : null
    );
  }

  revalidatePath(`/admin/rodadas/${roundId}`);
  revalidatePath(`/rodadas/${roundId}`);
  revalidatePath("/ranking");
  revalidatePath("/");
}

export async function toggleCancelRoundAction(roundId: number) {
  await requireAdmin();
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return;
  await prisma.round.update({ where: { id: roundId }, data: { canceled: !round.canceled } });
  revalidatePath("/admin");
  revalidatePath("/rodadas");
  revalidatePath("/");
}

export async function deleteRoundAction(roundId: number) {
  await requireAdmin();
  await prisma.round.delete({ where: { id: roundId } });
  revalidatePath("/admin");
  revalidatePath("/rodadas");
  redirect("/admin");
}

export async function removeMemberAction(userId: number) {
  const admin = await requireAdmin();
  if (userId === admin.id) return;
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  revalidatePath("/ranking");
}
