import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import NotificationBell from "./NotificationBell";
import { dataHoraBR } from "@/lib/rounds";

export default async function Nav() {
  const session = await getSession();
  if (!session) return null;

  const [user, notifications] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  if (!user) return null;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          ⚽ Bolão <span>Brasileirão</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Início</Link>
          <Link href="/rodadas">Rodadas</Link>
          <Link href="/tabela">Tabela</Link>
          <Link href="/ranking">Ranking</Link>
          <Link href="/regras">Regras</Link>
          <Link href="/perfil">Perfil</Link>
          {user.isAdmin && <Link href="/admin">Admin</Link>}
        </div>
        <div className="nav-actions">
          <NotificationBell
            notifications={notifications.map((n) => ({
              id: n.id,
              message: n.message,
              createdAt: dataHoraBR.format(n.createdAt),
              read: n.readAt !== null,
            }))}
          />
          <form action={logoutAction}>
            <button className="btn btn-secondary btn-sm" title={user.name}>
              Sair
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
