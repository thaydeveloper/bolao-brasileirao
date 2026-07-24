import CopyButton from "./CopyButton";
import type { RoundRankingEntry } from "@/lib/ranking";

function cravadasLabel(n: number): string {
  return `${n} ${n > 1 ? "cravadas" : "cravada"}`;
}

function PixRow({ entry, suffix }: { entry: RoundRankingEntry; suffix?: string }) {
  const { user } = entry;
  if (!user.pixKey) {
    return (
      <p className="muted">
        {user.name}
        {suffix ? ` (${suffix})` : ""} ainda não cadastrou a chave PIX.
      </p>
    );
  }
  return (
    <div className="pix-box">
      <div>
        <div className="muted">
          PIX de {user.name}
          {suffix ? ` · ${suffix}` : ""} {user.pixKeyType ? `(${user.pixKeyType})` : ""}
        </div>
        <div className="pix-key">{user.pixKey}</div>
      </div>
      <CopyButton value={user.pixKey} />
    </div>
  );
}

/**
 * Bloco de PAGAMENTO da rodada (chaves PIX de quem recebe). O troféu (mais pontos)
 * é renderizado à parte por quem usa este componente.
 *
 * - payPerCravada (rodada >= 20): recebem TODOS que cravaram; sem cravadas, ninguém.
 * - caso contrário: quem cravou MAIS (empate divide); sem cravadas, o vencedor em pontos.
 */
export default function RoundPayout({
  payees,
  payPerCravada,
}: {
  payees: RoundRankingEntry[];
  payPerCravada: boolean;
}) {
  if (payPerCravada) {
    return (
      <div className="payout">
        <h3 className="payout-title">💸 Pagamento — por cravada</h3>
        {payees.length === 0 ? (
          <p className="muted">Ninguém cravou nesta rodada — sem pagamento.</p>
        ) : (
          <>
            <p className="muted">Recebe quem cravou pelo menos um placar exato:</p>
            {payees.map((p) => (
              <PixRow key={p.user.id} entry={p} suffix={cravadasLabel(p.exactCount)} />
            ))}
          </>
        )}
      </div>
    );
  }

  if (payees.length === 0) return null;
  const cravou = payees[0].exactCount > 0;
  return (
    <div className="payout">
      <h3 className="payout-title">
        💸 Pagamento —{" "}
        {cravou
          ? `quem cravou mais (${cravadasLabel(payees[0].exactCount)})`
          : "ninguém cravou; vai para o vencedor em pontos"}
      </h3>
      <p className="muted">
        Recebe: <strong>{payees.map((p) => p.user.name).join(" e ")}</strong>
        {payees.length > 1 && " — prêmio dividido entre os empatados"}
      </p>
      {payees.map((p) => (
        <PixRow key={p.user.id} entry={p} />
      ))}
    </div>
  );
}
