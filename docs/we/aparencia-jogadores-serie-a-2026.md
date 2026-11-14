# Aparência dos jogadores — Série A 2026 (pacote `brasil-2026`)

Mapeamento feito em 13/11/2026 olhando a foto oficial de cada jogador, para não refazer o trabalho. Os valores estão gravados no campo `aparencia` de cada jogador em `pacotes/brasil-2026/times/SIG.json`; este arquivo é a referência legível e o registro de **como** cada valor foi decidido.

## Legenda dos códigos (formato da ponte, ver `docs/we/offsets-we2002.md`)

| Campo | Valores usados | Critério adotado |
|---|---|---|
| `pele` | 1 a 4 | 1 = clara · 2 = morena clara · 3 = parda/morena · 4 = negra (no WE: 0 Stam/De Boer … 3 Nigéria/Davids) |
| `fisico` | E, F, G, H | F = padrão · E = franzino/baixo · G = forte ou muito alto · H = muito forte (só Hulk). B, C e D não são usados pela base do WE |
| `cabelo` | i1, k1, m1, o1 | **Mapa reduzido** (decisão do Felipe, 13/11): i1 = curto/normal (padrão, inclui cacheado e comprido enquanto não houver catálogo) · k1 = raspado/máquina zero · m1 = calvo/entradas (estilo Zidane) · o1 = dreads/tranças |
| `cor_cabelo` | A, B, G, H | A = preto · B = castanho · H = loiro ou descolorido/platinado · G = ruivo (só Pitta) |
| `barba` | A, B, C | A = sem barba · B = rala/bigode/cavanhaque · C = barba cheia |
| `cor_barba` | A, B, C | A = preta · B = castanha · C = clara/loira (palpite da doc de offsets; "confirmar visualmente") |
| `chuteira` | — | mantida a que já estava (A para jogador novo) |

### Pendências do mapa
- **Catálogo de cabelos**: dos 32 modelos (a1…p1) só k1, o1, m1 e i1 estão identificados. Quando houver prints do menu de edição com os 32, dá para refinar cabelo comprido, cacheado/black e topete usando as colunas abaixo (pele/cor já estão certas).
- **Barba B vs C** e **cor da barba C**: inferidas da base do WE, não conferidas no jogo.
- Sem foto: Gustavo Henrique (SAN) e Tico (REM) ficaram com valores genéricos.

## Fontes das fotos por time

- **FLA** — FLA — elenco: flamengo.com.br/futebol/elenco (13/11/2026); camisa/altura/pé do site; nascimento e nacionalidade: Sofascore
- **PAL** — PAL — elenco: palmeiras.com.br/elenco (13/11/2026); nome completo, nascimento, altura e naturalidade do site; pé e nacionalidade: Sofascore
- **CRU** — CRU — elenco: cruzeiro.com.br (fotos imagens.cruzeiro.com.br/Elenco/2026/Masculino; 34 nomes; cortados Vitor Lamounier, Felipe Morais, Rhuan Gabriel, Kaique Kenji, João Costa, Rayan Lelis); camisa/pé/altura/nascimento/nacionalidade: Sofascore
- **FLU** — FLU — elenco: fluminense.com.br/o-time/futebol/profissional (31 nomes; cortados Júlio Fidelis, Riquelme, Matheus Reis); camisa do site; pé/altura/nascimento/nacionalidade: Sofascore
- **COR** — COR — elenco: corinthians.com.br/futebol/profissional/elenco (13/11/2026; 35 nomes, cortados os 7 garotos menos usados); altura/naturalidade do site; camisa, pé, nascimento, nacionalidade: Sofascore
- **SPFC** — SPFC — elenco: saopaulofc.net/esporte/futebol-masculino-profissional (38 nomes; cortados Felipe Preis, João Pedro Pantiga, Tetê, Lucca, Pedro Ferreira, Isac, Nicolas, Ryan Francisco, Gustavo Santana, Danielzinho); camisa do site; pé/altura/nascimento/nacionalidade: Sofascore
- **CAM** — CAM — elenco: atletico.com.br/futebol/masculino/elenco (32 nomes; cortados Pedro Cobra, Índio, Vitão, Tomás Pérez); camisa do site; pé/altura/nascimento/nacionalidade: Sofascore
- **BOT** — BOT — elenco: botafogo.com.br/elenco/futebol (32 nomes, só 2 goleiros; cortados Lucas Emanuel, Anthony, Kadu, Domingos Andrade); camisa/pé/altura/nascimento/nacionalidade: Sofascore
- **INT** — INT — elenco: internacional.com.br/equipes/masculino (27 nomes; cortados os goleiros Anthoni e Diego Esser); camisa do site; pé/altura/nascimento/nacionalidade: Sofascore
- **GRE** — GRE — elenco: portal.gremio.net (seção elenco; 34 nomes; cortados Gabriel Menegon, Pedro Gabriel, Athos, Luis Eduardo, Roger, Tiago); camisa do site; pé/altura/nascimento/nacionalidade: Sofascore
- **BAH** — BAH — elenco: esporteclubebahia.com.br/elenco/masculino (29 nomes; cortado Kauê Furquim); camisa do site; pé/altura/nascimento/nacionalidade: Sofascore
- **VAS** — VAS — elenco: vasco.com.br/elenco/profissional-masculino (33 nomes; cortados João Vitor, Walace Fernandes, Mateus Carvalho, Paulinho, Lucas Freitas); camisa do site; pé/altura/nascimento/nacionalidade: Sofascore
- **SAN** — SAN — elenco: santosfc.com.br/masculino (34 nomes; cortados Rodrigo Falcão, João Pedro, Rafael Gonzaga, Davizinho, Samuel Pierri, Lima); site bloqueou (403) depois da leitura, aparência pelas fotos do Sofascore; camisa/pé/altura/nascimento/nacionalidade: Sofascore (Gustavo Henrique: sem cadastro no Sofascore, dados do pacote)
- **RBB** — RBB — elenco: redbullbragantino.com/br-pt/jogadores (31 nomes; cortados Gustavo Reis, Cauê, Marcelinho); camisa do site; aparência pelas fotos do Sofascore (o site carrega as fotos dentro de carrosséis); pé/altura/nascimento/nacionalidade: Sofascore
- **CAP** — CAP — o site athletico.com.br não tem página de elenco; elenco principal montado pela lista do Sofascore (sem os garotos da base); camisa/pé/altura/nascimento/nacionalidade e fotos: Sofascore
- **MIR** — MIR — elenco: mirassolfc.com.br/blogs/elenco (32 nomes; cortados Georgemy, Rafael Guanaes, Elias, Gustavo Cazonatti); aparência pelas fotos do Sofascore; camisa/pé/altura/nascimento/nacionalidade: Sofascore
- **VIT** — VIT — elenco: ecvitoria.com.br/elenco/masculino (42 nomes; cortados Davi, Darlan, Andrei, Kauan, Edenilson, Fabiano Souza, Wanderson, Nathan Mendes, Dudu, Hiago, Alejandro Almaraz, Wendell, Lucas Silva, Anderson Pato); camisa do site; aparência pelas fotos do Sofascore; pé/altura/nascimento/nacionalidade: Sofascore
- **CFC** — CFC — elenco: coritiba.com.br/elenco/masculino-profissional (34 nomes; cortados Benassi, Vitor Tissi, Lucas Taverna, Rodrigo Gelado, Ararat, David); camisa do site; aparência pelas fotos do Sofascore; pé/altura/nascimento/nacionalidade: Sofascore
- **REM** — REM — elenco: clubedoremo.com.br/elenco (30 nomes; cortados os goleiros Alexandre e João Victor); camisa do site; aparência pelas fotos do Sofascore (Tico sem foto); pé/altura/nascimento/nacionalidade: Sofascore
- **CHA** — CHA — elenco: chapecoense.com/elenco (31 nomes; cortados Kainã, Vinicius, Rosivan); camisa do site; aparência pelas fotos do Sofascore; pé/altura/nascimento/nacionalidade: Sofascore

