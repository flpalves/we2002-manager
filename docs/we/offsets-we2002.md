# Mapa de RAM e VRAM: Winning Eleven 2002 (BR)

Versão da ISO: **SLPM-87056** (WE2002 japonês com tradução BR), `we2002.bin` com 474.784.128 bytes (Mode2/2352, faixa única).
Endereços em KSEG0 (`0x80xxxxxx`). Coordenadas de VRAM em halfwords (16 bits).
O raciocínio e as lições estão em [`APRENDIZADOS.md`](APRENDIZADOS.md).

Save state do PCSX-Redux (protobuf sem compressão): **RAM no campo `[3,1]`** (8 MB, os 2 primeiros são a RAM do PS1), **VRAM no campo `[5,3]`** (linhas de 2048 bytes).

## Estado do jogo

| Campo | Endereço | Observações |
|---|---|---|
| "estado" | `0x80075560` | ⚠️ **Não marca a tela**: vale 0x0E na seleção de times, na partida e nas telas finais. Visto no código comparado com 0x0D e 0x10 (talvez modo de jogo) |
| fase | `0x8007570E` | **Período atual**: 0 no 1º tempo, 1 no 2º, 3 na 2ª da prorrogação, 4 nos pênaltis. Vale 1 durante todo o 2º tempo e continua 1 no RESULT de um jogo decidido nos 90' |
| **cena** | `0x80076AA8` | **18** seleção/menus/pausa · **14** 1º tempo e intervalo · **12** 2º tempo (estável o tempo todo em 3 partidas) · 22 P.K. MATCH · 18 RESULT após pênaltis. **Depois do apito final: 0 (2 partidas) ou 13 (1 partida)** |
| ~~pós-jogo~~ | `0x80076713` = 1 e `0x8007530D` = 9 | ❌ **Falso positivo** (08/11, 21:54): iguais nos dois menus pós-jogo, mas numa 3ª partida `0x80076713` ficou em 1 o jogo todo e `0x8007530D` passou por 9 no 2º tempo → o emulador fechou no meio do jogo. Não usar |
| ~~fim de jogo~~ | `0x8007B8AC/AD`, `0x800649AB`, `0x80072A5F` | ❌ **Falso positivo**: viram "fim" no meio do 1º tempo. Não usar |

**Fim do 2º tempo (usado pela ponte)** = a partida já passou pela cena 12 e a cena vira **0 ou 13** com a fase em 1, por **4 leituras seguidas (~2 s)**. Lista fechada de propósito: se aparecer outro valor de fim, a ponte não fecha (resultado fica parcial; confirmar no app) e o `data/ponte.log` mostra o valor para incluir. Validado rodando `bridge/resultado.lua` sobre: a sequência de 68 dumps de uma partida inteira (cena → 0; final 2 s depois do apito, nunca antes), o 2º tempo inteiro sem fim (nunca dispara) e o menu pós-jogo da partida em que a cena terminou em 13. Depois do final a ponte fecha o emulador (`fechar_ao_final`, 10 s).

- Lição: **um sinal de fim precisa ser conferido contra partidas inteiras, não só contra as telas finais.** Dois candidatos (os riscados acima) passaram nas telas finais e falharam no meio de uma partida real.
- O dump `ram_20261108_194613` ("試合続ける / セレクトに戻る") **não é o menu pós-jogo**: é o menu de pausa/sair ("continuar a partida / voltar à seleção").
- Relógio da partida: **não achado**. Nenhum campo cresce linearmente dentro de cada tempo e zera no 2º. O valor 2700 (45×60) aparece fixo em vários endereços (`0x80053D00`, `0x800550C8`, `0x800550FA`, `0x80042A20`): provavelmente a duração do tempo em segundos de jogo, acessada por ponteiro.
- Contadores que sobem sempre (inclusive no intervalo): `0x8007EA19`, `0x80061C91`. Acumuladores que congelam no intervalo e no fim: 6 u32 em `0x80064520 + n*0x0C`.
- Dumps de referência: `dumps/auto/cmw8g8qw0-r1j1-mw8gbudu/` (68 dumps de uma partida inteira, `indice.csv` com seq, frame, fase, gols, rótulo, hora) e `dumps/auto/cmw8g8qw0-r2j1-mw8ikdql/001_f1_menu_pos_*.bin` (menu pós-jogo, cena 13). Dumps automáticos da ponte desligados por padrão (checkbox na janela da ponte). Log de resultado em `data/ponte.log`.

