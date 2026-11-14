# Roadmap

Decisão: **a primeira temporada só é jogada com tudo pronto**. As fases abaixo organizam o trabalho e têm critérios de aceite próprios; elas não são lançamentos separados. Duas **trilhas paralelas** (engenharia reversa e dados) andam junto e não bloqueiam o código até a fase 9.

## Fase 0 · Fundação
- Migrar de `D:\we2002-manager` para a pasta do projeto: `bridge/`, `tools/`, `states/`, `data/`, `campeonato/`, `run-pcsx.bat`, `docs/we/`; PCSX-Redux em `emulador/pcsx-redux/` (no `.gitignore`); remover caminhos fixos em `D:\`.
- Projeto Electron + Vue 3 + Vite + TS strict, Pinia, Router, Vitest, ESLint, electron-builder.
- `src/core/rng.ts` com semente e derivação; `padroes.ts`.
- SQLite por carreira, migrações, transações; IPC tipado com Zod.
- Estilos do design system (`tokens.css`, `bundle.css`), componentes `We*` básicos, layout com barra superior, menu e rodapé; tema claro/escuro; navegação por gamepad.
- **Aceite**: app abre, troca de tema e de tela pelo gamepad; `npm run test` e `typecheck` passam.

## Fase 1 · Pacote de dados e editor
- Esquemas Zod do pacote; importação dos `data/times/*.json` atuais (conversão 12-19 → 1-20).
- Validação (erros/avisos). Editor: Times, Jogadores (incl. aparência), Competições.
- Nova carreira (pacote, clube, técnico, dificuldade) → importa para o SQLite.
- **Aceite**: criar carreira a partir do pacote; validação acusa escudo faltando e time com número errado de jogadores.

## Fase 2 · Competições e calendário
- Motor de fases (pontos corridos, grupos, mata-mata), desempates configuráveis, zonas, saídas (acesso, vagas).
- Calendário intercalado com passos e semanas implícitas, datas vazias.
- Suspensões por competição. Sorteio de estrangeiros e de grupos.
- **Aceite**: temporada completa gerada sem conflito; testes de desempate cobrindo cada critério; mata-mata sempre com vencedor.

## Fase 3 · Motor de partida e IA de técnico
- Motor lance a lance; prorrogação e pênaltis; cartões, lesões; substituições da IA; escalação e convocação automática.
- **Aceite**: teste em lote (10.000 jogos) dentro das faixas de calibração de `04-motor-partida.md`; mesma semente = mesmo resultado.

## Fase 4 · Jogadores e treino
- Condição (gasto, recuperação por dia implícito), setas, moral, entrosamento, treino (6 focos), evolução e declínio, potencial em faixa, lesões.
- **Aceite**: testes de cada fórmula; jogador sem jogar recupera em datas vazias; foco Tático sobe entrosamento.

## Fase 5 · Integração com o WE
- Port de `escolherControle`, desinversão, validação por `partida_id`, uniformes; geração do `partida.json` v2; watcher do `resultado.json`; telas Pré-jogo / No emulador / Pós-jogo; fallbacks.
- **Aceite**: uma partida real no PCSX-Redux sai do pré-jogo e volta confirmada para a carreira, com o usuário como mandante e como visitante.

## Fase 6 · Mercado, finanças, estádio, diretoria
- Janelas, negociação com 5 movimentos, valor de mercado, IA de mercado, propostas recebidas, empréstimos, livres, renovações, multa.
- Receitas/despesas, extrato, saldo negativo, público e ingresso.
- Metas, confiança, demissão e escolha de novo clube.
- **Aceite**: temporada simulada com IA de mercado ativa sem saldo absurdo (nenhum clube com folha > 3× o orçamento); negociação respeita o limite de movimentos.

## Fase 7 · Notícias e eventos
- Motor de eventos (`09-noticias-eventos.md`) + catálogo (`09b`, a especificar).
- **Aceite**: eventos com escolha interrompem o Continuar; efeitos auditáveis.

## Fase 8 · Interface completa
- Todas as telas de `08-interface.md` no visual dos mockups, escudo ao lado de todo time, atalhos do gamepad por tela.
- **Aceite**: jogar uma rodada inteira só com o gamepad.

## Fase 9 · Temporada de ponta a ponta
- Virada de temporada (relatório, premiação, contratos, acesso/rebaixamento, sorteios, metas).
- Autosave por rodada; várias carreiras.
- **Aceite**: duas temporadas seguidas simuladas sem erro (golden file da semente de teste); uma temporada jogada com partidas do usuário no WE.

### 9.1 · Mercado da CPU com intenção (`06`, "IA de mercado")
- Perfil financeiro do clube; plano de janela (chegadas pelas carências, saídas e perfil); lista de venda com motivo (excedente, financeiro, empréstimo, usuário); saídas de quem perde espaço; empréstimos entre clubes da CPU.
- Propostas pelos jogadores do usuário por interesse real, com volume pela atratividade do elenco e contraproposta em 1 rodada.
- **Aceite** (teste em lote): na janela principal, média de 3 a 5 chegadas por clube; nas outras, de 0 a 3; quem perde muitos jogadores repõe um número parecido; ricos contratam geral maior; clubes em crise reduzem a folha; de 1 a 10 propostas por janela pelo usuário, crescendo com a qualidade do elenco.

## Trilha paralela A · Engenharia reversa (antes da fase 9)
1. Substituições e minutos jogados.
2. Escrita das setas de condição.
3. Lista de formações do WE e escrita da formação.
4. (depois da v1) Cartões e lesões por jogador; atribuição de controles.

## Trilha paralela B · Dados
- Elencos, kits, escudos e finanças: Séries B, C e D, times dos estaduais/regionais, estrangeiros por país.
- Formatos das competições no motor de fases (Série C, D, estaduais, regionais, continentais).
- Tabela de conversão 1-20 → WE e pesos do geral por posição.
- Catálogo de notícias (`09b`).