## FLA — Flamengo

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Agustín Rossi | `fla-rossi` | GK | 1 | F | i1 | A | C | A |
| 3 | Léo Ortiz | `fla-leo-ortiz` | CB | 1 | F | i1 | B | B | B |
| 4 | Léo Pereira | `fla-l-pereira` | CB | 1 | G | i1 | B | C | B |
| 26 | Alex Sandro | `fla-a-sandro` | SB | 3 | F | k1 | A | A | A |
| 2 | Guillermo Varela | `fla-varela` | SB | 1 | F | i1 | H | B | B |
| 5 | Erick Pulgar | `fla-pulgar` | DH | 1 | G | i1 | A | A | A |
| 21 | Jorginho | `fla-jorginho` | DH | 1 | F | i1 | A | C | A |
| 10 | Giorgian de Arrascaeta | `fla-arrascaeta` | OH | 1 | E | i1 | A | C | A |
| 9 | Pedro | `fla-pedro` | CF | 1 | G | i1 | A | B | A |
| 16 | Samuel Lino | `fla-s-lino` | WG | 3 | F | k1 | A | A | A |
| 15 | Jorge Carrascal | `fla-carrascal` | WG | 2 | F | i1 | B | A | A |
| 32 (42) | Andrew | `fla-andrew` | GK | 4 | F | k1 | A | A | A |
| 31 (49) | Dyogo Alves | `fla-dyogo-alves` | GK | 2 | E | i1 | A | A | A |
| 13 | Danilo | `fla-danilo` | CB | 2 | F | i1 | A | C | A |
| 29 (44) | Vitão | `int-vitao` | CB | 4 | G | i1 | A | A | A |
| 28 (71) | João Victor | `fla-joao-victor` | CB | 3 | F | k1 | A | A | A |
| 22 | Emerson Royal | `fla-e-royal` | SB | 4 | F | i1 | A | C | A |
| 6 | Ayrton Lucas | `fla-a-lucas` | SB | 2 | F | i1 | H | A | A |
| 25 (52) | Evertton Araújo | `fla-e-araujo` | DH | 4 | F | k1 | A | B | A |
| 8 | Saúl Ñíguez | `fla-saul` | DH | 1 | F | i1 | B | B | B |
| 18 | Nicolás de la Cruz | `fla-nicolas-de-la-cruz` | OH | 3 | E | k1 | A | A | A |
| 20 | Lucas Paquetá | `fla-paqueta` | OH | 2 | F | i1 | A | C | A |
| 27 | Bruno Henrique | `fla-b-henrique` | CF | 4 | G | i1 | A | B | A |
| 7 | Luiz Araújo | `fla-l-araujo` | WG | 2 | E | i1 | H | A | A |
| 19 | Gonzalo Plata | `fla-plata` | WG | 4 | F | i1 | A | A | A |
| 14 | Anthony Valencia | `fla-anthony-valencia` | WG | 3 | E | k1 | A | A | A |
| 30 | Joaquín Freitas | `fla-joaquin-freitas` | CF | 1 | E | i1 | B | A | A |

## PAL — Palmeiras

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Carlos Miguel | `pal-c-miguel` | GK | 4 | G | k1 | A | C | A |
| 3 | Bruno Fuchs | `pal-b-fuchs` | CB | 1 | F | i1 | H | B | C |
| 15 | Gustavo Gómez | `pal-g-gomez` | CB | 2 | G | i1 | A | C | A |
| 2 | Alexander Barboza | `pal-barboza` | CB | 2 | F | i1 | A | C | A |
| 17 | Marlon Freitas | `pal-m-freitas` | DH | 4 | F | k1 | A | B | A |
| 8 | Andreas Pereira | `pal-andreas` | DH | 1 | F | i1 | A | B | A |
| 31 (56) | Arthur Gabriel | `pal-arthur` | SH | 2 | E | i1 | A | B | A |
| 12 | Khellven | `pal-khellven` | SH | 2 | E | i1 | A | B | A |
| 11 | Jhon Arias | `pal-arias` | OH | 4 | F | k1 | A | A | A |
| 9 | Vitor Roque | `pal-v-roque` | CF | 3 | F | i1 | H | A | A |
| 18 | Mauricio | `pal-mauricio` | CF | 1 | E | i1 | B | B | B |
| 14 | Marcelo Lomba | `pal-m-lomba` | GK | 1 | F | m1 | B | C | B |
| 21 | Bruno Bertinato | `pal-bruno-bertinato` | GK | 1 | F | i1 | B | C | B |
| 26 | Murilo | `pal-murilo` | CB | 3 | F | i1 | A | C | A |
| 29 (43) | Benedetti | `pal-benedetti` | CB | 1 | G | i1 | B | A | A |
| 22 | Joaquín Piquerez | `pal-piquerez` | SB | 1 | F | i1 | B | C | B |
| 4 | Agustín Giay | `pal-giay` | SB | 1 | E | i1 | B | A | A |
| 6 | Jefté | `pal-jefte` | SB | 3 | F | i1 | A | C | A |
| 32 | Emiliano Martínez | `pal-emiliano-martinez` | DH | 1 | F | i1 | B | B | B |
| 30 | Lucas Evangelista | `pal-l-evangel` | DH | 3 | F | i1 | A | C | A |
| 28 (48) | Larson | `pal-larson` | DH | 1 | E | i1 | B | A | A |
| 7 | Felipe Anderson | `pal-f-anderson` | WG | 3 | F | i1 | A | C | A |
| 19 | Ramón Sosa | `pal-ramon-sosa` | WG | 2 | E | i1 | A | A | A |
| 10 | Paulinho | `pal-paulinho` | WG | 2 | F | i1 | A | C | A |
| 27 (42) | José Manuel López | `pal-flaco` | CF | 2 | G | i1 | A | C | A |

## CRU — Cruzeiro

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Cássio | `cru-cassio` | GK | 1 | G | i1 | B | B | B |
| 32 (34) | Jonathan Jesus | `cru-j-jesus` | CB | 4 | F | i1 | A | A | A |
| 25 | Lucas Villalba | `cru-villalba` | CB | 1 | F | i1 | A | B | A |
| 27 | Gabriel Rojas | `cru-rojas` | SB | 2 | F | i1 | A | A | A |
| 12 | William | `cru-william` | SB | 2 | F | i1 | A | B | A |
| 29 | Lucas Romero | `cru-l-romero` | DH | 2 | E | i1 | A | A | A |
| 9 | Bruno Rodrigues | `cru-b-rodrigue` | SH | 2 | E | i1 | A | A | A |
| 8 | Gerson | `cru-gerson` | SH | 4 | G | k1 | A | C | A |
| 10 | Matheus Pereira | `cru-m-pereira` | OH | 2 | E | i1 | H | B | A |
| 19 | Kaio Jorge | `cru-kaio-jorge` | CF | 1 | F | i1 | A | A | A |
| 31 (99) | Keny Arroyo | `cru-arroyo` | CF | 3 | E | k1 | A | A | A |
| 30 (81) | Otávio | `cru-otavio` | GK | 1 | F | i1 | B | B | B |
| 28 (41) | Léo Aragão | `cru-leo-aragao` | GK | 2 | F | i1 | A | B | A |
| 15 | Fabrício Bruno | `cru-fabricio-bruno` | CB | 2 | G | k1 | A | C | A |
| 26 (43) | João Marcelo | `cru-j-marcelo` | CB | 2 | F | i1 | A | C | A |
| 23 | Fagner | `cru-fagner` | SB | 1 | F | i1 | H | B | A |
| 2 | Kauã Moraes | `cru-kaua-moraes` | SB | 3 | E | i1 | A | A | A |
| 6 | Matías Viña | `cru-vina` | SB | 1 | F | i1 | B | C | B |
| 5 | Zé Lucas | `cru-ze-lucas` | DH | 4 | E | i1 | A | A | A |
| 16 | Lucas Silva | `cru-lucas-silva` | DH | 1 | F | i1 | B | B | B |
| 7 | Matheus Henrique | `cru-matheus-henrique` | DH | 1 | F | i1 | B | B | B |
| 20 | Wesley | `cru-wesley` | WG | 3 | E | i1 | A | A | A |
| 17 | Luis Sinisterra | `cru-sinisterra` | WG | 4 | E | k1 | A | A | A |
| 11 | Marquinhos | `cru-marquinhos` | WG | 3 | E | k1 | A | A | A |
| 24 (94) | Wanderson | `int-wanderson` | WG | 3 | F | k1 | A | B | A |
| 21 (77) | Gabriel Pec | `cru-gabriel-pec` | WG | 1 | F | i1 | A | B | A |
| 18 (97) | Luciano Rodríguez | `cru-luciano-rodriguez` | CF | 2 | E | i1 | A | A | A |
| 22 | Néiser Villarreal | `cru-villarreal` | CF | 4 | F | k1 | A | A | A |