## Times da partida

| Campo | Endereço | Largura | Observações |
|---|---|---|---|
| time_casa | `0x80075564` | 1 | 41 = Brasil |
| time_visitante | `0x80075565` | 1 | 8 = Holanda, 9 = Suíça |

- Achado comparando dumps na seleção (Holanda → Suíça no visitante).
- Cópias que só existem na tela de seleção: `0x800F1B88`/`0x800F1B8A` (16 bits) e `0x80102AF0`/`0x80102AF5`.
- Valor padrão antes da seleção: 48 x 49 (Japão x Coreia).
- Escrever o ID no pré-jogo **não** troca o time: tarde demais.

### Tabela de times (ID = posição da bandeira na grade, 14 por linha, a partir de 0)

Confirmados: 8 Holanda, 9 Suíça, 41 Brasil. A base mestre confirma 42 = Peru.

| Linha | IDs | Bandeiras (ordem na tela) |
|---|---|---|
| 1 | 0-13 | Irlanda, Escócia, País de Gales, Inglaterra, Portugal, Espanha, França, Bélgica, **Holanda (8)**, **Suíça (9)**, Itália, Rep. Tcheca, Alemanha, Dinamarca |
| 2 | 14-27 | Noruega, Suécia, Finlândia, Polônia, Eslováquia, Áustria, Hungria, Eslovênia, Croácia, Iugoslávia, Romênia, Bulgária, Grécia, Turquia |
| 3 | 28-41 | Ucrânia, Rússia, Marrocos, Tunísia, Egito, Nigéria, Camarões, África do Sul, Senegal, EUA, México, Costa Rica, Colômbia, **Brasil (41)** |
| 4 | 42-55 | Peru, Chile, Paraguai, Uruguai, Argentina, Equador, Japão, Coreia, China, Irã, Arábia Saudita, Austrália, Euro Allstars (54), World Allstars (55) |

### Nomes dos times (texto)

Duas tabelas de ponteiros indexadas pelo ID do time; os textos (ASCII maiúsculo) ficam colados uns nos outros, alinhados a 4 bytes.

| Tabela | Ponteiros | Textos | Observações |
|---|---|---|---|
| 1 | `0x800BF0E8 + id*4` | ~`0x8007FC80`–`0x8007FF40` | nomes completos ("AFRICA DO SUL"). A área muda durante a partida |
| 2 | `0x8014D964 + id*4` | ~`0x80149A80`–`0x80149D00` | nomes curtos ("AFRI.S."). Os textos mudam durante a partida, os ponteiros não |

- Textos livres para reaproveitar (times que não usamos), 16 bytes cada: "WORLD ALLSTARS" (`0x8007FD48` / `0x80149B00`) e "EURO ALLSTARS" (`0x8007FD58` / `0x80149B10`).
- A ponte grava o nome do time nesses textos e aponta o ID 41/8 para eles (patch com guarda).
- Também existem nomes em japonês já desenhados na VRAM ("ブラジル", "オランダ") e um "Holland" em `0x80056034`. Em quais telas cada um aparece: a confirmar.

## Resultado da partida (mapeado em 07/11/2026)

Achado com dumps das telas P.K. MATCH e RESULT de duas partidas: 1 x 1 com pênaltis 3 x 4, e 2 x 0.

| Campo | Endereço | Formato |
|---|---|---|
| Gols da casa | `0x800755C4` | 32 registros de 4 bytes: **autor, assistência, minuto, 0**. Autor/assistência = vaga 0-22 do time. `FF FF FF 00` = vazio; assistência `FF` = sem assistência |
| Gols do visitante | `0x80075644` | idem (0x80 bytes depois) |
| Estatísticas | `0x800756F2` | pares (casa, visitante), 1 byte cada, nesta ordem: chutes, impedimentos, faltas, **desconhecido 1**, amarelos, **escanteios**, laterais, **desconhecido 2** |
| Gols totais | `0x80075702`/`0x80075703` | 1 e 1 no 1 x 1; 2 e 0 no 2 x 0 |
| Pênaltis (disputa) | `0x8007570C` (casa), `0x8007570D` (visitante) | 0 antes da disputa |

