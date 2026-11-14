# WE2002 Manager: contexto do projeto

## Visão geral
Jogo de gerenciamento de futebol (elencos, transferências, campeonatos, treinos) que usa o **Winning Eleven 2002 (PS1)**, rodando em emulador, como **motor de partida**. O manager cuida de tudo fora de campo; o WE2002 joga os 90 minutos.

Projeto pessoal / hobby. A ISO e a BIOS não são distribuídas: o usuário fornece a própria cópia.

## Arquitetura
1. Manager gera `partida.json` (times, elencos, escalação, tática, estádio, uniformes).
2. Manager abre o emulador com o jogo.
3. Injeção na RAM: IDs dos times, structs dos jogadores e parâmetros de uniforme. A partida começa direto, sem menus.
4. No apito final, leitura da RAM: placar, gols, cartões, lesões e estatísticas, gravados em `resultado.json`.
5. Emulador fecha; o manager atualiza a carreira.

## Stack planejada
- **Manager:** HTML/CSS/JS com Vue + Vite, empacotado com Electron (fase 1). Tauri é uma opção posterior, mais leve.
- **Persistência:** SQLite (`better-sqlite3` no Electron).
- **Ponte com o jogo:**
  - Fase 1: emulador externo (PCSX-Redux ou BizHawk) + script Lua + troca de JSON.
  - Fase 2: RetroArch com comandos UDP (porta 55355, `READ_CORE_MEMORY` / `WRITE_CORE_MEMORY`), com a lógica toda em JS/TS. Validar antes se o core de PS1 escolhido aceita escrita.
  - Fase 3 (opcional): core libretro embutido no app.
- **Visual:** DuckStation com perfil próprio (resolução interna alta, PGXP, true color, widescreen hack, texture replacement).

## Engenharia reversa: o que mapear
- **Estado do jogo:** byte que indica tela/fase (seleção, loading, partida, fim de jogo).
- **IDs dos times** (casa/visitante) e a janela certa de escrita (antes de o jogo ler os IDs para carregar os assets). Usar breakpoints de leitura/escrita no PCSX-Redux.
- **Struct do jogador:** tamanho (stride) e offsets de nome (charset Shift-JIS ou tabela própria, tamanho fixo), número, posição, atributos, habilidades (bitflags), pé, aparência.
- **Base mestre vs. buffer da partida:** preferir escrever na base mestre antes do loading.
- **Uniformes:** parâmetros de modelo e cor (paleta limitada) em RAM. Kits totalmente custom via texture replacement do DuckStation (PNG por hash). Escudos seguem a mesma lógica.
- **Resultado:** placar, autores dos gols, cartões, lesões e estatísticas no fim da partida. Detectar prorrogação e pênaltis.

## Limitações conhecidas
- Número de jogadores por time, faixas de atributos e aparências são fixos no WE2002.
- Elementos 2D (HUD, fontes) não ganham com upscaling; só com substituição de textura.
- Aumentar polígonos não é viável: a GPU do PS1 recebe triângulos 2D já projetados, e o jogo está preso a 2 MB de RAM e 1 MB de VRAM. Alternativa se o gráfico virar prioridade: PES de PS2 no PCSX2, com a mesma arquitetura.
- Partidas não jogadas: CPU vs CPU acelerado ou simulador estatístico próprio.
- Se o projeto ficar público: usar nomes, escudos e patrocínios fictícios.

## Roadmap inicial
1. Prova de conceito: script Lua que lê um JSON e inicia um amistoso A x B.
2. Mapear a struct de jogador e injetar elencos.
3. Ler o resultado da RAM e gravar `resultado.json`.
4. Primeiro esqueleto do manager (Electron + Vue) fechando o ciclo.
5. Uniformes (parâmetros, depois texturas).
6. Migrar a ponte para RetroArch UDP.
