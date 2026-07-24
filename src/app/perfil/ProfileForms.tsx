"use client";

import { useActionState } from "react";
import { updateProfileAction, changePasswordAction } from "@/app/actions/profile";
import type { FormState } from "@/app/actions/auth";
import PhotoUpload from "@/components/PhotoUpload";

type Defaults = { name: string; photoUrl: string; pixKey: string; pixKeyType: string };

export default function ProfileForms({ defaults }: { defaults: Defaults }) {
  const [profileState, profileAction, profilePending] = useActionState<FormState, FormData>(
    updateProfileAction,
    undefined
  );
  const [passState, passAction, passPending] = useActionState<FormState, FormData>(
    changePasswordAction,
    undefined
  );

  return (
    <div className="grid-2">
      <div className="card">
        <h2>Dados e chave PIX</h2>
        {profileState?.error && <div className="form-error">{profileState.error}</div>}
        {profileState && !profileState.error && (
          <div className="form-success">Perfil atualizado com sucesso!</div>
        )}
        <form action={profileAction}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" defaultValue={defaults.name} required />
          </div>
          <PhotoUpload label="Foto" defaultValue={defaults.photoUrl} personName={defaults.name} />
          <div className="field">
            <label htmlFor="pixKeyType">Tipo da chave PIX</label>
            <select id="pixKeyType" name="pixKeyType" defaultValue={defaults.pixKeyType}>
              <option value="">Selecione...</option>
              <option value="aleatoria">Chave aleatória</option>
              <option value="cpf">CPF</option>
              <option value="telefone">Telefone</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pixKey">Chave PIX</label>
            <input id="pixKey" name="pixKey" defaultValue={defaults.pixKey} placeholder="Exibida quando você vencer uma rodada" />
          </div>
          <button className="btn" disabled={profilePending}>
            {profilePending ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Alterar senha</h2>
        {passState?.error && <div className="form-error">{passState.error}</div>}
        {passState && !passState.error && (
          <div className="form-success">Senha alterada com sucesso!</div>
        )}
        <form action={passAction}>
          <div className="field">
            <label htmlFor="currentPassword">Senha atual</label>
            <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="newPassword">Nova senha (mín. 6 caracteres)</label>
            <input id="newPassword" name="newPassword" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <button className="btn" disabled={passPending}>
            {passPending ? "Alterando..." : "Alterar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