Exemplo real: casa `09 08 23 00` = Toninho (9), assistência de Valadares (8), aos 35'; visitante `08 09 12 00` = Aurelio (8), assistência de Cardoso (9), aos 18'.

- Na tela das bandeiras as tabelas de gols já estão vazias (`FF FF FF 00`) e as estatísticas zeradas.
- Os minutos são os da tela (tempo de jogo real). Período deduzido: até 45 = 1T, até 90 = 2T, até 105 = 1P, depois 2P.
- Estatísticas conferidas com as duas partidas (1ª: chutes 3x8, impedimentos 0x1, faltas 2x2, amarelos 0x1, laterais 3x2; 2ª: chutes 2x3, impedimentos 0x1, laterais 1x0, escanteios 0x1). Os dois "desconhecido" valeram 0 nas duas: um deles deve ser cartões vermelhos, o outro talvez pênaltis cometidos.
- **As estatísticas só ficam completas na tela final.** No intervalo, a área mostra os números do 1º tempo.
- Ainda não sabemos como aparece o **gol contra**, nem se cartões e lesões ficam por jogador.
- Placar por período (1st/2nd/1ex/2ex) não foi achado; dá para deduzir pelos minutos.
- **Gravação final pela ponte** (`bridge/resultado.lua`): no fim do 2º tempo (seção "Estado do jogo"). No modo `pontos_corridos` vale o placar dos 90' (gols até 90'), e também é gravado como final se a fase passar para a prorrogação (≥ 2). No `mata_mata`, empate no fim do 2º tempo fica parcial.

## Base mestre (todos os times, 23 jogadores por time)

> ⚠️ Durante a partida o jogo reaproveita parte dessa área para carregar código (ex.: tela de substituição).
> Patches só podem escrever enquanto a área tiver os dados originais.

### Nomes

- Base `0x80055FF8`, registro de **10 bytes** (ASCII, preenchido com 0x00), 230 bytes (`0xE6`) por time.
- Endereço = `0x80055FF8 + id_time*0xE6 + n*10`.
- Conferidos: Given (time 0, n=0) `0x80055FF8`; Marcos (Brasil, n=0) `0x800584CE`; Overmars (Holanda, n=10) `0x8005678C`.
- Terceira cópia não explicada: `0x80059144` (Kluivert), `0x8005919E` (Rivaldo).

### Registro do jogador (12 bytes = w0, w1, w2 little-endian) — **completo (11/11/2026)**

- Base `0x800A5124`. Endereço = `0x800A5124 + (id_time*23 + n)*12`.
- Atributos mapeados desmontando o painel de atributos (`0x80153D28`; formatação em `0x801596E4`: soma 12, laranja a partir de 17). Aparência, posição, idade, AGREC e outside mapeados com o monitor do menu de edição (ver "Buffer do menu de edição").
- Atributos: **3 bits**, exibido = bruto + 12 (faixa 12 a 19). Nomes na tela de edição (BR): ATAQU, DEFESA, EQUILI., FOLE, VELOC., ACELE., PAS, CHU.F., CHUTE M., PULO, CABECI., TECN., DRIBLE, CURV, AGREC., REFLE., OUTSIDE.
- **Gravação:** desde 11/11 a ponte (`bridge/we2002.lua`) e os cheats do DuckStation (`tools/gerar-cheats.mjs`, tabela em `tools/lib/registro.mjs`) gravam todos os campos abaixo a partir do arquivo do time (`data/times/*.json`): `posicao`, `pe`, `idade`, `outside`, `atributos` (incl. `AGR`) e `aparencia` { `pele` 1-4, `fisico`, `cabelo`, `cor_cabelo`, `barba`, `cor_barba`, `chuteira` }. Campo ausente = mantém o original.

