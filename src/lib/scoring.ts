export type Placar = { home: number; away: number };

export const PONTOS = {
  PLACAR_EXATO: 40,
  VENCEDOR_E_GOLS: 15,
  EMPATE: 15,
  VENCEDOR_E_SALDO: 12,
  APENAS_VENCEDOR: 10,
  ERROU: 0,
} as const;

/**
 * Calcula a pontuação de um palpite conforme as regras do bolão:
 *  - Placar exato ........................... 40 pts
 *  - Vencedor + gols do vencedor ............ 15 pts
 *  - Acertou empate (placar diferente) ...... 15 pts
 *  - Vencedor + saldo de gols ............... 12 pts
 *  - Apenas vencedor ........................ 10 pts
 *  - Errou tudo ..............................  0 pts
 */
export function calcularPontos(palpite: Placar, resultado: Placar): number {
  if (palpite.home === resultado.home && palpite.away === resultado.away) {
    return PONTOS.PLACAR_EXATO;
  }

  const saldoPalpite = palpite.home - palpite.away;
  const saldoResultado = resultado.home - resultado.away;
  const vencedorPalpite = Math.sign(saldoPalpite);
  const vencedorResultado = Math.sign(saldoResultado);

  if (vencedorPalpite !== vencedorResultado) return PONTOS.ERROU;

  if (vencedorResultado === 0) return PONTOS.EMPATE;

  const golsVencedorPalpite = vencedorResultado > 0 ? palpite.home : palpite.away;
  const golsVencedorResultado = vencedorResultado > 0 ? resultado.home : resultado.away;

  if (golsVencedorPalpite === golsVencedorResultado) return PONTOS.VENCEDOR_E_GOLS;
  if (saldoPalpite === saldoResultado) return PONTOS.VENCEDOR_E_SALDO;
  return PONTOS.APENAS_VENCEDOR;
}