## FLU — Fluminense

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Fábio | `flu-fabio` | GK | 1 | F | m1 | B | A | A |
| 3 | Thiago Silva | `flu-t-silva` | CB | 2 | F | i1 | A | A | A |
| 22 | Juan Pablo Freytes | `flu-freytes` | CB | 1 | F | i1 | B | C | B |
| 6 | Renê | `flu-rene` | SB | 1 | F | k1 | A | A | A |
| 23 | Guga | `flu-guga` | SB | 2 | F | i1 | A | B | A |
| 31 (35) | Hércules | `flu-hercules` | DH | 3 | F | i1 | A | A | A |
| 16 | Nonato | `flu-nonato` | DH | 2 | F | i1 | A | C | A |
| 32 | Luciano Acosta | `flu-l-acosta` | OH | 1 | E | i1 | H | B | A |
| 7 | Hulk | `flu-hulk` | CF | 3 | H | k1 | A | B | A |
| 17 | Agustín Canobbio | `flu-canobbio` | WG | 1 | E | i1 | B | A | A |
| 11 | Jefferson Savarino | `flu-savarino` | WG | 2 | E | i1 | A | A | A |
| 28 (98) | Vitor Eudes | `flu-v-eudes` | GK | 1 | F | i1 | B | A | A |
| 27 | Marcelo Pitaluga | `flu-marcelo-pitaluga` | GK | 1 | F | i1 | A | A | A |
| 4 | Ignácio | `flu-ignacio` | CB | 1 | F | i1 | A | C | A |
| 21 | Igor Rabello | `flu-igor-rabello` | CB | 1 | G | i1 | B | C | B |
| 26 (44) | Jemmes | `mir-jemmes` | CB | 1 | F | i1 | B | C | B |
| 29 | Julián Millán | `flu-julian-millan` | CB | 3 | F | i1 | A | A | A |
| 2 | Samuel Xavier | `flu-s-xavier` | SB | 3 | F | k1 | A | C | A |
| 13 | Guilherme Arana | `flu-arana` | SB | 2 | F | i1 | A | A | A |
| 8 | Matheus Martinelli | `flu-martinelli` | DH | 1 | F | i1 | B | C | B |
| 24 (94) | Otávio | `flu-otavio` | DH | 3 | G | k1 | A | C | A |
| 25 | Alisson | `flu-alisson` | DH | 3 | F | k1 | A | A | A |
| 10 | Paulo Henrique Ganso | `flu-ganso` | OH | 1 | F | i1 | A | A | A |
| 20 (90) | Kevin Serna | `flu-serna` | WG | 2 | F | i1 | A | A | A |
| 30 | Yeferson Soteldo | `flu-yeferson-soteldo` | WG | 1 | E | i1 | B | B | B |
| 9 | John Kennedy | `flu-j-kennedy` | CF | 3 | F | i1 | A | B | A |
| 19 | Rodrigo Castillo | `flu-rodrigo-castillo` | CF | 1 | F | i1 | B | A | A |
| 14 | Germán Cano | `flu-cano` | CF | 2 | F | i1 | A | A | A |

## COR — Corinthians

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Hugo Souza | `cor-hugo-souza` | GK | 4 | G | i1 | A | A | A |
| 5 | André Ramalho | `cor-a-ramalho` | CB | 2 | F | i1 | A | C | A |
| 13 | Gustavo Henrique | `cor-g-henrique` | CB | 1 | G | i1 | A | C | A |
| 26 | Fabrizio Angileri | `cor-angileri` | SB | 2 | F | i1 | A | B | A |
| 2 | Matheuzinho | `cor-matheuzin` | SB | 2 | E | i1 | A | B | A |
| 7 | Breno Bidon | `cor-b-bidon` | DH | 1 | E | i1 | B | A | A |
| 32 (49) | André | `cor-andre` | DH | 4 | F | i1 | A | A | A |
| 8 | Rodrigo Garro | `cor-garro` | OH | 1 | E | i1 | B | B | B |
| 9 | Yuri Alberto | `cor-yuri-a` | CF | 1 | F | i1 | B | C | B |
| 10 | Memphis Depay | `cor-memphis` | WG | 4 | G | i1 | A | C | A |
| 31 (37) | Kaio César | `cor-kaio-cesar` | WG | 3 | E | i1 | A | B | A |
| 30 (40) | Felipe Longo | `cor-f-longo` | GK | 1 | F | i1 | B | B | B |
| 28 (51) | Kauê | `cor-kaue` | GK | 2 | F | i1 | A | B | A |
| 3 | Gabriel Paulista | `cor-g-paulista` | CB | 1 | F | i1 | B | C | B |
| 4 | João Pedro Tchoca | `cor-tchoca` | CB | 1 | F | i1 | B | B | B |
| 20 | Pedro Milans | `cor-milans` | SB | 1 | E | i1 | B | B | B |
| 21 | Matheus Bidu | `cor-m-bidu` | SB | 3 | F | i1 | A | C | A |
| 27 (46) | Hugo | `cor-hugo` | SB | 1 | F | i1 | B | C | B |
| 14 | Raniele | `cor-raniele` | DH | 2 | F | i1 | A | C | A |
| 29 | Allan | `cor-allan` | DH | 3 | E | i1 | A | B | A |
| 25 (35) | Charles | `cor-charles` | DH | 1 | F | i1 | H | A | A |
| 24 (80) | Alex Santana | `cor-alex-santana` | DH | 4 | F | k1 | A | C | A |
| 23 | Matheus Pereira | `cor-matheus-pereira` | OH | 2 | F | i1 | A | C | A |
| 22 (52) | Zakaria Labyad | `cor-labyad` | OH | 2 | F | i1 | A | C | A |
| 17 (77) | Jesse Lingard | `cor-lingard` | OH | 3 | F | i1 | A | A | A |
| 19 | André Carrillo | `cor-carrillo` | SH | 3 | F | o1 | A | B | A |
| 11 | Vitinho | `cor-vitinho` | WG | 4 | F | i1 | A | B | A |
| 18 | Pedro Raul | `cor-pedro-raul` | CF | 1 | G | i1 | B | C | B |

## SPFC — SPFC

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 23 | Rafael | `spfc-rafael` | GK | 1 | F | i1 | A | C | A |
| 2 | Rafael Tolói | `spfc-rafael-toloi` | CB | 1 | F | i1 | B | C | B |
| 5 | Robert Arboleda | `spfc-arboleda` | CB | 4 | G | k1 | A | B | A |
| 30 (54) | Luis Osorio | `spfc-osorio` | CB | 2 | F | i1 | A | A | A |
| 16 | Damián Bobadilla | `spfc-bobadilla` | DH | 1 | F | i1 | A | B | A |
| 29 | Pablo Maia | `spfc-pablo-maia` | DH | 1 | F | i1 | B | B | B |
| 18 | Wendell | `spfc-wendell` | SH | 4 | F | k1 | A | A | A |
| 21 | Cédric Soares | `spfc-cedric-soares` | SH | 1 | F | i1 | A | C | A |
| 10 | Luciano | `spfc-luciano` | OH | 2 | F | i1 | A | B | A |
| 9 | Jonathan Calleri | `spfc-calleri` | CF | 1 | F | i1 | B | C | B |
| 26 (37) | Artur | `spfc-artur` | CF | 1 | E | i1 | B | B | B |
| 31 | Carlos Coronel | `spfc-carlos-coronel` | GK | 1 | G | i1 | A | C | A |
| 25 (50) | Young | `spfc-young` | GK | 1 | G | i1 | H | A | A |
| 28 | Newton | `spfc-newton` | CB | 4 | F | i1 | A | A | A |
| 24 (35) | Sabino | `spfc-sabino` | CB | 4 | F | i1 | A | C | A |
| 22 | Domingos Duarte | `spfc-domingos-duarte` | CB | 1 | G | i1 | B | C | B |
| 19 | Lucas Ramon | `spfc-l-ramon` | SB | 2 | F | i1 | A | B | A |
| 13 | Enzo Díaz | `spfc-enzo-diaz` | SB | 1 | F | i1 | A | C | A |
| 12 | Iago | `spfc-iago` | SB | 1 | F | i1 | A | B | A |
| 20 | Aurélio Buta | `spfc-aurelio-buta` | SB | 4 | F | i1 | A | A | A |
| 32 | Pedro Lima | `spfc-pedro-lima` | SH | 3 | E | i1 | A | A | A |
| 15 (48) | Djhordney | `spfc-djhordney` | DH | 3 | E | i1 | A | A | A |
| 8 | Marcos Antônio | `spfc-m-antonio` | DH | 4 | E | i1 | A | B | A |
| 14 (80) | Cauly | `bah-cauly` | OH | 2 | F | i1 | A | C | A |
| 7 | Lucas Moura | `spfc-l-moura` | OH | 3 | E | k1 | A | B | A |
| 11 | Ferreirinha | `spfc-ferreira` | WG | 2 | E | i1 | H | A | A |
| 27 | Victor Sá | `spfc-victor-sa` | WG | 3 | F | k1 | A | A | A |
| 17 | André Silva | `spfc-a-silva` | CF | 4 | F | i1 | A | B | A |

