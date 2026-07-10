"use client";

import { useActionState } from "react";
import { createRoundAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

const PLACEHOLDER = `Flamengo; Palmeiras; 2026-07-20 16:00
Corinthians; São Paulo; 2026-07-20 18:30
Grêmio; Internacional; 2026-07-21 20:00`;

export default function NewRoundForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createRoundAction,
    undefined
  );

  return (
    <div className="card">
      <h2>Nova rodada</h2>
      {state?.error && <div className="form-error">{state.error}</div>}
      {state && !state.error && <div className="form-success">Rodada criada com sucesso!</div>}
      <form action={formAction}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="number">Número da rodada</label>
            <input id="number" name="number" type="number" min={1} max={38} required />
          </div>
          <div className="field">
            <label htmlFor="season">Temporada</label>
            <input id="season" name="season" defaultValue="2026" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="matches">
            Partidas — uma por linha: Mandante; Visitante; AAAA-MM-DD HH:MM (horário de Brasília)
          </label>
          <textarea id="matches" name="matches" rows={8} placeholder={PLACEHOLDER} required />
        </div>
        <button className="btn" disabled={pending}>
          {pending ? "Criando..." : "Criar rodada"}
        </button>
      </form>
    </div>
  );
}