| Campo | Word | Bit inicial | Bits | Observações |
|---|---|---|---|---|
| **Posição** | w0 | 0 | 3 | **0 GK · 1 CB · 2 SB · 3 DH · 4 SH · 5 OH · 6 CF · 7 WG** (ordem do menu) |
| (constante) | w0 | 3 | 1 | vale 0 nos 1.288 jogadores |
| **Cabelo** | w0 | 4 | 5 | 0 a 31 = 32 modelos do menu de edição (tabela abaixo) |
| **Cor do cabelo** | w0 | 9 | 3 | 0 a 7 = cores A a H |
| (constante) | w0 | 12 | 1 | vale 0 nos 1.288 jogadores |
| **Barba** | w0 | 13 | 3 | 0 a 6 = opções A a G (A = sem barba) |
| (constante) | w0 | 16 | 1 | vale 0 nos 1.288 jogadores |
| **Cor da barba** | w0 | 17 | 3 | 0 a 6 = cores A a G |
| Altura | w0 | 20 | 6 | cm = valor + 148 |
| **Camisa** | w0 | 26 | 5 | valor = número - 1 (só 1 a 32) |
| **Outside** | w0 | 31 | 1 | **1 = SIM, 0 = NÃO**. Vale 1 nos 1.288 jogadores da base (todos têm outside); o jogador novo do menu vem com 0 |
| **Pele** | w1 | 0 | 2 | 0 = mais clara … 3 = mais escura |
| **Físico** | w1 | 2 | 3 | 0 = A (mais magro) … 7 = H (mais forte) |
| **Idade** | w1 | 5 | 5 | **idade = valor + 15** (valores 3 a 23 na base = 18 a 38 anos) |
| RESPONSE (REFLE.) | w1 | 10 | 3 | |
| (constante?) | w1 | 13 | 1 | vale 0 nos 1.288 jogadores; não mudou ao editar |
| BODY BAL. (EQUILI.) | w1 | 14 | 3 | |
| STAMINA (FOLE) | w1 | 17 | 3 | |
| DRIBBLE | w1 | 20 | 3 | |
| SPEED (VELOC.) | w1 | 23 | 3 | |
| ACCEL. (ACELE.) | w1 | 26 | 3 | |
| OFFENSE (ATAQU) | w1 | 29 | 3 | |
| DEFENSE | w2 | 0 | 3 | |
| SHOOT PWR. (CHU.F.) | w2 | 3 | 3 | |
| SHOOT ACC. (CHUTE M.) | w2 | 6 | 3 | |
| PASS ACC. (PAS) | w2 | 9 | 3 | |
| TECHNIQUE (TECN.) | w2 | 12 | 3 | |
| HEAD. ACC. (CABECI.) | w2 | 15 | 3 | |
| JUMP PWR. (PULO) | w2 | 18 | 3 | |
| CURVE (CURV) | w2 | 21 | 3 | |
| **AGRESSIVIDADE (AGREC.)** | w2 | 24 | 3 | 16º atributo (não aparece no painel de atributos da partida). Na base 13 a 19; alto em atacantes (Owen, Shevchenko 19), baixo em volantes/goleiros (Roy Keane 14, Kahn 15) → agressividade **ofensiva** |
| **Chuteira** | w2 | 27 | 3 | 0 a 7 = chuteiras A a H |
| **Pé** | w2 | 30 | 2 | **0 = destro, 1 = canhoto, 2 = ambidestro** |

**Posição (w0 bits 0-2)**: conferida na base — vaga 0 dos 56 times = GK; Brasil: Marcos GK, Edmilson/Lúcio CB, R. Carlos/Cafu SB, Emerson DH, Rivaldo OH, Ronaldo CF; Holanda: Kluivert/Van Nistelrooy CF, Overmars/Zenden WG. Uso na base: GK 165, CB 240, SB 150, DH 163, SH 134, OH 159, **CF 260**, **WG 17** (o WE2002 quase não usa pontas).

**Cabelo (w0 bits 4-8)**: valor → modelo na ordem do menu de edição:

| 0 a1 | 1 a2 | 2 a3 | 3 b1 | 4 b2 | 5 b3 | 6 b4 | 7 b5 |
|---|---|---|---|---|---|---|---|
| **8 b6** | **9 c1** | **10 c2** | **11 d1** | **12 d2** | **13 e1** | **14 e2** | **15 f1** |
| **16 f2** | **17 f3** | **18 g1** | **19 h1** | **20 i1** | **21 i2** | **22 i3** | **23 j1** |
| **24 k1** | **25 l1** | **26 l2** | **27 l3** | **28 m1** | **29 n1** | **30 o1** | **31 p1** |

