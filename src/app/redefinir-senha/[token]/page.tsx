import { verifyResetToken } from "@/lib/passwordReset";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await verifyResetToken(token);

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Redefinir senha</h1>
          <p className="muted">Bolão Brasileirão</p>
        </div>
      </div>

      <div className="card">
        {user ? (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              Olá, <strong>{user.name}</strong>! Escolha sua nova senha abaixo.
            </p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <p className="form-error">
            Este link é inválido, já foi usado ou expirou. Peça um novo link ao administrador do
            bolão.
          </p>
        )}
      </div>
    </main>
  );
}
