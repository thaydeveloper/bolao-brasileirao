import { NextResponse, type NextRequest } from "next/server";
import { checkReminders, checkPendingReminders, checkWinnerMessages } from "@/lib/notifications";
import { syncLiveMatches, reconcileFinishedMatches } from "@/lib/live";

/**
 * Endpoint para agendadores (Vercel Cron, Task Scheduler, GitHub Actions...).
 * Chame a cada 5–10 minutos. Autenticação aceita de duas formas:
 *   - Query:  GET /api/cron/reminders?secret=CRON_SECRET
 *   - Header: Authorization: Bearer CRON_SECRET  (padrão do Vercel Cron, que
 *     injeta automaticamente o CRON_SECRET quando essa env var está definida)
 * O dashboard também dispara a verificação ao carregar, então funciona sem cron.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const fromQuery = request.nextUrl.searchParams.get("secret");
    const fromHeader = request.headers.get("authorization");
    const ok = fromQuery === secret || fromHeader === `Bearer ${secret}`;
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await checkReminders();
  await checkPendingReminders().catch(() => {});
  // .catch: tolera o intervalo entre o deploy e o `db push` das novas tabelas/colunas
  await checkWinnerMessages().catch(() => {});
  // Placares/gols ao vivo (respeita o cooldown para não estourar a cota da API)
  await syncLiveMatches().catch(() => {});
  // Rede de segurança: finaliza/repontua jogos encerrados que escaparam do ao vivo
  const reconciled = await reconcileFinishedMatches().catch(() => 0);
  return NextResponse.json({ ok: true, reconciled, checkedAt: new Date().toISOString() });
}
