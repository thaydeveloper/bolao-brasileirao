# ⚽ Bolão Brasileirão

Aplicativo web de bolão do Campeonato Brasileiro para um grupo fechado de até **8 participantes**. Palpites por partida com bloqueio automático no horário do jogo, pontuação calculada automaticamente, rankings por rodada e geral, notificações de lembrete e exibição da chave PIX do vencedor da rodada.

## Stack

- **Next.js 15** (App Router, Server Components + Server Actions)
- **TypeScript**
- **Prisma + SQLite** (troque o `datasource` para Postgres/MySQL quando quiser escalar)
- Autenticação por **cookie JWT httpOnly** (`jose` + `bcryptjs`)
- CSS puro (sem dependência de framework de UI)

## Como rodar

```bash
pnpm install
pnpm run db:push     # cria o banco SQLite (prisma/dev.db)
pnpm run db:seed     # dados de exemplo: 8 jogadores + 2 rodadas
pnpm dev             # http://localhost:3000  (use -p 3100 se a porta estiver ocupada)
```

### Logins de teste (senha `123456`)

| Email | Papel |
| --- | --- |
| `admin@bolao.dev` | Administrador |
| `joao@bolao.dev`, `pedro@bolao.dev`, `lucas@bolao.dev`, `marcos@bolao.dev`, `rafael@bolao.dev`, `bruno@bolao.dev`, `andre@bolao.dev` | Jogadores |

> Em um banco zerado, **o primeiro usuário cadastrado vira administrador** automaticamente. O cadastro fecha ao atingir 8 participantes.

### Testes

```bash
pnpm test   # testes das 5 regras de pontuação (node:test)
```

## Regras de pontuação

| Critério | Pontos |
| --- | --- |
| Placar exato | **+40** |
| Acertou vencedor + gols do vencedor | **+15** |
| Acertou empate (placar diferente) | **+15** |
| Acertou vencedor + saldo de gols | **+12** |
| Acertou apenas o vencedor | **+10** |
| Errou tudo | **0** |

Implementadas em [`src/lib/scoring.ts`](src/lib/scoring.ts) e cobertas por [`tests/scoring.test.ts`](tests/scoring.test.ts). A precedência é: exato → gols do vencedor → saldo → vencedor.

## Funcionamento

- **Palpites** — editáveis quantas vezes quiser até o **início de cada partida** (bloqueio individual por jogo, validado no servidor em `savePredictionAction`). Os palpites dos demais jogadores só ficam visíveis depois que a partida começa.
- **Resultados** — o admin registra o placar oficial em **Admin → Resultados**; os pontos de todos os palpites daquele jogo são recalculados na hora. Há botão de **reprocessar** a rodada inteira.
- **Vencedor da rodada** — quando todos os jogos terminam, o(s) vencedor(es) aparecem no dashboard e na página da rodada com a **chave PIX** para cópia (empate = prêmio dividido).
- **Rankings** — por rodada e geral (pontos, vitórias em rodadas, placares exatos e aproveitamento), recalculados a cada resultado.
- **Notificações (sininho 🔔)** —
  - lembrete ~30 min antes do primeiro jogo para quem não completou os palpites;
  - lembrete ~30 min antes de cada jogo sem palpite;
  - aviso quando a pontuação da rodada é atualizada;
  - aviso quando alguém assume a liderança geral.

### Agendamento dos lembretes

A verificação é **idempotente** (dedupe por usuário + evento). Ela roda automaticamente a cada carregamento do dashboard e também pode ser agendada externamente:

```
GET /api/cron/reminders?secret=<CRON_SECRET>
```

Agende a cada 5–10 minutos (Vercel Cron, Agendador de Tarefas do Windows, GitHub Actions...). O segredo fica no `.env`.

## Dados reais do Brasileirão (API de futebol)

O app integra com a **[football-data.org](https://www.football-data.org)** (competição `BSA` = Brasileirão Série A) para trazer **jogos, datas, escudos dos times, placares oficiais e a tabela de classificação** — tudo real.

1. Cadastre-se grátis em https://www.football-data.org/client/register (recebe o token por email).
2. Cole o token no `.env`:
   ```
   FOOTBALL_DATA_TOKEN="seu_token_aqui"
   ```
3. Reinicie o servidor. No menu **Admin → Importar rodadas do Brasileirão**, clique em **Importar agora**.

A importação é **idempotente** (sincroniza cada partida pelo id externo): pode rodar quantas vezes quiser que atualiza datas e placares sem duplicar jogos. Placares já encerrados são importados e os palpites existentes são repontuados automaticamente.

- **Tabela** (`/tabela`) — classificação oficial com escudos, saldo de gols e as zonas de Libertadores/Sul-Americana/rebaixamento. Fica em cache por 1h para respeitar o limite gratuito (10 req/min).
- Sem token configurado, o app continua funcionando normalmente com rodadas criadas manualmente; a Tabela e a importação apenas exibem instruções de configuração.
- O plano gratuito cobre a Série A do Brasil. A lógica de mapeamento da API é testada em [`tests/football.test.ts`](tests/football.test.ts).

## Administração

Menu **Admin** (só para administradores):

- **Importar rodadas do Brasileirão** — puxa as partidas reais da API (ver seção acima).
- **Nova rodada** — cadastro manual: uma partida por linha `Mandante; Visitante; AAAA-MM-DD HH:MM` (horário de Brasília).
- **Resultados** — registrar/editar placares oficiais e marcar partidas como encerradas.
- **Reprocessar pontuação** e **cancelar/excluir rodada** para casos excepcionais.
- **Participantes** — remover membros do bolão.

## Estrutura

```
prisma/schema.prisma        # User, Group, GroupMember, Round, Match, Prediction, Notification
prisma/seed.ts              # dados de demonstração
src/lib/scoring.ts          # regras de pontuação
src/lib/ranking.ts          # ranking da rodada e geral
src/lib/rounds.ts           # status da rodada, bloqueio de palpite, formatação de datas
src/lib/notifications.ts    # lembretes e avisos (idempotentes)
src/lib/auth.ts             # sessão JWT + bcrypt
src/middleware.ts           # proteção de rotas
src/app/actions/            # server actions (auth, palpites, perfil, admin)
src/app/                    # páginas: dashboard, rodadas, ranking, perfil, admin
src/app/api/cron/reminders  # endpoint para agendadores externos
```

## Variáveis de ambiente (`.env`)

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | conexão do Prisma (padrão: SQLite local) |
| `AUTH_SECRET` | segredo do JWT de sessão — **troque em produção** |
| `CRON_SECRET` | protege o endpoint de lembretes |
| `FOOTBALL_DATA_TOKEN` | token grátis da football-data.org para importar jogos/tabela reais do Brasileirão |

## Próximos passos sugeridos

- Integração com API de futebol (ex.: API-Football) para importar rodadas e resultados automaticamente.
- Push notifications reais (Web Push) além do sininho in-app.
- Múltiplos bolões por usuário (o schema já tem `Group`/`GroupMember`).
- Migrar o banco para Postgres ao publicar (Vercel/Railway/Fly).
