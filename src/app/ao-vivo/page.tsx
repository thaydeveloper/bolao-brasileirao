import { requireUser } from "@/lib/auth";
import LiveScores from "@/components/LiveScores";

export const dynamic = "force-dynamic";

export default async function AoVivoPage() {
  await requireUser();

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>🔴 Ao vivo</h1>
          <p className="muted">
            Placares das partidas em andamento, atualizados automaticamente. Você recebe uma
            notificação a cada gol.
          </p>
        </div>
      </div>

      <LiveScores showEmpty pollMs={20000} />
    </main>
  );
}