- Conferido na base: **k1 = raspado** (R. Carlos, Ronaldo, Stam, Barthez, Thuram, Beckham, Mboma), **o1 = dreads** (Davids, Seedorf), **m1** = Zidane. Mais usados: i1 (336 jogadores), a1 (254), i2 (140), l3 (134).

**Cor do cabelo (w0 bits 9-11)**: 0 A · 1 B · 2 C · 3 D · 4 E · 5 F · 6 G · 7 H. Na base: **A = preto** (Nigéria quase inteira, Thuram, Cafu; 487), **B = castanho** (672), **H = loiro** (Nedved, Kahn, De Boer, Shevchenko, escandinavos, Inamoto; 119), **G** só no Ljungberg (vermelho). C, D, E, F quase não usadas.

**Barba (w0 bits 13-15)**: 0 A · 1 B · 2 C · 3 D · 4 E · 5 F · 6 G. Na base: **A = sem barba** (1.177); B (26: Seaman, Vampeta…), C (55: Gattuso, Barthez, Makelele…), E (6: Kluivert, Trezeguet), F (21: Ashley Cole, Mihajlovic, Yepes…), G (3). D sem uso.

**Cor da barba (w0 bits 17-19)**: 0 A … 6 G. Na base só A (1.038), B (239), C (2), D (9). O único loiro barbudo (P. Müller, cabelo H) tem barba **C** → numeração diferente da do cabelo (C da barba deve ser o loiro). Confirmar visualmente.

**Físico (w1 bits 2-4)**: 0 A (magro) … 7 H (forte). Na base: A 197, D 13, E 323, F 582, G 156, H 17 (B e C sem uso). H: R. Carlos, Chilavert; G: Davids, Kahn, Roy Keane.

**Idade (w1 bits 5-9)**: idade = valor + 15, conferida com ~25 jogadores (Seaman 23 → 38, Chilavert 21 → 36, Hierro 19 → 34, Beckham 12 → 27, Buffon 9 → 24, Owen 7 → 22); diferença máxima de 1 ano para a idade real em 2002.

**Pele (w1 bits 0-1)** conferida na base: Nigéria inteira = 3; Davids, Kluivert, Seedorf = 3; Stam, De Boer = 0; H. Nakata, Hong Myung-Bo = 1.

**Chuteira (w2 bits 27-29)**: 0 A … 7 H. Na base: **A = padrão** (1.101); B 88 (Gerrard, Rui Costa…), C 12, D 19 (Roy Keane, Recoba…), E 4, F 8 (Ronaldo, Cocu…), G 4, H 52 (Beckham, Giggs, Davids, Barthez…).

Gabarito usado (valores da tela):

| Jogador | Pé | Altura | OFF | DEF | BAL | STA | SPD | ACC | RES | JMP | HEAD | TEC | PASS | SHPW | SHAC | DRI | CURVE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Marcos (0) | Right | 193 | 13 | 17 | 18 | 13 | 15 | 15 | 18 | 16 | 13 | 14 | 14 | 16 | 13 | 13 | 12 |
| Edmilson (1) | Right | 185 | 14 | 17 | 17 | 17 | 16 | 15 | 16 | 16 | 16 | 16 | 15 | 16 | 15 | 15 | 12 |
| Lucio (2) | Right | 188 | 15 | 17 | 17 | 17 | 17 | 16 | 16 | 17 | 17 | 16 | 15 | 17 | 16 | 16 | 13 |
| Roque Jr (3) | Both | 186 | 14 | 16 | 17 | 17 | 16 | 15 | 15 | 17 | 17 | 16 | 15 | 16 | 15 | 16 | 12 |

### Buffer do menu de edição