## CAM — Atletico-MG

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 22 | Everson | `cam-everson` | GK | 1 | F | m1 | B | C | B |
| 13 | Lyanco | `cam-lyanco` | CB | 1 | G | i1 | H | C | A |
| 4 | Ruan | `cam-ruan` | CB | 3 | F | i1 | A | B | A |
| 32 (36) | Kauã Pascini | `cam-pascini` | SB | 2 | E | i1 | A | A | A |
| 23 | Ángelo Preciado | `cam-preciado` | SB | 4 | F | i1 | A | A | A |
| 5 | Alexsander | `cam-alexsander` | DH | 2 | F | i1 | A | C | A |
| 10 | Gustavo Scarpa | `cam-g-scarpa` | SH | 2 | F | i1 | A | B | A |
| 26 (39) | Mamady Cissé | `cam-cisse` | SH | 4 | F | k1 | A | A | A |
| 17 | Igor Gomes | `cam-igor-gomes` | OH | 1 | F | i1 | A | B | A |
| 27 | Alan Minda | `cam-minda` | CF | 4 | E | k1 | A | A | A |
| 29 | Cauã Soares | `cam-c-soares` | CF | 3 | F | i1 | A | A | A |
| 1 | Gabriel Delfim | `cam-g-delfim` | GK | 3 | F | i1 | A | B | A |
| 31 | Robert Alves | `cam-robert-alves` | GK | 2 | F | i1 | A | B | A |
| 14 | Vitor Hugo | `cam-vitor-hugo` | CB | 2 | G | i1 | A | C | A |
| 3 | Léo Duarte | `cam-leo-duarte` | CB | 1 | F | i1 | B | C | B |
| 2 | Natanael | `cam-natanael` | SB | 1 | E | i1 | B | B | B |
| 6 | Renan Lodi | `cam-renan-lodi` | SB | 2 | F | i1 | A | C | A |
| 7 | Fred | `cam-fred` | DH | 4 | F | i1 | A | B | A |
| 15 | Kevin Castaño | `cam-kevin-castano` | DH | 2 | F | i1 | A | A | A |
| 21 | Alan Franco | `spfc-a-franco` | DH | 2 | F | i1 | A | A | A |
| 8 | Maycon | `cam-maycon` | DH | 2 | F | k1 | A | C | A |
| 30 | Victor Hugo | `cam-victor-hugo` | OH | 2 | F | i1 | A | A | A |
| 11 | Bernard | `cam-bernard` | OH | 1 | E | i1 | B | B | B |
| 19 | Reinier | `cam-reinier` | OH | 2 | F | i1 | A | A | A |
| 28 | Tomás Cuello | `cam-tomas-cuello` | WG | 2 | F | i1 | A | A | A |
| 25 (92) | Dudu | `cam-dudu` | WG | 1 | E | i1 | A | C | A |
| 9 | Mateo Cassierra | `cam-cassierra` | CF | 4 | G | k1 | A | A | A |
| 18 | Thiago Borbas | `cam-t-borbas` | CF | 1 | F | i1 | B | A | A |

## BOT — Botafogo

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 12 | Gabriel Batista | `bot-g-batista` | GK | 2 | F | i1 | A | B | A |
| 5 | Nahuel Ferraresi | `bot-ferraresi` | CB | 1 | F | i1 | B | A | A |
| 21 | Marçal | `bot-marcal` | CB | 3 | F | k1 | A | A | A |
| 13 | Alex Telles | `bot-a-telles` | SB | 2 | F | i1 | A | C | A |
| 2 | Vitinho | `bot-vitinho` | SB | 3 | F | i1 | A | B | A |
| 32 (75) | Huguinho | `bot-huguinho` | DH | 3 | E | i1 | A | A | A |
| 6 | Cristian Medina | `bot-medina` | DH | 2 | F | i1 | A | A | A |
| 10 | Álvaro Montoro | `bot-montoro` | OH | 1 | E | i1 | B | A | A |
| 19 | Arthur Cabral | `bot-a-cabral` | CF | 1 | G | k1 | A | C | A |
| 11 | Matheus Martins | `bot-m-martins` | WG | 2 | F | i1 | A | A | A |
| 22 | Hakim Ziyech | `bot-ziyech` | WG | 1 | F | i1 | A | C | A |
| 17 | Warleson | `bot-warleson` | GK | 3 | F | i1 | A | C | A |
| 3 | Arthur Chaves | `bot-arthur-chaves` | CB | 1 | F | i1 | B | A | A |
| 30 (34) | Gabriel Justino | `bot-gabriel-justino` | CB | 3 | F | i1 | A | A | A |
| 31 | Kaio Pantaleão | `bot-pantaleao` | CB | 4 | F | k1 | A | A | A |
| 28 (33) | Lucas Monzón | `bot-monzon` | CB | 3 | F | k1 | A | C | A |
| 4 | Mateo Ponte | `bot-ponte` | SB | 1 | E | i1 | A | A | A |
| 29 | Paulinho | `bot-paulinho` | SB | 4 | E | i1 | A | A | A |
| 25 | Allan | `bot-allan` | DH | 3 | F | k1 | A | B | A |
| 8 | Danilo Santos | `bot-danilo` | DH | 4 | E | o1 | A | A | A |
| 27 (88) | Edenilson | `bot-edenilson` | DH | 4 | F | k1 | A | B | A |
| 26 (59) | Kauan Toledo | `bot-kauan-toledo` | DH | 4 | E | i1 | A | A | A |
| 24 (77) | Lucas Villalba | `bot-lucas-villalba` | OH | 1 | E | i1 | A | A | A |
| 14 | Jordan Barrera | `bot-barrera` | WG | 3 | E | i1 | H | A | A |
| 7 | Júnior Santos | `bot-junior-santos` | WG | 4 | F | k1 | A | A | A |
| 23 (90) | Danilo Pereira | `bot-danilo-pereira` | WG | 4 | E | i1 | A | A | A |
| 20 (37) | Kadir Barría | `bot-k-barria` | CF | 4 | E | k1 | A | A | A |
| 9 | Tiquinho Soares | `bot-tiquinho-soares` | CF | 2 | F | i1 | A | A | A |

## INT — Internacional

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 22 | Kauan | `int-kauan` | GK | 3 | F | i1 | A | A | A |
| 3 | Guillermo Maripán | `int-maripan` | CB | 1 | G | i1 | A | B | A |
| 18 | Juninho | `int-juninho` | CB | 3 | F | i1 | A | A | A |
| 26 | Alexandro Bernabei | `int-bernabei` | SB | 1 | E | i1 | B | B | B |
| 32 (35) | Braian Aguirre | `int-aguirre` | SB | 2 | E | i1 | A | A | A |
| 5 | Rodrigo Villagra | `int-villagra` | DH | 1 | F | i1 | A | B | A |
| 16 | Ronaldo | `int-ronaldo` | DH | 1 | F | i1 | B | A | A |
| 10 | Alan Patrick | `int-a-patrick` | OH | 2 | F | i1 | A | A | A |
| 9 | Alerrandro | `int-alerrandro` | CF | 3 | F | k1 | A | B | A |
| 28 | Vitinho | `int-vitinho` | WG | 2 | F | i1 | A | A | A |
| 7 | Johan Carbonero | `int-carbonero` | WG | 4 | E | i1 | A | A | A |
| 1 | Sergio Rochet | `int-rochet` | GK | 1 | F | i1 | A | A | A |
| 23 | Matheus Cunha | `fla-m-cunha` | GK | 1 | G | i1 | B | C | B |
| 4 | Félix Torres | `int-felix-torres` | CB | 4 | G | k1 | A | A | A |
| 25 | Gabriel Mercado | `int-mercado` | CB | 1 | F | k1 | A | A | A |
| 31 (41) | Victor Gabriel | `int-victor-gabriel` | CB | 3 | F | i1 | A | A | A |
| 6 | Matheus Bahia | `int-m-bahia` | SB | 2 | F | i1 | A | C | A |
| 15 | Bruno Gomes | `int-b-gomes` | SB | 1 | F | i1 | H | A | A |
| 29 | Thiago Maia | `int-t-maia` | DH | 2 | F | k1 | A | B | A |
| 8 | Bruno Henrique | `int-bruno-henrique` | DH | 1 | F | i1 | A | C | A |
| 27 | Paulinho | `int-paulinho` | DH | 2 | F | i1 | A | C | A |
| 30 | Calebe | `int-calebe` | OH | 3 | F | i1 | A | C | A |
| 17 | Niclas Eliasson | `int-niclas-eliasson` | WG | 4 | F | i1 | A | A | A |
| 11 | Kayky | `int-kayky` | WG | 3 | E | i1 | A | A | A |
| 19 | Antonio Sanabria | `int-antonio-sanabria` | CF | 1 | F | i1 | A | C | A |

