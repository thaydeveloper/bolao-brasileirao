"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, undefined);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>⚽ Bolão Brasileirão</h1>
        <p className="subtitle">Entre para palpitar na rodada</p>
        {state?.error && <div className="form-error">{state.error}</div>}
        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn btn-block" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
          Ainda não participa?{" "}
          <Link href="/cadastro" style={{ color: "var(--green)" }}>
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
