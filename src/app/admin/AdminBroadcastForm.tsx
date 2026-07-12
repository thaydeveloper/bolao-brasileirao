"use client";

import { useActionState } from "react";
import { sendAdminBroadcastAction } from "@/app/actions/push";
import type { FormState } from "@/app/actions/auth";

export default function AdminBroadcastForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    sendAdminBroadcastAction,
    undefined
  );

  return (
    <div className="card">
      <div className="card-title">
        <h2>📣 Enviar aviso para todos</h2>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Envia uma mensagem livre para <strong>todos os participantes</strong> — no sininho 🔔 e como
        notificação pop-up (para quem ativou). Funciona a qualquer momento, com ou sem rodada.
      </p>
      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && <div className="form-success">{state.ok}</div>}
      <form action={formAction}>
        <div className="field">
          <textarea
            name="message"
            rows={3}
            maxLength={500}
            required
            placeholder="Ex.: Galera, a rodada fecha hoje às 16h! Não esqueçam de palpitar. ⚽"
          />
        </div>
        <button className="btn" disabled={pending}>
          {pending ? "Enviando..." : "Enviar para todos agora"}
        </button>
      </form>
    </div>
  );
}
