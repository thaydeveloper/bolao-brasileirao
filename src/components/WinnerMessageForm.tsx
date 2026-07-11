"use client";

import { useActionState } from "react";
import { saveWinnerMessageAction } from "@/app/actions/winnerMessage";
import type { FormState } from "@/app/actions/auth";

export default function WinnerMessageForm({
  roundNumber,
  defaultMessage,
  deadlineLabel,
  maxLength,
  adminMode = false,
}: {
  roundNumber: number;
  defaultMessage: string;
  deadlineLabel: string | null;
  maxLength: number;
  adminMode?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveWinnerMessageAction,
    undefined
  );

  return (
    <div className="winner-msg-form">
      <h3>
        {adminMode
          ? `🛠️ Recado da rodada ${roundNumber} (modo admin)`
          : `✍️ Seu recado de campeão da rodada ${roundNumber}`}
      </h3>
      {adminMode ? (
        <p className="muted">
          Escreva/edite o recado como se fosse o campeão, para testar. Ele aparece no dashboard de
          todos e é enviado <strong>3× por dia</strong> (09h/14h/20h) aos não-vencedores até a
          próxima rodada começar. Atenção: isto <strong>substitui</strong> o recado do vencedor, se
          já houver um.
        </p>
      ) : (
        <p className="muted">
          Você venceu! Deixe um recado que será enviado <strong>3× por dia</strong> aos demais
          participantes{" "}
          {deadlineLabel ? (
            <>
              até o início da próxima rodada (<strong>{deadlineLabel}</strong>).
            </>
          ) : (
            <>até a próxima rodada começar.</>
          )}
        </p>
      )}
      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && <div className="form-success">{state.ok}</div>}
      <form action={formAction}>
        <div className="field">
          <textarea
            name="message"
            rows={3}
            maxLength={maxLength}
            defaultValue={defaultMessage}
            placeholder="Ex.: Podem ir treinando os palpites, a taça continua comigo! 😎"
            required
          />
        </div>
        <button className="btn" disabled={pending}>
          {pending ? "Salvando..." : defaultMessage ? "Atualizar recado" : "Enviar recado"}
        </button>
      </form>
    </div>
  );
}
