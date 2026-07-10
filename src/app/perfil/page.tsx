import { requireUser } from "@/lib/auth";
import ProfileForms from "./ProfileForms";

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
