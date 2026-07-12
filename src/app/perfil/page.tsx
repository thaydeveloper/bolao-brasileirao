import { requireUser } from "@/lib/auth";
import ProfileForms from "./ProfileForms";
import EnableNotifications from "@/components/EnableNotifications";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const user = await requireUser();

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Meu perfil</h1>
          <p className="muted">{user.email}</p>
        </div>
        {user.isAdmin && <span className="badge badge-blue">Administrador</span>}
      </div>

      <div className="card">
        <h2>Notificações</h2>
        <EnableNotifications />
      </div>

      <ProfileForms
        defaults={{
          name: user.name,
          photoUrl: user.photoUrl ?? "",
          pixKey: user.pixKey ?? "",
          pixKeyType: user.pixKeyType ?? "",
        }}
      />
    </main>
  );
}
