"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/passwordReset";
import type { FormState } from "@/app/actions/auth";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    resetPasswordAction,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      {state?.error && <div className="form-error">{state.error}</div>}
      <div className="field">
        <label htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" minLength={6} required autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirmar nova senha</label>
        <input id="confirm" name="confirm" type="password" minLength={6} required autoComplete="new-password" />
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Salvando..." : "Salvar nova senha e entrar"}
      </button>
    </form>
  );
}
