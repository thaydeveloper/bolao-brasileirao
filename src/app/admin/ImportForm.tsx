"use client";

import { useActionState } from "react";
import { importFromApiAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

export default function ImportForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    importFromApiAction,
    undefined
  );

  return (
    <div className="card">
      <div className="card-title">
        <h2>Importar rodadas do Brasileirão</h2>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Puxa automaticamente as partidas reais (datas, escudos e placares oficiais) da API
        football-data.org. Pode rodar quantas vezes quiser — atualiza sem duplicar.
      </p>

      {!configured && (
        <div className="form-error">
          Token da API não configurado. Cadastre-se grátis em{" "}
          <a href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
            football-data.org
          </a>{" "}
          e defina <code>FOOTBALL_DATA_TOKEN</code> no arquivo <code>.env</code>.
        </div>
      )}

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && <div className="form-success">{state.ok}</div>}

      <form action={formAction}>
        <div className="field">
          <label htmlFor="import-season">Temporada</label>
          <input id="import-season" name="season" defaultValue="2026" required />
        </div>
        <button className="btn" disabled={pending || !configured}>
          {pending ? "Importando..." : "Importar agora"}
        </button>
      </form>
    </div>
  );
}
