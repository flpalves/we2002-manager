# 08 · Interface

## Design system

- Fonte da verdade: **design system "WE2002 Manager"** (artefato https://claude.ai/artifact/BbHTsCyQRbYVQK44svX76y). Copiar para `docs/design-system/` o `README.md`, `tokens.json`, `components/bundle.css` e os `components/*/README.md`, e para `src/renderer/estilos/` o `bundle.css` + um `tokens.css` gerado do `tokens.json` (script `tools/gerar-tokens-css.mjs`).
- Mockups de referência das telas: canvas https://claude.ai/artifact/AV2Q1fbNPpXre9BU6a8rv3 (8 telas). Exportar cada tela como imagem para `docs/mockups/` e usar como alvo visual.
- Visual **retrô-moderno**: densidade de manager dos anos 2000, Chakra Petch (títulos, botões, números de destaque) + Barlow (texto e tabelas, números tabulares), botões chapados com **sombra dura deslocada**, cantos de 2-3px, sem gradientes.
- Componentes Vue finos sobre as classes `we-*`: `WeBotao`, `WePainel`, `WeTabela`, `WeTag`, `WeSeta`, `WeEscudo`, `WeTime` (escudo + nome), `WePlacar`, `WeNav`, `WeAtalhos`, `WeCampo` (campo da escalação).

## Temas e cor do clube

- Configurável: **Escuro** (padrão) ou **Claro**, sempre com a **cor do clube** nos detalhes (`--clube` = 1ª cor do time do usuário). Se o contraste com branco for < 4.5:1, `--sobre-clube` vira `#111111`.
- Barra superior e rodapé (`cromo`) escuros nos dois temas.

## Janela e controles

- Mínimo **1280 × 720**, redimensionável. Layout fluido (painéis em grade `auto-fit`).
- **Gamepad** (Gamepad API) em toda tela: D-pad/analógico movem o foco entre elementos focáveis (navegação espacial), A confirma, B volta, LB/RB trocam de seção do menu, LT/RT trocam abas, START = Continuar, Y/X = ações da tela. O rodapé **mostra os atalhos válidos** da tela atual. Teclado espelha os mesmos comandos.
- Foco sempre visível (`--foco`).

## Estrutura

- **Barra superior**: escudo e nome do clube, técnico, temporada/semana, saldo, movimentos de negociação restantes, status da janela, botão **CONTINUAR** (principal).
- **Menu lateral** (180px): Início, Elenco, Escalação, Treino, Calendário, Competições, Mercado, Finanças, Clube e diretoria, Notícias; no pé: Configurações, Salvar / Carreiras, Tela inicial.
- **Editor do pacote e carreira não se misturam** (`src/renderer/modos.ts`): o editor só abre pela tela inicial e sem carreira aberta. Se houver uma, ele pede para fechá-la (ela continua salva). No editor, o layout é próprio, sem menu lateral, sem barra da carreira e sem CONTINUAR; sai-se dele por "Sair do editor". As telas da carreira só abrem com carreira aberta, e o main recusa gravar no pacote enquanto houver uma (`carreira_aberta`).
- **Rodapé**: atalhos do controle + último autosave.

## Telas

| Tela | Conteúdo (ver mockups) |
|---|---|
| Início (painel) | próximo jogo (escudos, posições, últimos 5), resumo da tabela, estado do elenco (condição média, lesionados, suspensos, pendurados, contratos), notícias, diretoria e finanças |
| Elenco | tabela do elenco (até ~35): posição, idade, geral, condição, seta, moral, contrato, valor; ficha do jogador com atributos 1-20, faixa de potencial, histórico e **edição de aparência** |
| Escalação | campo com a formação do WE (troca de formação), seta e condição em cada jogador; convocação dos 23 (TIT/RES/FORA), sugestão automática |
| Pré-jogo | escolha do modo (WE, CPU x CPU, simular), o que vai para o emulador (vaga, controle, uniformes, formação, convocados, setas, `partida_id`), desfalques |
| No emulador | status da ponte, parcial ao vivo, saídas de falha |
| Pós-jogo | gols, substituições e minutos (lidos da RAM), cartões/lesões (registro manual opcional), estatísticas, confirmar ou descartar |
| Treino | 6 focos, efeitos do foco escolhido, condição e entrosamento, evolução recente |
| Calendário | lista de passos com jogos do usuário e das competições, datas vazias |
| Competições | abas por competição; pontos corridos (tabela completa com zonas, últimos 5, desempate), grupos, chave de mata-mata; artilharia; rodada |
| Mercado | busca com filtros; lista com escudo do clube; negociação (clube que vende → compra, histórico, contador de 5 movimentos); propostas recebidas |
| Finanças | resumo (saldo, folha x orçamento), receitas/despesas por categoria, estádio (preço do ingresso → público e bilheteria estimados), extrato |
| Clube e diretoria | metas, confiança, histórico de temporadas |
| Notícias | caixa com filtros por tipo |
| Editor do pacote | abas Times / Uniformes / Jogadores / Sem clube / Competições, formulários, painel de validação. Sem clube: listas Exterior (`exterior.json`, com clube/país de origem e taxa fixa) e Livres (`livres.json`, sem taxa), com criar, editar, remover e mover entre as duas; lista vazia apaga o arquivo. Uniformes: modelo (`src/core/we/modelosUniforme.ts`), cores, prévia ao vivo (jogador e textura) e "Confirmar e gerar", que grava `kits/desenhos/<sigla>[_reserva|_goleiro]_4x.png` e o `design` no time |
| Carreiras | nova carreira (pacote, clube de qualquer série, nome do técnico, dificuldade), carregar, apagar |
| Configurações | tema, caminhos do PCSX-Redux / imagem / estados, intensidade da IA de mercado, autosave |

## Regras de interface

- **Escudo ao lado de todo nome de time** (tamanho pequeno em listas, grande em destaques).
- Cores com significado fixo: positivo, atenção, negativo, info, diretoria. A informação nunca depende só da cor (texto, ícone ou direção da seta junto).
- Números alinhados (tabular); dinheiro como "R$ 48,2 mi" / "R$ 850 mil".
- Botão principal (cor do clube) **uma vez por tela**.
- Textos em pt-BR, verbos nos botões, sem emoji.
