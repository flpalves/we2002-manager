# WE2002 Manager

Manager de futebol (estilo Brasfoot / Championship Manager 01/02 / Modo Carreira do FIFA) que usa o **Winning Eleven 2002 de PS1**, rodando no **PCSX-Redux**, como motor das partidas do usuário. O manager cuida de tudo fora de campo; o WE joga os 90 minutos quando o usuário quer. Os outros jogos são simulados por um **motor próprio**.

Projeto pessoal (hobby), só Windows, interface em pt-BR. A ISO e a BIOS não são distribuídas.

## Leia antes de mexer

| Assunto | Arquivo |
|---|---|
| Visão e escopo | `docs/spec/00-visao.md` |
| Arquitetura, stack, pastas, IPC | `docs/spec/01-arquitetura.md` |
| Pacote de dados e banco SQLite | `docs/spec/02-dados.md` |
| Calendário, competições, motor de fases | `docs/spec/03-competicoes-calendario.md` |
| Motor de partida e IA de técnico | `docs/spec/04-motor-partida.md` |
| Jogadores, condição, moral, treino, evolução | `docs/spec/05-jogadores-treino.md` |
| Mercado, finanças, estádio, diretoria | `docs/spec/06-mercado-financas-diretoria.md` |
| Integração com o WE2002 (ponte, RAM) | `docs/spec/07-integracao-we.md` |
| Interface, telas, design system, gamepad | `docs/spec/08-interface.md` |
| Notícias e eventos aleatórios | `docs/spec/09-noticias-eventos.md` e o catálogo `09b-catalogo-noticias.md` |
| Fases de entrega e critérios de aceite | `docs/roadmap.md` |
| Decisões ainda em aberto | `docs/decisoes-em-aberto.md` |

Referências da engenharia reversa: `docs/we/offsets-we2002.md`, `docs/we/aprendizados-we2002.md`, `docs/we/estados-base-we2002.md`, `docs/we/times-serie-a-2026.md`. Já existem no repositório (`offsets.md`, `APRENDIZADOS.md`) e no Projeto do Claude; na fase 0, reúna as versões mais recentes em `docs/we/`.

## Stack

- Electron + Vue 3 + Vite + **TypeScript (strict)**.
- Pinia (estado), Vue Router (telas).
- SQLite com `better-sqlite3`, **um arquivo `.sqlite` por carreira**.
- Zod para validar o pacote de dados e os JSON de troca com o emulador.
- Vitest para as regras de negócio (obrigatório). Sem testes de interface por enquanto.
- Emulador: **só PCSX-Redux**, com a ponte Lua que já existe em `bridge/`.

## Comandos

```bash
npm install
npm run dev          # Electron + Vite (electron-vite) em modo desenvolvimento
npm run test         # Vitest (regras de negócio)
npm run typecheck    # vue-tsc (renderer) + tsc (main, preload, core, testes)
npm run lint
npm run build        # instalador Windows (electron-builder)
npm run tokens       # regenera src/renderer/estilos/{tokens,bundle}.css de docs/design-system/
npm run pacote:gerar # gera pacotes/brasil-2026/ a partir de data/times (--forcar regrava os times)
npm run kits:desenhar -- --time vasco  # desenha os kits de um time pelo kit.design (estilos em src/core/we/estampas.ts)
npm run pacote:validar -- --time SIG   # valida o pacote como o editor (--pacote <id>); guia de time novo: docs/guia-agente-novo-time.md
```

- O `better-sqlite3` é compilado para o Electron (`postinstall`). Os testes do migrador usam o `node:sqlite` do Node por uma interface mínima (`BancoMigravel`).
- Migrações SQL entram no bundle do main via `import.meta.glob` (`src/main/db/conexao.ts`).
- O preload roda em sandbox: o `zod` vai embutido nele (ver `electron.vite.config.ts`).
- Teclado espelha o controle: setas, Enter (A), Esc (B), X, Y, Q/E (LB/RB), PageUp/PageDown (LT/RT), Espaço (START).

