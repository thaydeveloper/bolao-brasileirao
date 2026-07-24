"use client";

import { useActionState } from "react";
import { sendNotificationToUserAction } from "@/app/actions/push";
import type { FormState } from "@/app/actions/auth";

/** Envio de aviso do admin para um participante específico (in-app + push). */
export default function AdminDirectMessageForm({
  users,
}: {
  users: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    sendNotificationToUserAction,
    undefined
  );

  return (
    <div className="card">
      <div className="card-title">
        <h2>🎯 Enviar aviso para um participante</h2>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Envia uma mensagem <strong>só para a pessoa escolhida</strong> — no sininho 🔔 e como
        pop-up (para quem ativou). Não incomoda o resto do grupo.
      </p>
      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && <div className="form-success">{state.ok}</div>}
      <form action={formAction}>
        <div className="field">
          <label htmlFor="dm-user">Participante</label>
          <select id="dm-user" name="userId" defaultValue="" required>
            <option value="" disabled>
              Selecione o participante...
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <textarea
            name="message"
            rows={3}
            maxLength={500}
            required
            placeholder="Mensagem só para essa pessoa..."
          />
        </div>
        <button className="btn" disabled={pending}>
          {pending ? "Enviando..." : "Enviar para o participante"}
        </button>
      </form>
    </div>
  );
}
