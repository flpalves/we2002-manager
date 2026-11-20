# Decisões em aberto

Itens que a especificação assumiu provisoriamente ou deixou para depois. Resolver antes da fase indicada.

| # | Assunto | Situação atual na spec | Resolver até |
|---|---|---|---|
| 1 | ~~**Posições**: 12 ou as 8 do WE~~ | **Resolvido** (fase 1): 8 do WE; na importação LB/RB → SB, LH/RH → SH, LW/RW → WG | — |
| 2 | ~~**Atributos**: 15 ou 16~~ | **Resolvido** (fase 1): 16 (OFF DEF BAL STA SPD ACC RES DRI PAS SHP SHA TEC HEA JMP CUR AGR) + OUTSIDE | — |
| 3 | ~~Idade não avança na v1~~ | **Resolvido** (fase 9): todo jogador fica 1 ano mais velho na virada (`virada.envelhecer`), e o declínio 30+ passa a valer com o tempo. Aposentadorias e jovens continuam na v2 | — |
| 4 | ~~Limite de substituições: WE2002 permite 3; regra atual do futebol é 5~~ | **Resolvido**: padrão 3 em tudo, configurável por competição | — |
| 5 | ~~Mata-mata de ida e volta no WE~~ | **Resolvido** (fase 5): ida e volta jogadas no WE em "pontos_corridos" (vale o placar dos 90'); se o agregado empatar na volta, o manager decide nos pênaltis. Jogo único decisivo vai em "mata_mata" (prorrogação e pênaltis do próprio WE) | — |
| 6 | Gol contra no `resultado.json` | não mapeado; gol sem vaga entra sem autor (fase 5) | trilha A |
| 7 | Formações do WE: lista completa | papéis das vagas de 4-3-3B, 4-4-2A e 5-3-2 tirados de data/times; 4-4-2B, 4-5-1A, 4-5-1B e 4-3-3A com papéis provisórios em `src/core/partida/formacoes.ts` | trilha A |
| 8 | ~~Duração exata dos passos~~ | **Resolvido** (fase 2): 2 datas por semana (quarta e domingo, 3/4 dias); datas vazias não viram passo. Janelas das competições no `temporada.json` (Série A: semanas 12-50, provisório) | — |
| 9 | Fórmulas de condição, moral, evolução, valor, público, confiança | propostas iniciais; calibrar com temporadas simuladas | fases 3-6 |
| 10 | ~~Catálogo de notícias~~ | **Resolvido** (fase 7): catálogo padrão com 24 eventos em `docs/spec/09b-catalogo-noticias.md`; o pacote pode trazer o seu `noticias.json`. Chances são propostas iniciais, a calibrar jogando | trilha B |
| 11 | Como o usuário segue após demissão a longo prazo (carreira de técnico) | v1: escolhe novo clube da lista | v2 |
| 12 | Kit de goleiro e transparência dos goleiros com o kit PS1 | problema aberto na ponte | fase 5 |
| 13 | ~~Prioridade de competições para o rodízio da IA~~ | **Resolvido** (fase 3): liga > continental > copa > estadual, pelo limite de condição do rodízio (`ia.rodizio_limite`: 70/70/75/80), com teto de poupados e perda máxima por competição (`ia.rodizio_maximo`, `ia.rodizio_perda_maxima`; ver spec 04) | — |
| 14 | ~~Contrato só tem `ate_temporada`, mas o valor de mercado usava meses~~ | **Resolvido**: temporada fixa de 52 semanas implícitas; f_contrato por semanas restantes (≤ 26 / ≤ 52) | — |
| 15 | ~~Onde guardar as carreiras com o projeto no OneDrive~~ | **Resolvido**: `%APPDATA%/we2002-manager/carreiras`, alterável nas Configurações | — |
| 16 | ~~Arredondamento da importação 12-19 → 1-20~~ | **Resolvido**: valor central da faixa arredondado para baixo (12 → 3, 13 → 7, …, 19 → 19) | — |
| 17 | ~~Migração de `D:\we2002-manager` e `D:\pcsx-redux` para a pasta do projeto no OneDrive~~ | **Resolvido** (fase 0): tudo em `emulador/` e nas pastas do projeto; `run-pcsx.bat` usa `WE_EMU`/`WE_ISO` ou caminhos relativos | — |
| 18 | **Dados faltando nos times de `data/times`**: elencos com 22 (a spec pede 23 convocáveis), 16 times sem escudo, sem finanças/estádio/salários/posição secundária/nacionalidade | decidido manter erro como na spec; importados com valores provisórios (BRA, salário 0, potencial = geral + folga por idade) e aviso | trilha B |
| 19 | ~~Resultado das partidas antes do motor da fase 3~~ | **Resolvido** (fase 3): o motor lance a lance substituiu o simulador provisório no Continuar (`origem = motor`); o provisório ficou só para os testes do calendário | — |
| 20 | Participantes `por_divisao`, `entram` em fases seguintes | **Resolvido em parte** (fase 9): `classificados_de` funciona a partir da 2ª temporada (vagas da virada); acesso/rebaixamento entre listas; sorteios refeitos a cada temporada. Faltam `por_divisao` e `entram` (copas com entrada tardia) | trilha B |
| 21 | ~~Ocupação do estádio no motor (bônus de mando)~~ | **Resolvido** (fase 6): o público calculado de cada jogo vira a ocupação usada pelo mando | — |
| 22 | Gasto de condição em campo inclui FOLE (fator 1,15 − 0,015 × FOLE; FOLE 10 = neutro), que a fórmula da spec 05 não tinha | adotado no motor; a fase 4 pode recalibrar | fase 4 |
| 23 | Clássicos para a moral em dobro | só a final (jogo decisivo da última fase de mata-mata) conta como jogo grande; clássicos precisam de uma lista no pacote | trilha B |
| 24 | Condição em sequência de jogos | com as fórmulas da spec 05 (gasto 28/jogo, recuperação 7/dia), titular que joga a cada 3-4 dias fica perto de 55% até o rodízio; calibrar junto com a decisão 9 | fase 9 |
| 25 | Foco do treino dos times da CPU | regra simples: Descanso se condição média < 80, Tático se entrosamento < 60, senão alterna Técnico/Físico | fase 9 |
| 26 | Vaga 22 no WE | os times antigos deixavam a vaga 22 com o jogador original; o manager agora escreve as 23 vagas (11 titulares + 12 reservas). Confirmar no primeiro jogo real que a vaga 22 aceita a edição | fase 5 (teste real) |
| 27 | Nome no WE em maiúsculas | a spec 07 diz "ASCII maiúsculo"; o manager manda o `nome_we` como está (ASCII, 10 caracteres), igual aos times antigos ("Rossi") | trilha B |
| 28 | ~~Escalação do usuário no WE~~ | **Resolvido** (fase 8): a escalação salva na tela de Escalação vale no motor e no WE; desfalques do dia são trocados pela IA só na vaga deles; "Deixar automática" volta para a IA | — |
| 29 | Fator de preço do público | a spec dá f_preço = 1,15 − preço/referência, que já bate no mínimo (0,15) no próprio preço de referência. Adotado `preco_peso` 0,25: 0,9 na referência, 0,65 no dobro, 0,15 em 4× | calibrar com o público real |
| 30 | Janelas de transferência | padrão 1–16 e 27–31 (a 1ª janela da spec, "início da temporada", precisa cobrir o começo do Brasileirão na semana 12; com 1–8 a CPU nunca chegava a ir ao mercado) | trilha B |
| 31 | Elenco mínimo para vender | nenhum clube (CPU ou usuário) vende abaixo de 23. Num pacote em que todo time tem exatamente 23, a CPU só compra livres até alguém crescer; pacotes devem trazer elencos maiores ou jogadores livres | trilha B |
| 32 | Salário e multa vindos do pacote com 0 | salário vira o de referência (1,2% do valor ao mês, mínimo R$ 15 mil); multa vira 3× o valor | trilha B |
| 33 | Simplificações do mercado na v1 | empréstimo: taxa de 10% do valor, até o fim da temporada, o usuário paga o salário inteiro (sem divisão), volta na virada (feito na fase 9); premiação paga no fim da competição (participação + colocação final; sem prêmio por fase de copa); venda só por proposta recebida da CPU (o usuário não anuncia jogador); metas de copa ficam para quando houver copas no pacote | fase 9 / trilha B |
| 34 | ~~Fechamento das metas e fim do empréstimo~~ | **Resolvido** (fase 9): `fecharMetas` e a volta dos emprestados rodam na virada (`src/main/carreira/virada.ts`) | — |
| 35 | Eventos antes do 1º jogo e no meio da data | as semanas são avaliadas quando a data seguinte é jogada; se o 1º passo da temporada já é jogo do usuário, os eventos das semanas anteriores aparecem junto com ele. Um evento com escolha que surge na data do jogo do usuário não impede esse jogo (já estava no pré-jogo); trava o próximo Continuar | rever na fase 8 |
| 36 | "Disponibilidade" (liberado/afastado) | usa os dias de lesão: aparece como lesão no elenco. Um estado próprio ("afastado") pode vir na fase 8 | fase 8 |
| 37 | Leitura das notícias | abrir a tela de Notícias marca todas como lidas (as pendentes só saem com a resposta) | — |
| 38 | Troca de formação | cada troca salva derruba o entrosamento pela metade (regra da spec 05), mesmo que volte à anterior na mesma semana; a tela pede confirmação | calibrar jogando |
| 39 | Mockups das telas | a spec pede exportar o canvas para `docs/mockups/`; as telas da fase 8 seguiram o design system e os componentes `we-*` sem as imagens no repositório. Exportar quando der para comparar tela a tela | trilha B |
| 40 | Foco inicial do controle | cada tela pode marcar a ação mais provável com `data-foco-inicial` (pré-jogo: Jogar no WE, ou Simular sem emulador; Notícias: 1ª opção da decisão; pós-jogo: Confirmar). Atalhos X/Y por tela aparecem no rodapé | — |
| 41 | Contratos que acabam todos juntos | o pacote importado dá a todos contrato até a temporada inicial + 1. Na virada, nenhum elenco fica abaixo de `mercado.elenco_minimo` (23) nem com menos de 2 goleiros: os melhores que faltarem são renovados por 1 temporada (no usuário, "renovados pela diretoria"). Com elencos de exatamente 23, ninguém sai | trilha B |
| 42 | Autosave | 3 cópias rotativas (`VACUUM INTO`) depois de cada jogo do usuário (simulado, WE ou digitado) e da virada; restaurar guarda o estado anterior em `autosave/antes-de-restaurar.sqlite`. Continuar sem jogo do usuário não gera cópia | — |
| 43 | Disponíveis do exterior: valores | taxa = fórmula do valor de mercado (contrato longo, Série A) × fator da liga de origem (Europa 1,2 · MEX 1,0 · USA/CAN 0,9 · JPN 0,85 · AUS/RSA 0,8 · CONMEBOL = `fator_valor` do país); salário pedido × 1,15 | calibrar jogando |
| 44 | Disponíveis do exterior: lista do pacote | 300 jogadores em `exterior.json` (lote 2 de 100, acima dos melhores da Série A, em 20/11/2026), nenhum nos elencos do pacote (conferido em 14/11 e 20/11/2026), com clube de referência até meados de 2026; 115 marcados para conferir o clube em `jogadores.txt` (coluna "validar"). O clube é só informativo | trilha B |
| 45 | Reposição do exterior | v1 sem reposição: o pool diminui com contratações e com a saída na virada (15%). Para carreiras longas: gerar disponíveis novos ou trazer uma lista por temporada no pacote | v2 |
| 46 | Taxa parcelada e luvas | v1: taxa à vista, sem luvas para livres | v2 |
