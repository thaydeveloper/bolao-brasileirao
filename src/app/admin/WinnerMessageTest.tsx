"use client";

import { useActionState } from "react";
import {
  sendWinnerMessageTestAction,
  sendWinnerMessageToAllAction,
} from "@/app/actions/winnerMessage";
import type { FormState } from "@/app/actions/auth";
import WinnerMessageForm from "@/components/WinnerMessageForm";

export default function WinnerMessageTest({
  roundNumber,
  defaultMessage,
  deadlineLabel,
  maxLength,
  windowOpen,
}: {
  roundNumber: number;
  defaultMessage: string;
  deadlineLabel: string | null;
  maxLength: number;
  windowOpen: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    sendWinnerMessageTestAction,
    undefined
  );
  const [allState, allFormAction, allPending] = useActionState<FormState, FormData>(
    sendWinnerMessageToAllAction,
    undefined
  );

  return (
    <>
      <p className="muted">
        Rodada {roundNumber} ·{" "}
        {windowOpen ? (
          <>
            janela <strong>aberta</strong> ✅ — notificações saem 3×/dia (09h/14h/20h)
            {deadlineLabel && (
              <>
                {" "}
                até <strong>{deadlineLabel}</strong>
              </>
            )}
          </>
        ) : (
          <>
            janela <strong>fechada</strong> — a próxima rodada já começou, notificações pausadas
          </>
        )}
      </p>

      <WinnerMessageForm
        adminMode
        roundNumber={roundNumber}
        defaultMessage={defaultMessage}
        deadlineLabel={deadlineLabel}
        maxLength={maxLength}
      />

      <div className="winner-msg-form">
        <h3>🔔 Testar notificação</h3>
        <p className="muted">
          Envia o recado atual agora como notificação <strong>somente para você</strong> — os
          demais participantes não recebem nada. Pode repetir à vontade.
        </p>
        {state?.error && <div className="form-error">{state.error}</div>}
        {state?.ok && <div className="form-success">{state.ok}</div>}
        <form action={formAction}>
          <button className="btn btn-secondary" disabled={pending}>
            {pending ? "Enviando..." : "Enviar notificação de teste para mim"}
          </button>
        </form>
      </div>

      <div className="winner-msg-form">
        <h3>📣 Enviar para todos agora</h3>
        <p className="muted">
          Dispara o recado imediatamente para <strong>todos os participantes do bolão</strong>{" "}
          (incluindo você), a qualquer momento — ignora a janela e os horários programados.
          Cada clique gera um novo envio no sininho de todo mundo.
        </p>
        {allState?.error && <div className="form-error">{allState.error}</div>}
        {allState?.ok && <div className="form-success">{allState.ok}</div>}
        <form action={allFormAction}>
          <button className="btn" disabled={allPending}>
            {allPending ? "Enviando..." : "Enviar recado para todos agora"}
          </button>
        </form>
      </div>
    </>
  );
}
