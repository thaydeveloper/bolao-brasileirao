"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import PhotoUpload from "@/components/PhotoUpload";

export default function CadastroPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(registerAction, undefined);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>⚽ Bolão Brasileirão</h1>
        <p className="subtitle">Crie sua conta — bolão fechado, até 8 participantes</p>
        {state?.error && <div className="form-error">{state.error}</div>}
        <form action={formAction}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" required autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Senha (mín. 6 caracteres)</label>
            <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <PhotoUpload label="Foto (opcional)" />
          <div className="field">
            <label htmlFor="pixKeyType">Tipo da chave PIX (opcional)</label>
            <select id="pixKeyType" name="pixKeyType" defaultValue="">
              <option value="">Selecione...</option>
              <option value="aleatoria">Chave aleatória</option>
              <option value="cpf">CPF</option>
              <option value="telefone">Telefone</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pixKey">Chave PIX (opcional — usada para receber quando você vencer a rodada)</label>
            <input id="pixKey" name="pixKey" />
          </div>
          <button className="btn btn-block" disabled={pending}>
            {pending ? "Criando conta..." : "Criar conta"}
          </button>
        </form>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
          Já tem conta?{" "}
          <Link href="/login" style={{ color: "var(--green)" }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
