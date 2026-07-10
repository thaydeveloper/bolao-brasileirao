"use client";

import { useActionState } from "react";
import { savePredictionAction } from "@/app/actions/predictions";
import type { FormState } from "@/app/actions/auth";

type Props = {
  matchId: number;
  defaultHome: number | null;
  defaultAway: number | null;
};

export default function PredictionForm({ matchId, defaultHome, defaultAway }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    savePredictionAction,
    undefined
  );

  const saved = state !== undefined && !state?.error;

  return (
    <form action={formAction}>
      <input type="hidden" name="matchId" value={matchId} />
      <div className="predict-row">
        <div className="score-inputs">
          <input
            type="number"
            name="homeScore"
            min={0}
            max={99}
            required
            defaultValue={defaultHome ?? ""}
            aria-label="Gols do mandante"
          />
          <span>x</span>
          <input
            type="number"
            name="awayScore"
            min={0}
            max={99}
            required
            defaultValue={defaultAway ?? ""}
            aria-label="Gols do visitante"
          />
        </div>
        <button className="btn btn-sm" disabled={pending}>
          {pending ? "Salvando..." : saved ? "✓ Salvo" : "Salvar"}
        </button>
      </div>
      {state?.error && <div className="form-error" style={{ marginTop: 8 }}>{state.error}</div>}
    </form>
  );
}
