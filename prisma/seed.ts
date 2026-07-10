import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calcularPontos } from "../src/lib/scoring";

const prisma = new PrismaClient();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function main() {
  console.log("Limpando banco...");
  await prisma.notification.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.match.deleteMany();
  await prisma.round.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("123456", 10);

  const group = await prisma.group.create({
    data: { name: "Bolão Brasileirão", maxMembers: 8 },
  });

  const playersData = [
    { name: "Thayrone", email: "admin@bolao.dev", isAdmin: true, pixKey: "thayrone@pix.com", pixKeyType: "email" },
    { name: "João Silva", email: "joao@bolao.dev", isAdmin: false, pixKey: "11987654321", pixKeyType: "telefone" },
    { name: "Pedro Santos", email: "pedro@bolao.dev", isAdmin: false, pixKey: "123.456.789-00", pixKeyType: "cpf" },
    { name: "Lucas Oliveira", email: "lucas@bolao.dev", isAdmin: false, pixKey: "a1b2c3d4-e5f6-7890", pixKeyType: "aleatoria" },
    { name: "Marcos Costa", email: "marcos@bolao.dev", isAdmin: false, pixKey: "marcos@pix.com", pixKeyType: "email" },
    { name: "Rafael Lima", email: "rafael@bolao.dev", isAdmin: false, pixKey: null, pixKeyType: null },
    { name: "Bruno Souza", email: "bruno@bolao.dev", isAdmin: false, pixKey: "11912345678", pixKeyType: "telefone" },
    { name: "André Pereira", email: "andre@bolao.dev", isAdmin: false, pixKey: "987.654.321-00", pixKeyType: "cpf" },
  ];

  const players = [];
  for (const p of playersData) {
    const user = await prisma.user.create({
      data: { ...p, passwordHash, memberships: { create: { groupId: group.id } } },
    });
    players.push(user);
  }
  console.log(`${players.length} jogadores criados (senha: 123456)`);

  const now = Date.now();

  // ---------- Rodada 1: encerrada, com resultados e pontuação ----------
  const round1Games = [
    { homeTeam: "Flamengo", awayTeam: "Palmeiras", kickoff: new Date(now - 7 * DAY), homeScore: 2, awayScore: 1 },
    { homeTeam: "Corinthians", awayTeam: "São Paulo", kickoff: new Date(now - 7 * DAY + 2 * HOUR), homeScore: 1, awayScore: 1 },
    { homeTeam: "Grêmio", awayTeam: "Internacional", kickoff: new Date(now - 6 * DAY), homeScore: 0, awayScore: 3 },
    { homeTeam: "Atlético-MG", awayTeam: "Cruzeiro", kickoff: new Date(now - 6 * DAY + 2 * HOUR), homeScore: 2, awayScore: 0 },
    { homeTeam: "Botafogo", awayTeam: "Vasco", kickoff: new Date(now - 6 * DAY + 4 * HOUR), homeScore: 3, awayScore: 2 },
  ];

  const round1 = await prisma.round.create({
    data: {
      number: 1,
      season: "2026",
      matches: {
        create: round1Games.map((g) => ({ ...g, finished: true })),
      },
    },
    include: { matches: { orderBy: { kickoff: "asc" } } },
  });

  // Palpites determinísticos e variados para a rodada 1
  const guesses = [
    // [home, away] por jogador (8) x jogo (5)
    [[2, 1], [1, 1], [1, 2], [2, 0], [2, 2]], // Thayrone
    [[2, 0], [0, 0], [0, 3], [1, 0], [3, 2]], // João
    [[1, 0], [2, 1], [1, 1], [2, 1], [1, 2]], // Pedro
    [[3, 1], [1, 1], [0, 1], [3, 0], [2, 1]], // Lucas
    [[0, 1], [2, 2], [2, 0], [2, 0], [3, 2]], // Marcos
    [[2, 1], [1, 0], [0, 2], [0, 0], [1, 1]], // Rafael
    [[1, 1], [0, 1], [1, 3], [1, 1], [2, 0]], // Bruno
    [[2, 2], [1, 2], [0, 0], [2, 2], [0, 1]], // André
  ];

  for (const [pi, player] of players.entries()) {
    for (const [mi, match] of round1.matches.entries()) {
      const [home, away] = guesses[pi][mi];
      const points = calcularPontos(
        { home, away },
        { home: match.homeScore!, away: match.awayScore! }
      );
      await prisma.prediction.create({
        data: { userId: player.id, matchId: match.id, homeScore: home, awayScore: away, points },
      });
    }
  }
  console.log("Rodada 1 criada (encerrada, pontuada)");

  // ---------- Rodada 2: aberta, jogos nos próximos dias ----------
  const round2 = await prisma.round.create({
    data: {
      number: 2,
      season: "2026",
      matches: {
        create: [
          { homeTeam: "Palmeiras", awayTeam: "Corinthians", kickoff: new Date(now + 2 * DAY) },
          { homeTeam: "São Paulo", awayTeam: "Flamengo", kickoff: new Date(now + 2 * DAY + 2 * HOUR) },
          { homeTeam: "Internacional", awayTeam: "Atlético-MG", kickoff: new Date(now + 3 * DAY) },
          { homeTeam: "Cruzeiro", awayTeam: "Botafogo", kickoff: new Date(now + 3 * DAY + 2 * HOUR) },
          { homeTeam: "Vasco", awayTeam: "Grêmio", kickoff: new Date(now + 4 * DAY) },
        ],
      },
    },
    include: { matches: { orderBy: { kickoff: "asc" } } },
  });

  // Alguns jogadores já palpitaram parcialmente na rodada 2
  for (const [pi, player] of players.entries()) {
    if (pi % 2 === 0) continue; // metade ainda não palpitou nada
    for (const [mi, match] of round2.matches.entries()) {
      if (mi >= 3) break; // palpitou só nos 3 primeiros jogos
      await prisma.prediction.create({
        data: {
          userId: player.id,
          matchId: match.id,
          homeScore: (pi + mi) % 3,
          awayScore: (pi * mi + 1) % 3,
        },
      });
    }
  }
  console.log("Rodada 2 criada (aberta para palpites)");

  console.log("\nSeed concluído! Logins de teste (senha 123456):");
  console.log("  admin@bolao.dev (administrador)");
  console.log("  joao@bolao.dev, pedro@bolao.dev, ...");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
