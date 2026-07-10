"use client";

import { useActionState } from "react";
import { updateResultAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

type Props = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  defaultHome: number | null;
  defaultAway: number | null;
  defaultFinished: boolean;
};

export default function ResultForm(props: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateResultAction,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="matchId" value={props.matchId} />
      <div className="match-teams">
        <span className="team home">{props.homeTeam}</span>
        <div className="score-inputs">
          <input
            type="number"
            name="homeScore"
            min={0}
            max={99}
            required
            defaultValue={props.defaultHome ?? ""}
            aria-label="Gols do mandante"
          />
          <span>x</span>
          <input
            type="number"
            name="awayScore"
            min={0}
            max={99}
            required
            defaultValue={props.defaultAway ?? ""}
            aria-label="Gols do visitante"
          />
        </div>
        <span className="team away">{props.awayTeam}</span>
      </div>
      <div className="match-footer">
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            name="finished"
            defaultChecked={props.defaultFinished}
            style={{ width: "auto" }}
          />
          Partida encerrada (pontua os palpites)
        </label>
        <button className="btn btn-sm" disabled={pending}>
          {pending ? "Salvando..." : state && !state.error ? "✓ Salvo" : "Salvar resultado"}
        </button>
      </div>
      {state?.error && <div className="form-error" style={{ marginTop: 8 }}>{state.error}</div>}
    </form>
  );
}