## GRE — Gremio

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 12 | Gabriel Grando | `gre-g-grando` | GK | 1 | F | i1 | B | B | B |
| 6 | Gustavo Martins | `gre-g-martins` | CB | 2 | F | i1 | A | B | A |
| 4 | Walter Kannemann | `gre-kannemann` | CB | 1 | F | i1 | B | B | B |
| 32 (82) | Wallace | `gre-wallace` | CB | 3 | F | i1 | A | A | A |
| 20 | Mathías Villasanti | `gre-villasanti` | DH | 1 | F | i1 | A | B | A |
| 8 | Erick Noriega | `gre-noriega` | DH | 2 | F | i1 | A | A | A |
| 23 | Marlon | `gre-marlon` | SH | 2 | F | i1 | A | A | A |
| 18 | João Pedro | `gre-joao-pedro` | SH | 2 | F | i1 | A | B | A |
| 31 (99) | José Enamorado | `gre-enamorado` | OH | 3 | E | i1 | A | A | A |
| 22 | Martin Braithwaite | `gre-braithwait` | CF | 3 | F | k1 | A | A | A |
| 9 | Francis Amuzu | `gre-amuzu` | CF | 4 | E | k1 | A | A | A |
| 1 | Weverton | `gre-weverton` | GK | 2 | F | k1 | A | C | A |
| 24 | Thiago Beltrame | `gre-thiago-beltrame` | GK | 1 | G | i1 | B | B | B |
| 2 | Fabián Balbuena | `gre-fabian-balbuena` | CB | 1 | G | i1 | A | A | A |
| 3 | Wagner Leonardo | `gre-wagner-leonardo` | CB | 2 | F | i1 | A | C | A |
| 14 | Marcos Rocha | `gre-m-rocha` | SB | 3 | F | k1 | A | B | A |
| 29 (38) | Caio Paulista | `gre-c-paulista` | SB | 3 | F | i1 | A | B | A |
| 27 | Diego Caito | `gre-diego-caito` | SB | 3 | F | i1 | A | C | A |
| 17 | Dodi | `gre-dodi` | DH | 1 | F | i1 | A | A | A |
| 5 | Juan Nardoni | `gre-nardoni` | DH | 1 | F | i1 | A | A | A |
| 15 | Danilo Barbosa | `gre-danilo-barbosa` | DH | 2 | F | i1 | A | B | A |
| 10 | Filip Krovinović | `gre-filip-krovinovic` | OH | 1 | F | i1 | B | C | B |
| 28 (65) | Riquelme | `gre-riquelme` | OH | 4 | E | i1 | A | A | A |
| 7 | Cristian Pavón | `gre-pavon` | WG | 1 | E | i1 | A | A | A |
| 26 (77) | Jovane Cabral | `gre-jovane` | WG | 4 | F | k1 | A | A | A |
| 11 | Tetê | `gre-tete` | WG | 4 | E | k1 | A | A | A |
| 25 (95) | Carlos Vinícius | `gre-c-vinicius` | CF | 3 | G | k1 | A | A | A |
| 30 | Matheus Nascimento | `gre-matheus-nascimento` | CF | 2 | F | i1 | A | A | A |

## BAH — Bahia

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Ronaldo | `bah-ronaldo` | GK | 1 | F | i1 | A | C | A |
| 32 (33) | David Duarte | `bah-d-duarte` | CB | 4 | G | k1 | A | B | A |
| 3 | Marco Moreno | `bah-m-moreno` | CB | 1 | G | i1 | B | A | A |
| 30 (46) | Luciano Juba | `bah-l-juba` | SB | 3 | E | k1 | A | A | A |
| 29 (44) | Marcos Victor | `bah-m-victor` | SB | 3 | F | i1 | A | A | A |
| 5 | Nicolás Acevedo | `bah-acevedo` | DH | 1 | F | i1 | A | C | A |
| 6 | Jean Lucas | `bah-jean-lucas` | DH | 3 | F | k1 | A | A | A |
| 11 | Rodrigo Nestor | `bah-r-nestor` | OH | 2 | F | i1 | A | B | A |
| 9 | Alejo Véliz | `bah-veliz` | CF | 1 | F | i1 | B | A | A |
| 28 (99) | Cristian Olivera | `bah-k-olivera` | WG | 2 | E | i1 | A | B | A |
| 16 | Erick Pulga | `bah-e-pulga` | WG | 3 | E | i1 | A | A | A |
| 22 | Léo Vieira | `bah-leo-vieira` | GK | 3 | F | k1 | A | B | A |
| 17 | Guido Herrera | `bah-guido-herrera` | GK | 1 | F | k1 | H | B | C |
| 4 | Kanu | `bah-kanu` | CB | 4 | F | k1 | A | A | A |
| 26 (43) | Luiz Gustavo | `bah-luiz-gustavo` | CB | 4 | F | k1 | A | A | A |
| 31 | Román Gómez | `bah-r-gomez` | SB | 1 | E | i1 | B | B | B |
| 25 (66) | Zé Guilherme | `bah-ze-guilherme` | SB | 3 | F | i1 | A | A | A |
| 8 | Caio Alexandre | `bah-c-alexandr` | DH | 2 | F | k1 | A | C | A |
| 14 | Erick | `bah-erick` | DH | 4 | F | k1 | A | A | A |
| 24 (63) | David Martins | `bah-david-martins` | DH | 3 | F | i1 | A | A | A |
| 10 | Everton Ribeiro | `bah-e-ribeiro` | OH | 2 | F | i1 | A | C | A |
| 15 | Michel Araújo | `bah-michel-araujo` | OH | 2 | F | i1 | A | B | A |
| 18 | Lautaro López | `bah-lautaro-lopez` | OH | 1 | E | i1 | A | A | A |
| 7 | Ademir | `bah-ademir` | WG | 4 | E | k1 | A | B | A |
| 21 (77) | Ruan Pablo | `bah-ruan-pablo` | WG | 4 | E | k1 | A | A | A |
| 12 | Willian José | `bah-w-jose` | CF | 2 | G | k1 | A | B | A |
| 23 | Mateo Sanabria | `bah-mateo-sanabria` | CF | 2 | F | i1 | A | A | A |
| 27 | Everaldo | `bah-everaldo` | CF | 1 | F | i1 | B | C | B |

## VAS — Vasco

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Léo Jardim | `vas-leo-jardim` | GK | 1 | F | i1 | A | C | A |
| 32 (55) | Gabriel Pereira | `vas-gabriel` | CB | 3 | G | i1 | A | B | A |
| 30 | Robert Renan | `vas-r-renan` | CB | 4 | F | k1 | A | A | A |
| 6 | Lucas Piton | `vas-l-piton` | SB | 1 | F | i1 | A | A | A |
| 31 (96) | Paulo Henrique | `vas-p-henrique` | SB | 3 | F | k1 | A | B | A |
| 5 | Santiago Sosa | `vas-sosa` | DH | 1 | F | i1 | A | C | A |
| 23 | Thiago Mendes | `vas-t-mendes` | DH | 4 | F | k1 | A | B | A |
| 22 | Alan Lescano | `vas-lescano` | OH | 1 | F | i1 | A | B | A |
| 19 | Bruno Duarte | `vas-b-duarte` | CF | 1 | F | i1 | A | A | A |
| 9 | Facundo Colidio | `vas-colidio` | WG | 1 | F | i1 | B | A | A |
| 11 | Andrés Gómez | `vas-a-gomez` | WG | 4 | E | k1 | A | A | A |
| 13 | Daniel Fuzato | `vas-fuzato` | GK | 1 | F | i1 | A | C | A |
| 29 (37) | Pablo | `vas-pablo` | GK | 2 | F | i1 | A | A | A |
| 4 | Alan Saldivia | `vas-saldivia` | CB | 1 | F | i1 | B | B | B |
| 27 (46) | Carlos Cuesta | `vas-cuesta` | CB | 4 | F | k1 | A | A | A |
| 2 | Puma Rodríguez | `vas-puma` | SB | 1 | F | i1 | H | A | A |
| 26 (66) | Cuiabano | `vas-cuiabano` | SB | 4 | E | i1 | H | A | A |
| 3 | Tchê Tchê | `vas-tche-tche` | DH | 4 | E | o1 | A | B | A |
| 8 | Jair | `vas-jair` | DH | 3 | F | i1 | A | C | A |
| 25 (88) | Cauan Barros | `vas-barros` | DH | 3 | F | i1 | H | A | A |
| 24 (83) | Ramon Rique | `vas-r-rique` | OH | 4 | E | i1 | A | A | A |
| 10 | Johan Rojas | `vas-johan-rojas` | OH | 2 | E | i1 | A | A | A |
| 17 | Nuno Moreira | `vas-nuno-moreira` | WG | 1 | E | i1 | B | A | A |
| 28 | Adson | `vas-adson` | WG | 2 | E | i1 | A | B | A |
| 18 | Marino Hinestroza | `vas-hinestroza` | WG | 4 | E | k1 | A | A | A |
| 7 | David | `vas-david` | WG | 3 | F | i1 | H | A | A |
| 20 | Brenner | `vas-brenner` | CF | 3 | F | i1 | A | B | A |
| 21 (77) | Claudio Spinelli | `vas-claudio-spinelli` | CF | 1 | F | i1 | H | A | A |

