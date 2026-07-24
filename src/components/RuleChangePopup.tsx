"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "bolao-regra-pagamento-r20";

/**
 * Aviso único (a partir da rodada 20) da mudança nas regras: vencedor E pagamento
 * passam a ser de quem faz mais pontos na rodada. Aparece ao entrar no app enquanto
 * a rodada 20 é a vigente e some depois que o usuário confirma (guardado no
 * localStorage). As demais rodadas não mostram o aviso.
 */
export default function RuleChangePopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) !== "1") setOpen(true);
  }, []);

  if (!open) return null;

  const close = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={close}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">📢 Mudança nas regras — rodada 20</h2>
        <p>A galera combinou uma regra nova, a partir desta rodada:</p>
        <ul className="modal-list">
          <li>
            🏆 <strong>Vencedor da rodada</strong> = quem fizer <strong>mais pontos</strong>.
          </li>
          <li>
            💸 <strong>O pagamento vai para o vencedor da rodada</strong> (quem mais pontuou).
          </li>
          <li>
            Acabou o pagamento <strong>por cravada</strong> e o de <strong>quem cravou mais</strong>.
          </li>
          <li>Empate na pontuação: o prêmio é dividido entre os vencedores.</li>
        </ul>
        <button type="button" className="btn btn-primary modal-ok" onClick={close}>
          Entendi
        </button>
      </div>
    </div>
  );
}
