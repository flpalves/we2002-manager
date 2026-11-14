# Times da Série C 2026 (gerados em 14/11/2026)

## No pacote do manager (`C:\Users\felip\OneDrive\Documentos\projetos\we2002-manager`)

- 20 arquivos novos em `pacotes/brasil-2026/times/`: AMZ (Amazonas), ANA (Anápolis), BAR (Barra-SC), BPB (Botafogo-PB), BRU (Brusque), CAX (Caxias), CON (Confiança), FER (Ferroviária), FIG (Figueirense), FLO (Floresta), GUA (Guarani), INL (Inter de Limeira), ITA (Itabaiana), ITU (Ituano), MAC (Maranhão), MGA (Maringá), PAY (Paysandu), STA (Santa Cruz), VRE (Volta Redonda), YPI (Ypiranga-RS).
- Competição nova `competicoes/serie-c.json`, com o formato real de 2026:
  - 1ª fase em turno único, 19 rodadas, e os 8 primeiros avançam.
  - Quadrangular com 2 grupos de 4, ida e volta, sorteio por potes.
  - Final em 2 jogos entre os líderes dos grupos, com pênaltis e sem gol fora.
- `divisoes.json` ganhou o degrau `serie-c` com `troca: 4`. Sobem os 2 primeiros de cada grupo do quadrangular (`criterio: grupo`, `fase: quad`). Descem os 4 últimos da B. Não há rebaixamento para a Série D no jogo (a D não existe no pacote).
- `temporada.json` ganhou o bloco `serie-c` (fds, semanas 14 a 44). Numa temporada simulada, a C ocupou as semanas 14 a 40, com 216 jogos (190 + 24 + 2).
- Fonte e gerador em `docs/we/elencos-serie-c-2026/`: `dados-ogol.json`, `coletar.py`, `kits.json`, `montar.py` e `LEIA-ME.md`. Para rodar: `python3 docs/we/elencos-serie-c-2026/montar.py pacotes/brasil-2026 [--forcar]`.

## Elencos e notas

- Elenco vem do ogol.com.br (temporada 2026). São 26 jogadores por time: 3 goleiros e os 23 de linha do elenco atual com mais minutos na Série C. Posição detalhada, pé, altura, nascimento, nacionalidade e camisa saíram da ficha de cada jogador.
- Notas pelo método do `montar.py` da Série B. A diferença é que o nível relativo de cada jogador vem dos minutos na Série C, não de ajuste à mão. A força do clube vem dos pontos na 1ª fase, com bônus para quem subiu ou foi à final. `AJUSTE = -0.2`.
- Média dos 11 melhores, de 7,84 a 6,39: MGA 7,84 · FER 7,80 · STA 7,68 · BRU 7,67 · PAY 7,57 · INL 7,52 · BPB 7,42 · FIG 7,39 · MAC 7,38 · YPI 7,33 · FLO 7,27 · GUA 7,24 · CAX 7,15 · AMZ 7,09 · ITU 6,88 · BAR 6,86 · VRE 6,75 · ANA 6,73 · CON 6,47 · ITA 6,39. Tudo abaixo da Série B (7,9 a 9,1).
- Formação automática: `4-3-3B` quando há pelo menos 3 pontas entre os 16 mais usados, senão `4-4-2B`. O Maringá só tem 1 lateral no elenco escolhido, então a 2ª vaga de lateral ficou com um jogador de outra posição.
- Posição secundária deduzida (CB→DH, SB→SH, DH→OH, OH→SH, WG→SH, CF→WG). Os goleiros ficam sem ela, o que dá 60 avisos `sem_posicao_secundaria`.

## Finanças e salários (supostos)

- Porte: médio para PAY, STA, GUA e FIG (torcida grande, ex-Série A). Pequeno para os outros 16.
- Médio: saldo R$ 5 mi, patrocínio R$ 10 mi por temporada, orçamento de folha R$ 1,5 mi/mês, ingresso R$ 30, custo por jogo R$ 80 mil.
- Pequeno: saldo R$ 2 mi, patrocínio R$ 4 mi, folha R$ 600 mil/mês, ingresso R$ 20, custo por jogo R$ 30 mil.
- Salário base: titular R$ 60 mil (médio) ou R$ 30 mil (pequeno); reserva R$ 20 mil ou R$ 12 mil. Os dois variam com os minutos jogados.
- Folha real: cerca de R$ 1,0 mi nos médios e R$ 510 a 550 mil nos pequenos, sempre abaixo do orçamento. Contratos vencem entre 2026 e 2030, espalhados por hash.
- Estádio e capacidade vêm da ficha do clube no ogol.

## Uniformes

- `kit`, `kit_reserva` e `kit_goleiro` no formato `kit.design`. São aproximações pelas cores do clube, a conferir no WE. O Santa Cruz usa faixas horizontais; Amazonas, Botafogo-PB, Figueirense, Inter de Limeira, Maringá, Maranhão e Paysandu usam listras verticais.
- Sem arte 4x: o `kits:desenhar` não rodou no Linux da sessão, porque o esbuild do `node_modules` é o do Windows. No Windows: `npm run kits:desenhar -- --time pacotes/brasil-2026/times/<SIG>.json`.

## Validação e testes

- `tools/validar-pacote.ts`: 20 erros, todos `escudo_faltando` dos times novos (precisam de PNG aprovado pelo Felipe). Nenhum erro de competição, divisão ou calendário. Os avisos novos são só os `sem_posicao_secundaria` dos goleiros.
- Vitest: todos passam, menos `tests/main/protocolo.test.ts`, que falha só no Linux (compara caminho de Windows).
- Uma temporada simulada com o pacote (3 sementes) rodou inteira, e o acesso C→B e o rebaixamento B→C saem certos.
- Para rodar no Linux da sessão: instalar `@esbuild/linux-x64@0.28.2` e `@rolldown/binding-linux-x64-gnu@1.2.19` fora do projeto e usar `ESBUILD_BINARY_PATH` e `NODE_PATH`.
