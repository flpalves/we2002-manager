# 01 · Arquitetura

## Visão geral

```
┌──────────── Electron ────────────────────────────────────────────┐
│ renderer (Vue 3 + Pinia + Router)     preload (contextBridge)    │
│   telas, design system we-*   ◄──IPC tipado──►  window.api       │
│                                                                  │
│ main (Node)                                                      │
│   serviços de aplicação ──► src/core (TS puro, regras do jogo)   │
│   repositórios SQLite (better-sqlite3, 1 arquivo por carreira)   │
│   pacote de dados (leitura, validação Zod, importação)           │
│   ponte WE (gera partida.json, abre o .bat, observa resultado)   │
└──────────────────────────────────────────────────────────────────┘
            │ arquivos                          │ processo
            ▼                                   ▼
   data/partida.json  data/resultado.json   run-pcsx.bat → PCSX-Redux + bridge/*.lua
```

- **`src/core/`**: o jogo. Funções puras e classes sem efeitos colaterais: calendário, motor de fases, classificação e desempates, motor de partida, IA de técnico, condição, moral, setas, evolução, valor de mercado, negociação, IA de mercado, finanças, diretoria, notícias. Recebe estado, devolve novo estado + eventos. Sem acesso a disco, banco, relógio ou `Math.random`.
- **`src/main/`**: orquestração. Abre a carreira, carrega o estado necessário do SQLite, chama o núcleo, grava o resultado numa transação. Controla o emulador e o sistema de arquivos.
- **`src/renderer/`**: só apresentação e intenção do usuário. Nunca calcula regra de jogo; pede ao main.
- **`src/shared/`**: tipos e esquemas Zod compartilhados (DTOs do IPC, formatos de `partida.json`/`resultado.json`, formato do pacote).

## Pastas

```
src/
  core/
    rng.ts                 # gerador com semente (ex.: xoshiro128**), split por contexto
    config/padroes.ts      # números de calibragem padrão
    calendario/  competicoes/  partida/  jogadores/  mercado/  financas/  diretoria/  noticias/
    temporada/             # avanço de passo, virada de temporada
  main/
    janela.ts  ipc/  db/ (conexao.ts, migracoes/, repositorios/)  pacote/  we/ (ponte.ts, controle.ts, uniformes.ts)
    servicos/              # casos de uso: continuar(), jogarPartida(), enviarProposta()...
  preload/index.ts
  renderer/
    telas/  componentes/  stores/  estilos/ (tokens.css, bundle.css do design system)  gamepad/
  shared/  (tipos.ts, esquemas/)
tests/                     # espelha src/core
pacotes/brasil-2026/       # pacote de dados do Felipe (fora do instalador; caminho configurável)
bridge/  tools/  states/  run-pcsx.bat   # já existem; não mover sem necessidade
docs/
```

## Fluxo "Continuar"

1. Renderer chama `api.carreira.continuar()`.
2. Main carrega o estado do passo atual e chama `core.temporada.avancarAte(proximoJogoDoUsuario)`, que para antes se surgir um evento que exige decisão (proposta recebida, lesão grave, demissão, janela abrindo).
3. Para cada passo: calendário define os jogos; IA de técnico escala os times da CPU; motor simula; aplica condição, lesões, suspensões, moral, finanças, notícias, IA de mercado; tudo numa transação SQLite.
4. Ao chegar no jogo do usuário, o renderer abre o **pré-jogo**.

## IPC

- Um canal por caso de uso, tipado com Zod nas duas pontas (`shared/esquemas/ipc.ts`).
- Respostas sempre `{ ok: true, dados } | { ok: false, erro: { codigo, mensagem } }`.
- Operações longas (avançar várias semanas, importar pacote) mandam progresso por evento.

## Persistência

- Uma carreira = uma pasta `<pasta_carreiras>/<id>/` com `carreira.sqlite`, `autosave/` (as 3 últimas cópias, rotativas) e `resultados/`.
- `<pasta_carreiras>` padrão: `%APPDATA%/we2002-manager/carreiras` (via `app.getPath('userData')`), **alterável nas Configurações**. Ao trocar, o app oferece mover as carreiras existentes. Essa configuração fica num `config.json` em `userData`, fora de qualquer carreira.
- Motivo: o projeto fica no OneDrive, e a sincronização de um `.sqlite` aberto em modo WAL (com `-wal`/`-shm`) pode corromper o arquivo. O app avisa se a pasta escolhida estiver dentro do OneDrive.
- **Autosave a cada rodada** (depois de cada passo do calendário que tenha jogo do usuário) e ao confirmar resultado. Implementado em `src/main/carreira/autosave.ts`: cópia com `VACUUM INTO`, rotação `autosave-1..3.sqlite` (1 = mais nova) e `indice.json` com temporada, semana e motivo; também depois da virada. Restaurar (Salvar / Carreiras → Autosaves) guarda antes o estado atual em `autosave/antes-de-restaurar.sqlite`. O rodapé mostra o último autosave.
- Lista de carreiras: lida das pastas (metadados na tabela `carreira`).
- Modo WAL; tudo que muda o estado de um passo vai numa transação.

## Determinismo

- `carreira.semente` criada na nova carreira.
- Cada uso deriva um gerador: `rng.derivar('partida', partidaId)`, `rng.derivar('mercado', semana)`, etc. Mesma carreira + mesmas decisões = mesmos resultados.
- Teste de regressão: simular uma temporada inteira com semente fixa e comparar um resumo (campeões, artilheiro, saldo) com um "golden file". Implementado em `tests/main/golden.test.ts` (duas temporadas com virada, pacote de duas divisões); o arquivo é `tests/main/__golden__/duas-temporadas.json`. Mudança intencional: `npx vitest run tests/main/golden.test.ts -u` e conferir o diff.

## Desempenho

- Uma temporada completa (~60 times nacionais + ~60 estrangeiros, ~2.000 jogos) deve simular em menos de 30 s numa máquina comum. O motor de partida roda em lote no main; se precisar, num `worker_thread`.
