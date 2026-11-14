# WE2002 Manager

Visual **retrô-moderno** do WE2002 Manager: a densidade de um manager dos anos 2000 (Brasfoot, Championship Manager 01/02) com acabamento atual e sotaque de HUD de videogame de PS1/PS2. Telas cheias de tabelas, números alinhados, botões chapados com sombra dura. Nada de gradientes, vidro ou cantos muito arredondados.

## Princípios

- **Densidade primeiro.** O usuário compara números o tempo todo: tabelas com linhas de 13px, zebra discreta, números tabulares. Cabe muita coisa numa tela de 1280x720.
- **Angular, não arredondado.** Cantos de 2-3px (`radius-sm`, `radius-md`). Nenhum elemento em pílula, exceto o círculo do número do jogador no campo (`radius-round`).
- **Sombra dura, nunca desfocada.** Botões usam `sombra-botao` (3px 3px 0); painéis usam `sombra-painel` (0 2px 0). Sem blur.
- **O clube é o acento.** `clube` é a única cor forte de identidade e muda conforme o clube da carreira. Use-a com parcimônia: botão principal (uma vez por tela), cabeçalho do painel mais importante, item ativo do menu, filete da barra superior.
- **Gamepad é cidadão de primeira classe.** Todo elemento interativo tem foco visível (`foco`, 2px com 2px de folga). O rodapé mostra os atalhos do controle (`we-kb`).
- **Cores com significado.** `positivo`, `atencao`, `negativo`, `info` e `diretoria` sempre querem dizer a mesma coisa. Nunca use uma delas só para enfeitar.

## Tipografia

Duas famílias do Google Fonts:

- **Chakra Petch** (`display`): títulos, nome do clube, cabeçalhos de painel e de tabela (MAIÚSCULAS, espaçamento 0,08-0,12em), botões (MAIÚSCULAS, 0,08em), valores em destaque, placar e teclas de atalho. É angular e técnica, lembra o HUD do WE.
- **Barlow** (`sans`): texto corrido, células de tabela, rótulos. Sempre com `font-variant-numeric: tabular-nums` em tabelas e placares, para os números ficarem em coluna.

Rótulos (`rotulo`, 11px) ficam em MAIÚSCULAS com espaçamento 0,06em e cor `texto-suave`.

## Temas

Dois temas, escolhidos nas configurações: **Escuro** (padrão) e **Claro**. Nos dois, a cor do clube aparece nos detalhes. A barra superior e o rodapé (`cromo`) ficam escuros nos dois temas, como a moldura de um console.

A cor `clube` é injetada em tempo de execução (variável CSS `--clube`). Se a cor do clube for clara demais para texto branco (contraste < 4.5:1), o app troca `--sobre-clube` para `#111111`.

## Setas de condição (do WE)

O manager reproduz as cinco setas de condição do Winning Eleven, calculadas pela condição física + moral:

| Seta | Token | Direção |
|---|---|---|
| Ótima | `seta-otima` | para cima (0°) |
| Boa | `seta-boa` | diagonal para cima (45°) |
| Normal | `seta-normal` | horizontal (90°) |
| Ruim | `seta-ruim` | diagonal para baixo (135°) |
| Péssima | `seta-pessima` | para baixo (180°) |

A **direção** carrega o significado (não só a cor), então dá para ler mesmo sem distinguir as cores. Sempre com contorno preto de 0,8px e `aria-label` com o nome da seta.

## Componentes

Estilos em `components/bundle.css` (classes `we-*`), sem JavaScript. O app em Vue implementa componentes com essas mesmas classes.

- **we-btn**: padrão, `we-btn--principal` (cor do clube, uma vez por tela), `we-btn--ativo` (opção selecionada num grupo, ex.: formação), `we-btn--opcao` (escolha grande com subtítulo, ex.: pré-jogo).
- **we-panel** com **we-panel__head** (`--clube` para o painel principal da tela) e **we-panel__body**.
- **we-table**: tabela densa com zebra e cabeçalho em MAIÚSCULAS.
- **we-tag**: etiqueta curta de situação (TIT, RES, FORA, LESÃO, PROPOSTA…).
- **we-seta**: seta de condição do WE.
- **we-nav**: item do menu lateral; `aria-current="page"` marca o ativo.
- **we-kb**: tecla do controle no rodapé de atalhos.
- **we-placar**: placar digital.
- **we-escudo**: escudo do time, ao lado de **todo** nome de time (tabelas, rodadas, chaves, mercado, propostas). Tamanhos `--p` (20px, listas), `--g` (44px, destaques) e padrão (56px, placar). PNG obrigatório no pacote; `--provisorio` mostra cor + sigla enquanto falta.

## Linguagem

Português do Brasil, termos do futebol brasileiro: "Escalação", "Convocação", "Pendurado", "Mando de campo", "Rodada". Botões em MAIÚSCULAS e com verbo: "CONTINUAR", "CONFIRMAR RESULTADO", "JOGAR NO WE2002". Sem emoji. Valores em reais no formato "R$ 48,2 mi".

## Ícones e logos

Ainda não há logo nem conjunto de ícones. Por enquanto, o nome do jogo em Chakra Petch e setas/ícones de traço desenhados em SVG inline. Os escudos dos clubes vêm do pacote de dados.