- O menu de edição de jogadores **não escreve na base mestre enquanto se edita**: trabalha num buffer de 2 times x 23 em **`0x8007DF60`** (mesmo formato de 12 bytes; mesma ordem do buffer da partida). O jogador em edição apareceu no registro 0.
- **Tela de atributos**: usa outro array, em **`0x800E96C8`**: 1 byte por linha na ordem da tela (ATAQU, DEFESA, EQUILI., FOLE, VELOC., ACELE., PAS, CHU.F., CHUTE M., PULO, CABECI., TECN., DRIBLE, CURV, AGREC., REFLE.: valor bruto 0-7; depois OUTSIDE 0/1). O registro só é montado no buffer ao **sair da tela de atributos**.
- Ferramenta: `bridge/edicao.lua` (seção "Monitor de edição de jogadores" na janela da ponte) compara base mestre, nomes e o buffer a cada 30 frames e loga cada mudança bit a bit em `data/edicao.log`, já com o nome de todos os campos conhecidos. Botão "Marcar + dump da RAM" salva dumps em `dumps/edicao/`.
- Método: mudar **um campo por vez**, ~1 s entre passos, dando a volta completa no campo. Anotar o nome exato do campo no menu antes de mudar. Conferir a ordem dos valores com jogadores reais da base (pegou a troca CF/WG). Se o monitor não mostrar nada, a tela usa outra cópia: fazer um dump com valores conhecidos e procurar a sequência na RAM (foi assim que a tela de atributos foi achada).
- Ainda não verificado se/como o buffer é copiado para a base mestre ao confirmar a edição.

## Buffer da partida (2 times, 23 + 23)

Preenchido a partir da base mestre ao confirmar a seleção. **Não escrever a cada frame**: trava as substituições.

| Campo | Endereço | Formato |
|---|---|---|
| Nomes | `0x80064570` | 16 bytes por jogador; casa e depois visitante (V.Der Sar em `0x800646E0`) |
| Registros (atributos etc.) | `0x80065A58` | 12 bytes, mesmo formato da base mestre (V.Der Sar em `0x80065B6C`) |
| Camisas | `0x80064970` (casa), `0x80064987` (visitante) | 1 byte por jogador, valor = número - 1 |
| ⚠️ Tabela `0x800649F8` | u16 por vaga: byte baixo = vaga, byte alto = ID do time (ex.: `09 29` = vaga 9 do Brasil) | **Não é o elenco**: escrever nela quebrou o contador de substituições ("SUBSTITUIR –"). Não escrever |

Bytes entre `0x80064949` e `0x8006496F` (valores 0x2D–0x78): talvez condição física. A investigar.

## Texto e letreiros

- Texto do painel de atributos montado em `0x8015F140` (ASCII, gerado na hora; não é a origem).
- Letreiros dos nomes: **pré-renderizados na VRAM** em 4 bits, página a partir de x=512, y=0, ao confirmar a seleção. Alterar o ASCII depois não muda a tela.

## Bandeiras na VRAM (mapeado em 07/11/2026)

Bandeira dos dois times da partida (placar, tela de substituição, barra da seleção de times). Vem compactada do CD direto para a VRAM: **não passa pela RAM**.

| Lado | Imagem | Paleta (16 cores) |
|---|---|---|
| casa (Brasil) | x=560, y=0, **64x28**, 4 bits | x=144, y=507 |
| visitante (Holanda) | x=560, y=28, 64x28, 4 bits | x=144, y=505 |

- Paletas: cor 0 = `0x0000` (transparente); as demais com o bit 15 ligado.
- Referências das originais em `kits/bandeiras/ref_<lado>.bin` e `ref_<lado>_paleta.bin`.
- Na tela de seleção, o mesmo espaço guarda as bandeiras dos times escolhidos (idênticas às da partida).
- A área de paletas `x=0-255, y=496-511` parece guardar as paletas de 16 cores de todas as bandeiras.
- Outras bandeiras: atlas das bandeiras pequenas (grade da seleção) em ~x=768-1023, y=256-511, 4 bits; **bandeira grande que tremula** (RESULT/P.K.) como vários quadros de animação em ~x=700-760, y=250-370. Nenhuma das duas está mapeada.

## Kits (uniformes) na VRAM

