/**
 * Aplica o schema do Prisma ao banco durante o build (Vercel), para que colunas/
 * tabelas novas existam antes de o app rodar — evita 500 por migração esquecida.
 *
 * Seguro por design:
 * - usa DIRECT_URL (conexão direta); se ausente, cai para DATABASE_URL;
 * - NÃO usa --accept-data-loss: uma mudança destrutiva falha (exige ação manual)
 *   em vez de apagar dados;
 * - nunca derruba o build: se a migração falhar, o deploy segue e o log avisa.
 */
import { execSync } from "node:child_process";

const env = { ...process.env };

if (!env.DATABASE_URL) {
  console.warn("[db-push] DATABASE_URL ausente — pulando migração.");
  process.exit(0);
}
if (!env.DIRECT_URL) {
  console.warn("[db-push] DIRECT_URL ausente — usando DATABASE_URL para a migração.");
  env.DIRECT_URL = env.DATABASE_URL;
}

try {
  console.log("[db-push] aplicando schema ao banco (prisma db push)...");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
  console.log("[db-push] concluído com sucesso.");
} catch (err) {
  console.error("[db-push] FALHOU (o deploy continua):", err?.message ?? err);
}

process.exit(0);