## SAN — Santos

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Diógenes | `san-diogenes` | GK | 4 | F | i1 | A | B | A |
| 32 (42) | João Alencar | `san-j-alencar` | CB | 4 | F | i1 | A | A | A |
| 14 | Luan Peres | `san-luan-peres` | CB | 1 | F | i1 | B | C | B |
| 31 | Gonzalo Escobar | `san-escobar` | SB | 1 | E | i1 | A | A | A |
| 23 | Rodinei | `san-rodinei` | SB | 4 | F | i1 | A | C | A |
| 28 | Christian Oliva | `san-oliva` | DH | 1 | F | i1 | A | B | A |
| 8 | Gabriel Bontempo | `san-bontempo` | SH | 1 | E | i1 | A | A | A |
| 11 | Philippe Coutinho | `san-coutinho` | SH | 2 | E | k1 | A | B | A |
| 10 | Neymar | `san-neymar` | OH | 2 | E | i1 | A | B | A |
| 9 | Gabriel Barbosa | `san-gabigol` | CF | 1 | F | i1 | H | C | A |
| 7 | Everton Cebolinha | `san-cebolinha` | CF | 2 | E | k1 | A | B | A |
| 29 (77) | Gabriel Brazão | `san-g-brazao` | GK | 1 | F | i1 | A | A | A |
| 27 (34) | João Paulo | `san-joao-paulo` | GK | 3 | F | i1 | A | C | A |
| 4 | Lucas Veríssimo | `san-verissimo` | CB | 1 | G | i1 | A | B | A |
| 26 | João Ananias | `san-joao-ananias` | CB | 3 | F | i1 | A | A | A |
| 3 | Vinicius Lira | `san-vini-lira` | SB | 1 | F | i1 | H | A | A |
| 18 | Igor Vinícius | `san-igor-vinicius` | SB | 2 | E | i1 | A | B | A |
| 15 | Willian Arão | `san-w-arao` | DH | 3 | F | i1 | A | B | A |
| 5 | João Schmidt | `san-j-schmidt` | DH | 1 | F | i1 | A | B | A |
| 17 | Gustavo Henrique | `san-g-henrique` | DH | 2 | F | i1 | A | A | A |
| 6 | Arthur | `san-arthur` | DH | 1 | F | i1 | B | B | B |
| 25 | Gabriel Menino | `san-gabriel-menino` | DH | 2 | F | i1 | A | B | A |
| 30 | Miguelito | `san-miguelito` | OH | 2 | E | i1 | A | A | A |
| 16 | Thaciano | `san-thaciano` | OH | 2 | F | k1 | A | C | A |
| 22 | Álvaro Barreal | `san-barreal` | SH | 1 | E | i1 | A | A | A |
| 21 | Moisés | `san-moises` | WG | 2 | F | k1 | A | C | A |
| 24 (33) | Rony | `cam-rony` | WG | 3 | E | i1 | A | B | A |
| 20 (17) | Gustavo Caballero | `san-gustavo-caballero` | CF | 2 | F | i1 | A | B | A |

## RBB — RB Bragantino

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 18 | Tiago Volpi | `rbb-volpi` | GK | 1 | F | i1 | A | C | A |
| 4 | Alix Vinícius | `rbb-alix` | CB | 3 | G | i1 | A | A | A |
| 2 | Guzmán Rodríguez | `rbb-guzman` | CB | 2 | F | i1 | A | B | A |
| 29 | Juninho Capixaba | `rbb-capixaba` | SB | 2 | F | i1 | A | C | A |
| 31 (34) | Andrés Hurtado | `rbb-a-hurtado` | SB | 4 | F | i1 | A | A | A |
| 5 | Fabinho | `rbb-fabinho` | DH | 1 | F | i1 | B | A | A |
| 7 | Eric Ramires | `rbb-e-ramires` | DH | 4 | E | i1 | A | B | A |
| 21 | Lucas Barbosa | `rbb-l-barbosa` | OH | 3 | F | i1 | A | A | A |
| 8 | Eduardo Sasha | `rbb-sasha` | CF | 1 | F | i1 | B | C | B |
| 26 (47) | Wallace Yan | `rbb-w-yan` | WG | 2 | F | i1 | H | A | A |
| 11 | Fernando | `rbb-fernando` | WG | 4 | F | i1 | A | C | A |
| 1 | Cleiton | `rbb-cleiton` | GK | 1 | F | i1 | A | C | A |
| 25 (37) | Fabrício | `rbb-fabricio` | GK | 2 | F | i1 | A | B | A |
| 3 | Eduardo Santos | `rbb-eduardo-santos` | CB | 4 | G | i1 | A | A | A |
| 16 | Gustavo Marques | `rbb-g-marques` | CB | 4 | G | k1 | A | B | A |
| 23 | Agustín Sant'Anna | `rbb-agustin-sant-anna` | SB | 2 | E | i1 | A | B | A |
| 12 | Vanderlan | `rbb-vanderlan` | SB | 3 | F | i1 | A | A | A |
| 6 | Gabriel Girotto | `rbb-gabriel-girotto` | DH | 1 | F | k1 | A | C | A |
| 24 (35) | Matheus Fernandes | `rbb-m-fernand` | DH | 4 | F | i1 | A | C | A |
| 15 | Ignacio Sosa | `rbb-ignacio-sosa` | DH | 1 | E | i1 | B | A | A |
| 20 | Rodriguinho | `rbb-rodriguinho` | OH | 1 | F | i1 | B | A | A |
| 22 | Gustavo Neves | `rbb-gustavo-neves` | OH | 1 | E | i1 | A | A | A |
| 28 | Patrick | `rbb-patrick` | OH | 3 | F | k1 | A | A | A |
| 27 | Davi Gomes | `rbb-davi-gomes` | OH | 2 | E | i1 | A | A | A |
| 32 | José Herrera | `rbb-jose-herrera` | OH | 2 | F | i1 | A | A | A |
| 30 | Henry Mosquera | `rbb-mosquera` | WG | 4 | E | k1 | A | A | A |
| 17 | Vinicinho | `rbb-vinicinho` | WG | 2 | E | i1 | A | A | A |
| 9 | Isidro Pitta | `rbb-pitta` | CF | 1 | F | i1 | G | C | C |

