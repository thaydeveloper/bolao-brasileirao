"use client";

import { useActionState } from "react";
import { sendAdminBroadcastAction, sendReminderTestToMeAction } from "@/app/actions/push";
import type { FormState } from "@/app/actions/auth";

export default function AdminBroadcastForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    sendAdminBroadcastAction,
    undefined
  );
  const [testState, testAction, testPending] = useActionState<FormState, FormData>(
    sendReminderTestToMeAction,
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

      <div className="winner-msg-form" style={{ marginTop: 16 }}>
        <h3>⏰ Testar lembrete de palpites (só pra você)</h3>
        <p className="muted">
          Envia o lembrete da rodada em andamento e da próxima <strong>para a sua conta</strong>,
          mesmo que você já tenha palpitado. Serve para conferir o pop-up.
        </p>
        {testState?.error && <div className="form-error">{testState.error}</div>}
        {testState?.ok && <div className="form-success">{testState.ok}</div>}
        <form action={testAction}>
          <button className="btn btn-secondary" disabled={testPending}>
            {testPending ? "Enviando..." : "Enviar lembrete de teste pra mim"}
          </button>
        </form>
      </div>
    </div>
  );
}