## Regras de ouro

1. **O núcleo do jogo é TypeScript puro** em `src/core/`: sem Electron, sem Vue, sem SQLite, sem `Date.now()`, sem `Math.random()`. Toda aleatoriedade vem do gerador com semente (`src/core/rng.ts`). Isso torna tudo testável e reproduzível.
2. **Toda regra de negócio tem teste no Vitest**: motor de fases, desempates, calendário, motor de partida (estatística em lote), conversão de atributos, condição, setas, moral, evolução, valor de mercado, negociação, finanças, diretoria.
3. **Números de calibragem ficam em dados**, não espalhados no código: `src/core/config/padroes.ts` com os valores padrão, sobrescrevíveis pelo `regras.json` do pacote.
4. **Limites do WE2002 são lei** na hora de montar a partida: 23 jogadores por time, nome com até 10 caracteres ASCII, camisa de 1 a 32, atributos de 3 bits (12 a 19 na tela), 8 posições (GK, CB, SB, DH, SH, OH, CF, WG). O manager pode ter mais detalhe; a conversão acontece só na saída para o WE.
5. **Nunca reescrever a lógica da ponte que já funciona sem necessidade.** A ponte Lua (`bridge/`), as ferramentas de kit e cheats (`tools/`) e os estados base (`states/`) continuam valendo. O manager novo conversa com eles pelos mesmos arquivos (`data/partida.json`, `data/resultado.json`). Ver `docs/spec/07-integracao-we.md`.
6. **Reaproveitar a lógica testada do app `campeonato/`** (escolha de controle, desinversão de mando, validação do resultado por `partida_id`, escolha automática de uniforme), portando para TypeScript com testes.
7. **Interface segue o design system WE2002** (`docs/design-system/`): classes `we-*`, tokens CSS, Chakra Petch + Barlow, sombra dura, cor do clube como acento. Ver `docs/spec/08-interface.md`.
8. **Gamepad funciona em toda tela.** Todo elemento interativo é alcançável e tem foco visível.

## Convenções

- Identificadores do domínio **em português, sem acento** (`jogador`, `partida`, `escolherControle`), como no código atual. Termos técnicos genéricos podem ficar em inglês (`repository`, `store`, `ipc`).
- Textos da interface em pt-BR, com termos do futebol brasileiro. Dinheiro sempre em centavos (inteiro) no banco e no núcleo; formatado como "R$ 48,2 mi" só na interface.
- Tempo do jogo em **semanas implícitas** (ver `03-competicoes-calendario.md`); nada usa data real.
- Migrações do SQLite numeradas em `src/main/db/migracoes/NNN_nome.sql`; o arquivo da carreira guarda a versão do esquema.
- Um commit por item do roadmap, com o teste junto.

## Ambiente do Felipe

- Projeto em `C:\Users\felip\OneDrive\Documentos\projetos\we2002-manager`, com o PCSX-Redux dentro dele em `emulador/pcsx-redux/` (fora do Git e do instalador).
- **Migração feita (12/11/2026)**: `bridge/`, `tools/`, `states/`, `data/`, `campeonato/`, `kits/`, `bandeiras/`, `run-pcsx.bat` e `docs/we/` vieram de `D:\we2002-manager` (sem os `.bak-*`, `dumps/` e o DuckStation). O emulador está em `emulador/pcsx-redux/` e a imagem em `emulador/we2002.cue`. O `run-pcsx.bat` aceita `WE_EMU` e `WE_ISO` (o app passa os caminhos das Configurações). `D:\` continua intacto como backup.
- **Carreiras fora do OneDrive**: a sincronização pode corromper o SQLite em modo WAL; por isso as carreiras ficam em `%APPDATA%` (ver `01-arquitetura.md`).
- Imagem do jogo: `we2002.bin` / `we2002.cue` (serial **SLPM-87056**). Todos os endereços de RAM valem só para ela.
- Caminhos do emulador, da imagem e dos estados ficam nas configurações do app, nunca fixos no código.