## CAP — Athletico-PR

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Mycael | `cap-mycael` | GK | 2 | F | i1 | A | B | A |
| 25 | Dantas | `cap-dantas` | CB | 4 | F | k1 | A | A | A |
| 32 (33) | Juan Felipe Aguirre | `cap-aguirre` | CB | 1 | F | i1 | A | A | A |
| 4 | Arthur Dias | `cap-a-dias` | CB | 1 | F | i1 | A | A | A |
| 14 | Luiz Gustavo | `cap-l-gustavo` | DH | 3 | F | i1 | A | A | A |
| 27 | Juan Portilla | `cap-portilla` | DH | 1 | F | i1 | B | A | A |
| 31 (37) | Lucas Esquivel | `cap-esquivel` | SH | 1 | E | i1 | A | A | A |
| 29 | Gastón Benavídez | `cap-benavidez` | SH | 1 | F | k1 | A | A | A |
| 18 | Kerwin Vargas | `cap-vargas` | OH | 3 | F | i1 | A | A | A |
| 9 | Kevin Viveros | `cap-viveros` | CF | 4 | G | k1 | A | A | A |
| 7 | Steven Mendoza | `cap-mendoza` | CF | 4 | F | k1 | A | C | A |
| 23 | Santos | `cap-santos` | GK | 2 | G | i1 | A | B | A |
| 30 (42) | Matheus Soares | `cap-matheus-soares` | GK | 3 | F | i1 | A | B | A |
| 22 | Carlos Terán | `cap-teran` | CB | 4 | G | k1 | A | A | A |
| 3 | Léo | `cap-leo` | CB | 4 | F | k1 | A | A | A |
| 12 | Gilberto | `cap-gilberto` | SB | 2 | F | i1 | A | C | A |
| 6 | Leonardo Derik | `cap-leonardo-derik` | SB | 3 | E | i1 | A | A | A |
| 26 | Claudinho | `cap-claudinho` | SB | 2 | E | i1 | A | A | A |
| 5 | Felipinho | `cap-felipinho` | DH | 2 | E | i1 | A | A | A |
| 16 | Jádson | `cap-jadson` | DH | 2 | F | k1 | A | C | A |
| 10 | Bruno Zapelli | `cap-zapelli` | OH | 1 | F | i1 | A | A | A |
| 8 | João Cruz | `cap-joao-cruz` | OH | 2 | E | i1 | A | A | A |
| 17 | Alejandro García | `cap-alejandro-garcia` | OH | 3 | F | k1 | A | A | A |
| 28 (53) | Dudu | `cap-dudu` | WG | 1 | E | i1 | A | A | A |
| 21 | Leozinho | `cap-leozinho` | WG | 3 | F | k1 | A | B | A |
| 24 (7) | Isaac | `cap-isaac` | WG | 3 | E | i1 | A | A | A |
| 19 | Jorge Rivaldo | `cap-jorge-rivaldo` | CF | 4 | F | i1 | A | A | A |
| 20 (50) | Renan Viana | `cap-renan-viana` | CF | 2 | F | i1 | A | B | A |

## MIR — Mirassol

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 22 | Walter | `mir-walter` | GK | 1 | F | m1 | A | C | A |
| 31 (34) | João Victor | `mir-j-victor` | CB | 2 | F | k1 | A | C | A |
| 3 | Willian Machado | `mir-w-machado` | CB | 1 | F | i1 | B | C | B |
| 6 | Reinaldo | `mir-reinaldo` | SB | 4 | F | k1 | A | C | A |
| 32 | Igor Formiga | `mir-i-formiga` | SB | 3 | F | i1 | A | B | A |
| 25 | Neto Moura | `mir-neto-moura` | DH | 2 | F | i1 | A | A | A |
| 27 | Denilson | `mir-denilson` | DH | 3 | F | k1 | A | B | A |
| 29 (33) | Eduardo | `mir-eduardo` | OH | 2 | F | i1 | A | C | A |
| 9 | André Luis | `mir-andre-luis` | CF | 1 | F | i1 | A | B | A |
| 28 (77) | Alesson | `mir-alesson` | WG | 2 | F | i1 | A | C | A |
| 26 (96) | Carlos Eduardo | `mir-c-eduardo` | WG | 4 | E | k1 | A | A | A |
| 23 | Alex Muralha | `mir-a-muralha` | GK | 2 | G | k1 | A | C | A |
| 24 (90) | Thomazella | `mir-thomazella` | GK | 1 | F | i1 | A | C | A |
| 2 | Lucas Oliveira | `mir-lucas-oliveira` | CB | 2 | F | i1 | A | B | A |
| 18 (44) | Gabriel Knesowitsch | `mir-gabriel-knesowitsch` | CB | 1 | F | i1 | A | C | A |
| 12 | Victor Luis | `mir-victor-luis` | SB | 2 | F | i1 | A | C | A |
| 20 | Daniel Borges | `mir-d-borges` | SB | 2 | F | i1 | A | C | A |
| 21 | José Aldo | `mir-jose-aldo` | DH | 1 | F | i1 | A | A | A |
| 5 | Japa | `mir-japa` | DH | 1 | E | i1 | B | B | B |
| 16 (80) | Wallisson | `cfc-wallisson` | DH | 2 | F | i1 | H | A | A |
| 7 | Shaylon | `mir-shaylon` | OH | 1 | F | i1 | A | B | A |
| 10 | Chico Kim | `mir-chico` | OH | 1 | E | i1 | A | A | A |
| 19 | Gustavo Silva | `mir-gustavo-silva` | WG | 1 | E | i1 | B | B | B |
| 17 | Fernandinho | `mir-fernandinho` | WG | 3 | F | i1 | A | C | A |
| 11 | Negueba | `mir-negueba` | WG | 3 | E | k1 | A | A | A |
| 30 | Bruno Santos | `mir-b-santos` | CF | 2 | G | i1 | A | C | A |
| 15 (99) | Zé Roberto | `mir-ze-roberto` | CF | 1 | F | i1 | A | C | A |
| 14 (95) | Edson Carioca | `mir-e-carioca` | CF | 2 | F | i1 | A | C | A |

## VIT — Vitoria

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Lucas Arcanjo | `vit-l-arcanjo` | GK | 2 | F | i1 | A | C | A |
| 25 | Cacá | `vit-caca` | CB | 4 | F | i1 | A | A | A |
| 32 (36) | Luan Cândido | `vit-l-candido` | CB | 3 | F | k1 | A | B | A |
| 31 (83) | Jamerson | `vit-jamerson` | SB | 3 | F | k1 | A | B | A |
| 30 (98) | Mateus Silva | `vit-m-silva` | SB | 3 | E | k1 | A | B | A |
| 29 (95) | Caíque Gonçalves | `vit-caique` | DH | 3 | F | k1 | A | B | A |
| 28 (44) | Gabriel Baralhas | `vit-baralhas` | DH | 1 | F | i1 | A | B | A |
| 6 | Emmanuel Martínez | `vit-martinez` | OH | 1 | F | i1 | A | C | A |
| 27 (91) | Renê | `vit-rene` | CF | 2 | F | i1 | A | A | A |
| 10 | Matheuzinho | `vit-matheuzin` | WG | 3 | E | i1 | A | B | A |
| 26 (33) | Erick | `vit-erick` | WG | 2 | E | i1 | A | A | A |
| 24 (35) | Alexandre Fintelman | `vit-alexandre-fintelman` | GK | 1 | G | i1 | A | B | A |
| 22 (71) | Yuri Sena | `vit-yuri-sena` | GK | 4 | F | k1 | A | A | A |
| 4 | Camutanga | `vit-camutanga` | CB | 2 | G | i1 | A | A | A |
| 5 | Riccieli | `vit-riccieli` | CB | 2 | F | i1 | A | C | A |
| 21 (43) | Edu | `vit-edu` | CB | 3 | G | i1 | A | B | A |
| 13 | Ramon | `vit-ramon` | SB | 4 | F | k1 | A | C | A |
| 2 | Emanuel Brítez | `vit-emanuel-britez` | SB | 1 | F | i1 | A | C | A |
| 8 | Tomás Pochettino | `vit-tomas-pochettino` | DH | 1 | F | i1 | B | A | A |
| 15 | Walace | `cru-walace` | DH | 4 | G | k1 | A | A | A |
| 20 (88) | Zé Vitor | `vit-ze-vitor` | DH | 2 | G | i1 | A | A | A |
| 16 | Rúben Ismael | `vit-ruben-ismael` | OH | 1 | F | i1 | A | C | A |
| 12 | Diego Tarzia | `vit-tarzia` | WG | 1 | E | i1 | B | A | A |
| 7 | Marinho | `vit-marinho` | WG | 4 | F | i1 | A | C | A |
| 11 | Osvaldo | `vit-osvaldo` | WG | 2 | E | i1 | A | A | A |
| 19 (79) | Renato Kayzer | `vit-r-kayzer` | CF | 1 | F | i1 | A | A | A |
| 23 | Fabrício Santos | `vit-fabricio-santos` | CF | 2 | G | i1 | A | B | A |
| 9 | Alex Bruno | `vit-alex-bruno` | CF | 2 | G | i1 | A | A | A |