| Item | Posição | Observações |
|---|---|---|
| Página do kit do Brasil | x=576, y=256 | 8 bits, 128x256 texels (área usada 100x235). Cópia em `kits/brasil_pagina.bin` |
| Página do kit da Holanda | x=640, y=256 | Cópia em `kits/holanda_pagina.bin` |
| Páginas dos goleiros | x=704 e x=832, y=256 | Também têm fita de números |
| Paleta do Brasil | linhas 486 e 490, x=0 | 256 cores; cópia em `kits/brasil_paleta_vram.bin` |
| Paleta da Holanda | linhas 487 e 491, x=0 | Cópia em `kits/holanda_paleta_vram.bin` |
| Linhas 488/492 e 489/493 | x=0 | Outras paletas de 256 cores (goleiros?). A confirmar |

Layout da página (em texels):
- Costas numeradas: 10 de 20x24 a partir de (0,80), titulares 1 a 10, duas linhas de 5.
- Fita de algarismos: x=64+6·d, linhas 68-79, células 6x12, índices F0-F3 (degradê por linha), 0 = transparente.
- Um algarismo na coluna 7 da costa; dois nas colunas 3 e 11; linhas 7 a 18. Fora dos números, as 10 costas são idênticas.
- Regiões aproximadas: camisa frente (0,0-64,32), calção (0,32-64,64), pele/cabeça (64,0-100,64), mangas (0,64-64,80), meião (0,128-32,208), laterais (32,128-64,235), detalhes (64,128-100,160).
- No Brasil, 135 índices da paleta são usados fora do uniforme; sobram **121 livres** para um kit desenhado.

O kit não fica na RAM durante a partida e não aparece cru no CD (compactado). Os arquivos convertidos (`kits/convertidos/<lado>_*.bin`) são gerados a partir do `partida.json`: o `run-pcsx.bat` roda `tools/converter-kit-ps1.mjs` antes de cada partida (desde 08/11).

## DuckStation: substituição de texturas

- `config.yaml` do jogo com `DumpTexturePages: true` (modo página).
- Nome: `texpage-P8-<hash>-<hash paleta>-128x256-<x>-<y>-<w>x<h>-P0-255.png`.
- Hash: XXH3 64 bits sobre as linhas do retângulo na VRAM (8 bits → `w` bytes por linha). Paleta: XXH3 das 256 entradas.
- Hashes de paleta: Brasil `1BFCF65E8602C2B8`, Holanda `C7107C20E7CBEB89`.
- Kits originais: Brasil `36B8884BF3418FCE` (100x213), Holanda `FB51BCCDD47CF405` (100x213). Brasil com a camisa 22: `417CE7DCDB659844` (100x235).
- Goleiros: `texpage-P8-3A732094BE2845F0-CF7615AAF8F102A2-...-80x128-P0-243.png` e `texpage-P8-7429EB1141129545-DEAFB7ED35BFC35A-...-80x128-P0-243.png`.
- Cada arquivo é testado pelo hash do seu retângulo e vários se aplicam na mesma página: geramos topo (0,0 100x80), base (0,128 100x107) e cada costa (20x24) para as camisas 0 a 99 (1002 arquivos por kit).
- Executável: `D:\duckstation\duckstation-qt-x64-ReleaseLTCG.exe` (configurado no `run-duckstation.bat` em 08/11).

## Diário

