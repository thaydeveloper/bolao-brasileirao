import { requireUser } from "@/lib/auth";
import { PONTOS } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type Regra = {
  pontos: number;
  titulo: string;
  descricao: string;
  cor: string;
  exemplo?: { palpite: string; resultado: string };
};

const REGRAS: Regra[] = [
  {
    pontos: PONTOS.PLACAR_EXATO,
    titulo: "Placar exato",
    descricao: "Você acertou o número de gols dos dois times.",
    cor: "badge-green",
    exemplo: { palpite: "Flamengo 2 x 1 Palmeiras", resultado: "Flamengo 2 x 1 Palmeiras" },
  },
  {
    pontos: PONTOS.VENCEDOR_E_GOLS,
    titulo: "Vencedor + gols do vencedor",
    descricao: "Acertou quem ganhou e quantos gols o vencedor fez (errou só os gols do perdedor).",
    cor: "badge-blue",
    exemplo: { palpite: "Flamengo 2 x 1 Palmeiras", resultado: "Flamengo 2 x 0 Palmeiras" },
  },
  {
    pontos: PONTOS.EMPATE,
    titulo: "Acertou o empate",
    descricao: "Você previu empate e o jogo terminou empatado, mesmo com placar diferente.",
    cor: "badge-blue",
    exemplo: { palpite: "2 x 2", resultado: "1 x 1" },
  },
  {
    pontos: PONTOS.VENCEDOR_E_SALDO,
    titulo: "Vencedor + saldo de gols",
    descricao: "Acertou quem ganhou e a diferença de gols, mas não o placar exato.",
    cor: "badge-yellow",
    exemplo: { palpite: "Flamengo 2 x 1 Palmeiras", resultado: "Flamengo 1 x 0 Palmeiras" },
  },
  {
    pontos: PONTOS.APENAS_VENCEDOR,
    titulo: "Apenas o vencedor",
    descricao: "Acertou só quem ganhou — errou os gols e o saldo.",
    cor: "badge-yellow",
    exemplo: { palpite: "Flamengo 2 x 0 Palmeiras", resultado: "Flamengo 3 x 2 Palmeiras" },
  },
  {
    pontos: PONTOS.ERROU,
    titulo: "Errou tudo",
    descricao: "Não acertou o vencedor nem o empate.",
    cor: "badge-red",
    exemplo: { palpite: "Flamengo 2 x 1 Palmeiras", resultado: "Flamengo 1 x 2 Palmeiras" },
  },
];

export default async function RegrasPage() {
  await requireUser();

  return (
    <main>
      <div className="section-header">
        <div>
          <h1>Regras do Bolão</h1>
          <p className="muted">Como funciona a pontuação e quem vence a rodada.</p>
        </div>
      </div>

      <div className="card">
        <h2>Sistema de pontuação</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Cada palpite vale pontos conforme o quanto você acertou. Sempre conta a regra de
          maior valor.
        </p>

        <div className="rules-grid">
          {REGRAS.map((r) => (
            <div className="rule-card" key={r.titulo}>
              <div className="rule-head">
                <span className={`badge ${r.cor} rule-points`}>+{r.pontos} pts</span>
                <strong>{r.titulo}</strong>
              </div>
              <p className="muted">{r.descricao}</p>
              {r.exemplo && (
                <div className="rule-example">
                  <div>
                    <span className="rule-example-label">Seu palpite</span>
                    <span className="rule-example-value">{r.exemplo.palpite}</span>
                  </div>
                  <span className="rule-arrow">→</span>
                  <div>
                    <span className="rule-example-label">Resultado</span>
                    <span className="rule-example-value">{r.exemplo.resultado}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Como funciona</h2>
        <ul className="rules-list">
          <li>
            <strong>Palpites por jogo.</strong> Você palpita o placar de cada partida da rodada e
            pode editar quantas vezes quiser <em>até o horário de início de cada jogo</em>. Quando a
            partida começa, o palpite é bloqueado automaticamente. 🔒
          </li>
          <li>
            <strong>Bloqueio individual.</strong> Cada jogo trava no seu próprio horário — você não
            perde a rodada inteira se esquecer um jogo.
          </li>
          <li>
            <strong>Pontuação automática.</strong> Assim que o resultado oficial é registrado, seus
            pontos são calculados na hora e os rankings são atualizados.
          </li>
          <li>
            <strong>Vencedor da rodada.</strong> O troféu 🏆 vai para quem fizer{" "}
            <strong>mais pontos</strong> na rodada.
          </li>
          <li>
            <strong>Pagamento via PIX.</strong> Quem <strong>recebe</strong> é quem{" "}
            <strong>cravar mais placares exatos</strong> na rodada (pode ser diferente do vencedor
            em pontos). Empate no nº de cravadas: prêmio <strong>dividido</strong>. Se ninguém
            cravar nenhum placar exato, o pagamento vai para o vencedor em pontos. Ao fim da rodada,
            a chave PIX de quem recebe aparece para os demais copiarem e pagarem por fora do app.
          </li>
          <li>
            <strong>Ranking geral.</strong> Soma os pontos de todas as rodadas. Desempate: mais
            vitórias em rodadas, depois mais placares exatos.
          </li>
        </ul>
      </div>
    </main>
  );
}