## CFC — Coritiba

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Pedro Morisco | `cfc-p-morisco` | GK | 2 | F | i1 | A | A | A |
| 23 | Tiago Cóser | `cfc-t-coser` | CB | 1 | F | i1 | A | A | A |
| 31 (55) | Jacy | `cfc-jacy` | CB | 4 | G | k1 | A | B | A |
| 26 | Bruno Melo | `cfc-bruno-melo` | SB | 2 | F | i1 | A | C | A |
| 2 | Tinga | `cfc-tinga` | SB | 4 | F | i1 | A | C | A |
| 21 | Thiago Santos | `cfc-t-santos` | DH | 3 | F | k1 | A | C | A |
| 5 | Nicolás Fonseca | `cfc-n-fonseca` | DH | 1 | F | i1 | B | A | A |
| 10 | Josué | `cfc-josue` | OH | 1 | E | i1 | H | B | A |
| 32 | Pedro Rocha | `cfc-p-rocha` | CF | 2 | F | i1 | A | A | A |
| 30 (77) | Breno Lopes | `cfc-b-lopes` | WG | 2 | F | i1 | A | A | A |
| 19 | Sebastián Gómez | `cfc-s-gomez` | WG | 2 | E | i1 | A | A | A |
| 22 | Pedro Rangel | `cfc-p-rangel` | GK | 2 | F | i1 | A | A | A |
| 13 | Keiller | `cfc-keiller` | GK | 2 | F | i1 | A | B | A |
| 3 | Maicon | `cfc-maicon` | CB | 1 | F | k1 | B | B | B |
| 4 | Rodrigo Moledo | `cfc-r-moledo` | CB | 2 | G | m1 | A | C | A |
| 6 | Felipe Jonatan | `cfc-felipe-jonatan` | SB | 2 | F | i1 | A | C | A |
| 14 | Fabricio Bustos | `cfc-fabricio-bustos` | SB | 1 | E | i1 | A | B | A |
| 29 (36) | Vini Paulista | `cfc-v-paulista` | DH | 2 | F | i1 | A | C | A |
| 27 (39) | Gustavo | `cfc-gustavo` | DH | 1 | F | i1 | A | C | A |
| 25 | Richard | `cfc-richard` | DH | 2 | G | i1 | A | B | A |
| 7 | Joaquín Lavega | `cfc-joaquin-lavega` | OH | 1 | E | i1 | B | A | A |
| 11 | Lucas Ronier | `cfc-l-ronier` | WG | 3 | E | o1 | A | B | A |
| 17 | Brian Ocampo | `cfc-brian-ocampo` | WG | 2 | E | i1 | H | B | A |
| 20 | Keno | `cfc-keno` | WG | 4 | E | o1 | A | A | A |
| 28 | Fabinho | `cfc-fabinho` | CF | 3 | F | i1 | A | B | A |
| 24 (99) | Rodrigo Rodrigues | `cfc-rodrigo-rodrigues` | CF | 1 | G | i1 | A | C | A |
| 16 (78) | Renato Marques | `cfc-renato-marques` | CF | 3 | F | i1 | A | A | A |
| 18 | Paulo Roberto | `cfc-paulo-roberto` | CF | 2 | F | i1 | A | A | A |

## REM — Remo

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 32 (88) | Marcelo Rangel | `rem-m-rangel` | GK | 1 | F | i1 | A | C | A |
| 13 | Marllon | `rem-marllon` | CB | 4 | F | k1 | A | A | A |
| 29 | Zé Ivaldo | `rem-ze-ivaldo` | CB | 2 | F | k1 | A | B | A |
| 6 | Marlon | `rem-marlon` | SB | 1 | E | i1 | A | A | A |
| 31 (79) | Marcelinho | `rem-marcelinho` | SB | 2 | E | i1 | A | C | A |
| 28 | Zé Welison | `rem-z-welisson` | DH | 2 | F | k1 | A | C | A |
| 15 | Leonel Picco | `rem-picco` | DH | 1 | G | i1 | A | B | A |
| 8 | Patrick | `rem-patrick` | OH | 4 | F | k1 | A | C | A |
| 19 | Gabriel Taliari | `rem-taliari` | CF | 1 | F | i1 | A | C | A |
| 7 | Jajá | `rem-jaja` | WG | 4 | E | k1 | A | A | A |
| 26 | David Braga | `rem-d-braga` | WG | 4 | G | i1 | A | A | A |
| 30 (97) | Ivan | `rem-ivan` | GK | 2 | G | i1 | A | C | A |
| 27 (94) | Ygor Vinhas | `rem-ygor-vinhas` | GK | 2 | F | i1 | A | C | A |
| 18 | Duplexe Tchamba | `rem-duplexe-tchamba` | CB | 4 | G | k1 | A | A | A |
| 5 | Léo Andrade | `rem-leo-andrade` | CB | 1 | F | i1 | B | A | A |
| 4 | Matheus Felipe | `rem-matheus-felipe` | CB | 4 | G | k1 | A | A | A |
| 2 | João Lucas | `rem-joao-lucas` | SB | 3 | F | i1 | A | A | A |
| 25 (2) | Matheus Alexandre | `rem-matheus-alexandre` | SB | 4 | F | i1 | A | A | A |
| 24 (77) | Mayk | `rem-mayk` | SB | 1 | F | i1 | A | B | A |
| 23 (35) | Edson Fernando | `rem-edson-fernando` | DH | 2 | F | i1 | A | C | A |
| 20 (55) | Zé Ricardo | `rem-ze-ricardo` | DH | 3 | F | i1 | A | B | A |
| 10 | Jáderson | `rem-jaderson` | OH | 4 | F | i1 | A | A | A |
| 17 (15) | Vitor Bueno | `rem-vitor-bueno` | OH | 1 | F | i1 | A | B | A |
| 21 | Antonio Galeano | `rem-antonio-galeano` | WG | 2 | E | i1 | A | B | A |
| 22 | Yago Pikachu | `rem-yago-pikachu` | WG | 3 | E | i1 | A | B | A |
| 9 | Gabriel Poveda | `rem-gabriel-poveda` | CF | 1 | F | i1 | B | B | B |
| 16 (39) | Eduardo Melo | `rem-eduardo-melo` | CF | 4 | G | o1 | A | A | A |
| 14 (61) | Tico | `rem-tico` | WG | 3 | E | i1 | A | A | A |

## CHA — Chapecoense

| Camisa | Jogador | id | Pos | Pele | Físico | Cabelo | Cor | Barba | Cor barba |
|---|---|---|---|---|---|---|---|---|---|
| 32 (98) | Anderson | `cha-anderson` | GK | 3 | F | i1 | A | B | A |
| 25 | Victor Caetano | `cha-v-caetano` | CB | 2 | F | i1 | A | C | A |
| 3 | Eduardo Doma | `cha-e-doma` | CB | 1 | F | i1 | B | A | A |
| 28 (91) | Bruno Pacheco | `cha-b-pacheco` | SB | 2 | F | k1 | A | C | A |
| 20 | Bruno Tubarão | `cha-b-tubarao` | SB | 1 | F | i1 | A | A | A |
| 27 | Camilo | `cha-camilo` | DH | 1 | F | i1 | A | B | A |
| 24 (88) | Yago Felipe | `cha-y-felipe` | DH | 2 | F | k1 | A | C | A |
| 10 | Giovanni Augusto | `cha-g-augusto` | OH | 2 | F | i1 | A | A | A |
| 9 | Túlio Eduardo | `cha-tulio` | CF | 3 | F | i1 | A | A | A |
| 23 (77) | Dylan Borrero | `cha-dylan-borrero` | WG | 3 | E | i1 | A | A | A |
| 7 | Marcinho | `cha-marcinho` | WG | 2 | F | i1 | A | C | A |
| 14 | Gabriel Werner | `cha-gabriel-werner` | GK | 1 | G | i1 | B | A | A |
| 30 | Matheus Aurélio | `cha-matheus-aurelio` | GK | 1 | F | i1 | A | A | A |
| 4 | João Paulo | `cha-joao-paulo` | CB | 2 | F | i1 | A | C | A |
| 21 | Kauan | `cha-kauan` | CB | 2 | G | i1 | A | A | A |
| 26 | Everton | `cha-everton` | SB | 3 | F | i1 | A | A | A |
| 12 | Fernando | `cha-fernando` | SB | 3 | F | i1 | A | B | A |
| 5 | Heitor | `cha-heitor` | SB | 1 | F | i1 | A | C | A |
| 6 | Mancha | `cha-mancha` | SB | 1 | F | i1 | B | A | A |
| 17 | Vinicius Balieiro | `cha-balieiro` | DH | 3 | E | i1 | A | A | A |
| 18 (99) | Rafael Carvalheira | `cha-carvalhei` | DH | 1 | F | i1 | A | A | A |
| 19 | David Antunes | `cha-david-antunes` | DH | 1 | F | i1 | B | A | A |
| 22 | Max | `cha-max-alves` | OH | 4 | G | i1 | A | A | A |
| 16 (80) | Miguel Carvalho | `cha-miguel-carvalho` | OH | 1 | F | i1 | B | A | A |
| 8 | Robert | `cha-robert` | OH | 3 | F | i1 | A | B | A |
| 29 | Franco Rossi | `cha-franco-rossi` | WG | 1 | F | i1 | B | A | A |
| 31 | Maurício Garcez | `cha-mauricio-garcez` | CF | 4 | F | i1 | A | A | A |
| 15 (70) | Rubens | `cha-rubens` | WG | 1 | F | i1 | A | A | A |