- 2026-11-03: IDs dos times; tabelas de nomes; escrever no pré-jogo não funciona; nomes desenhados na VRAM; primeiro nome injetado (Edmilson → Felipe); camisas e tabela `0x800649F8` no buffer; atributos mapeados pela desmontagem.
- 2026-11-03: estado base passou a ser a tela das bandeiras; início automático com a ponte apertando ○.
- 2026-11-03/04: DuckStation: dumps em modo página, kits por substituição, cheats a partir do `partida.json`.
- 2026-11-04: hash do DuckStation reproduzido e validado; kits em pedaços (substituições dinâmicas); camisa achada na base mestre.
- 2026-11-04: travamento nas substituições: parar de escrever no buffer da partida; depois, guarda contra a base mestre virar código.
- 2026-11-04: kits desenhados (modelo 4x, HD no DuckStation); conversão para 8 bits e gravação na VRAM pelo PCSX-Redux (em teste).
- 2026-11-07: tabela de gols (autor, assistência, minuto), estatísticas e pênaltis achados nos dumps das telas P.K. MATCH e RESULT. `bridge/resultado.lua` lê tudo direto da RAM.
- 2026-11-07: goleiros levemente transparentes no PCSX-Redux com o kit PS1 ligado (causa ainda não isolada; as páginas e paletas dos goleiros não são escritas pela ponte).
- 2026-11-07: 2ª partida (2 x 0): escanteios vêm antes de laterais; `0x80075702/03` = gols totais.
- 2026-11-07 (noite): `0x80075560` vale 0x0E o tempo todo e a fase é o período atual → a detecção de fim de jogo estava errada. Fechamento automático e travamento do resultado desligados até mapear o fim.
- 2026-11-07 (noite): tabelas de nomes dos times (`0x800BF0E8`, `0x8014D964`); bandeiras da partida na VRAM (x=560, y=0/28, 64x28, paletas em y=507/505). `bridge/bandeiras.lua` + `tools/converter-bandeira.mjs` trocam a bandeira por PNG/JPG.
- 2026-11-08: kits sempre iguais entre partidas → o `run-pcsx.bat` passou a reconverter os kits antes de cada partida.
- 2026-11-08: o "final" no 2º tempo vinha do sinal antigo (0x0E + fase ≥ 1): a ponte passou a gravar só parcial até ter um sinal bom.
- 2026-11-08 (noite): candidatos a fim de jogo (`0x8007B8AC/AD`, `0x800649AB`, `0x80072A5F`) achados comparando dumps isolados. **Falharam na partida real**: o dump "pós-jogo" era o menu de pausa. A ponte ganhou dumps automáticos a cada 15 s com botões de marcação.
- 2026-11-08 (noite): com 68 dumps de uma partida inteira, cena `0x80076AA8` (14 no 1T, 12 no 2T, 0 após o apito). Gravação final + fechamento do emulador (10 s) ligados; dumps automáticos desligados por padrão.
- 2026-11-08 (noite): numa partida a cena terminou em **13** e nada fechou; tentei "pós-jogo" (`0x80076713`=1 e `0x8007530D`=9) e **deu alarme falso** na partida seguinte (fechou o emulador no 2º tempo, 0 x 0). Regra final: cena 12 → cena **0 ou 13** com fase 1 por 4 leituras (~2 s). Log em `data/ponte.log`.
- 2026-11-13: na 1ª partida de carreira (SPFC x Flamengo) a cena valeu **20 no 1T, 16 no 2T e 1 por ~12 s após o apito** (depois voltou a 16). Nunca passou por 12, então a ponte não gravou o final nem fechou o emulador. A cena **não é** um código de tela fixo. Saída no manager: "Encerrar com este placar" na tela No emulador (aceita o parcial do 2º tempo em diante). Sinal de fim de jogo continua em aberto.
- 2026-11-08 (noite): menu de edição trabalha no buffer `0x8007DF60`; **pele = w1 bits 0-1**. Monitor de edição (`bridge/edicao.lua`).
- 2026-11-11: **cabelo = w0 bits 4-8**, **cor do cabelo = w0 bits 9-11**, **barba = w0 bits 13-15**, **cor da barba = w0 bits 17-19**, **físico = w1 bits 2-4**, **idade = w1 bits 5-9 + 15**, **pé = w2 bits 30-31** (0 destro, 1 canhoto, 2 ambidestro), **chuteira = w2 bits 27-29**, **posição = w0 bits 0-2** (CF/WG trocados na 1ª anotação; corrigido pela base e pelo menu).
- 2026-11-11: tela de atributos usa o array `0x800E96C8` (achado procurando os valores do print num dump). Ao sair da tela: **AGREC = w2 bits 24-26** e **OUTSIDE = w0 bit 31** (0 → 1 com SIM; toda a base tem 1). **Registro de 12 bytes completo.**
- 2026-11-11 (noite): a ponte (`bridge/we2002.lua`) e os cheats do DuckStation (`tools/gerar-cheats.mjs` + `tools/lib/registro.mjs`) passaram a gravar o registro inteiro a partir dos times: posição, pé, idade, outside, AGR e aparência. Conferido que as duas implementações geram os mesmos bits. Editor de times no app do campeonato (aba Times) com todos esses campos.
