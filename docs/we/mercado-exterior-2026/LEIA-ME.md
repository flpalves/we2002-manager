# Disponíveis do exterior 2026: lista e gerador

Gera `pacotes/brasil-2026/exterior.json` (feito em 14/11/2026; lote 2 com mais 100 e lote 3 com mais 186 jogadores em 20/11/2026). Regras do jogo em `docs/spec/06-mercado-financas-diretoria.md`, "Jogadores sem clube"; formato do arquivo em `docs/spec/02-dados.md`.

| Arquivo | O que é |
|---|---|
| `jogadores.txt` | 486 jogadores (200 do lote 1, 100 do lote 2 e 186 do lote 3), uma linha cada: nome, nome_we, posição, secundária, ano de nascimento, nacionalidade, pé, altura, clube e país da liga de origem, geral alvo (1-20), tags, "validar". |
| `montar.py` | Monta o `exterior.json`: notas, potencial e taxa. Sempre regrava o arquivo inteiro. |

```bash
python3 docs/we/mercado-exterior-2026/montar.py pacotes/brasil-2026
```

Depois rode `docs/we/aparencia-gerada/gerar.py` (o `montar.py` grava sem aparência; o sorteio é pelo id, então os antigos voltam iguais).

## Critério da lista (lote 1)

- Jogadores que um clube brasileiro consegue contratar: brasileiros e sul-americanos em times médios da Europa (Portugal, Rússia, Ucrânia, Turquia, Espanha, Itália, Grécia, Bélgica), na MLS, no México, no Japão e em qualquer time da América do Sul. Alguns mexicanos, americanos, um japonês e dois portugueses.
- Fora: craques de nível mundial e quem ganha muito no clube atual (Arábia Saudita, Catar, salários de topo na Europa).
- Distribuição: GK 21 · CB 30 · SB 32 · DH 32 · OH 24 · WG 33 · CF 28. Nacionalidades: ARG 56, BRA 32, URU 25, COL 21, MEX 16, CHI 13, ECU 11, PAR 10, PER 6, VEN 4, POR 2, JPN 2, USA 2.
- **Clubes de referência: até meados de 2026**, sem conferir na internet jogador por jogador. A janela do meio do ano pode ter mudado alguns. `validar = 1` marca os 82 que podem ter mudado ou que pedem conferência. O clube só aparece como texto no jogo.
- Altura e pé: conhecidos para alguns; o resto usa a média da posição e destro (laterais esquerdos canhotos). Sem aparência (o WE mantém a do jogador original da vaga).

## Lote 2 (20/11/2026): acima dos melhores da Série A

- Pedido do Felipe: 100 nomes um pouco melhores que os melhores do Brasileirão, metade brasileiros e metade de países que costumam mandar jogador para o Brasil.
- Referência medida no pacote: os melhores da Série A têm geral de 17 a 18,7 (Arrascaeta 18,7; Arias, Neymar, Vitor Roque, Matheus Pereira e Léo Pereira 17,7). O topo do lote 1 era 17,9 (Gabriel Sara).
- Geral alvo de 17,5 a 19. Resultado: geral de 17,3 a 19,0 (mediana 17,9). Taxa de R$ 10,2 mi a R$ 132,25 mi (mediana R$ 61,2 mi).
- Aqui o critério do lote 1 se abre: entram titulares de clubes grandes da Europa e jogadores que ganham muito na Arábia e no Catar. Para isso o `FATOR_ORIGEM` ganhou `KSA` 1,0 e `QAT` 0,9. Craques de nível mundial de verdade (Vinícius Júnior, Raphinha, Rodrygo, Valverde, Enzo, Mac Allister, Lautaro, Julián Álvarez, Luis Díaz, Caicedo) continuam fora.
- Brasileiros (50): GK 4 · CB 8 · SB 5 · DH 8 · SH 3 · OH 6 · WG 7 · CF 9.
- Estrangeiros (50): ARG 20 · URU 11 · COL 9 · ECU 3 · PAR 2 · VEN 2 · POR 2 · CHI 1.
- Clubes de referência até meados de 2026, como no lote 1. `validar = 1` marca 33 que podem ter mudado na janela ou terminado contrato (Casemiro, Dybala, Suárez, Alexis, Otamendi, James e outros).
- Conferência feita antes de gerar: já estavam no pacote e ficaram fora Coutinho (SAN), Emerson Royal, Alex Sandro e Danilo (FLA), Renan Lodi, Lyanco e Bernard (CAM), Alex Telles e Arthur Cabral (BOT), Lucas Moura e Wendell (SPFC), Felipe Anderson e Ramón Sosa (PAL), Gabigol (SAN), Sinisterra (CRU), Sanabria (INT), Balbuena e Villasanti (GRE), Bobadilla (SPFC). Já estavam no lote 1: Montiel, Acuña, Walter Benítez, Pellistri, Quintero, Almirón, Enciso, Yeboah, Osorio, Marcelino Núñez, Rondón, Enner Valencia, Asprilla, Mojica, Paulo Díaz, Galarza, Abner.
- Homônimos: dois Ederson (o goleiro `EDERSON` e o volante da Atalanta `EDERSON J.`, id `ext-ederson`); dois Luis Suárez (o uruguaio `SUAREZ` e o colombiano `LJ SUAREZ`, id `ext-luis-javier-suarez`).

## Lote 3 (20/11/2026): brasileiros que faltavam e estrangeiros de nível médio

- Pedido do Felipe: os 100 melhores brasileiros que ainda estavam fora do jogo e 100 estrangeiros de nível médio de Série A ou B.
- Referência medida no pacote (geral dos 11 melhores de cada time): Série A com mediana 14,9 (25% a 75%: 14,1 a 16,0); Série B com mediana 12,1.
- **Brasileiros (86, não 100).** Entram os craques que o lote 2 deixou de fora (Vinícius Júnior, Raphinha, Rodrygo, Estêvão, Endrick) e os brasileiros de clubes médios da Europa, Rússia, Ucrânia, Turquia, Bulgária, Chipre, Arábia, Catar, Emirados, Japão, MLS e México. Parou em 86 porque, depois disso, os nomes já seriam palpite. Geral de 13,4 a 19,0 (mediana 14,8). Taxa de R$ 0,85 mi a R$ 132,25 mi (mediana R$ 8,4 mi).
- **Estrangeiros (100).** Geral alvo de 12,5 a 16, quase todos de clubes sul-americanos (River, Boca, Racing, Estudiantes, Vélez, Talleres, Lanús, Peñarol, Nacional, Atlético Nacional, Junior, Colo-Colo, Universidad de Chile, LDU, Universitario, Alianza, Bolívar) e alguns jovens argentinos na Europa (Soulé, Santiago Castro, Barco, Echeverri, Panichelli). Geral de 12,3 a 16,0 (mediana 14,0). Taxa de R$ 0,3 mi a R$ 27,2 mi (mediana R$ 3,15 mi). ARG 36 · COL 13 · URU 10 · CHI 8 · PAR 8 · ECU 8 · PER 6 · VEN 5 · MEX 4 · BOL 2.
- `FATOR_ORIGEM` ganhou `UAE` 0,9 · `CYP` 0,7 · `BUL` 0,7 · `BOL` 0,3 · `VEN` 0,3 (os dois últimos iguais ao `fator_valor` do `paises.json`).
- `validar = 1` marca 135 dos 186: aqui o clube de referência é menos seguro que nos lotes 1 e 2, sobretudo no Japão, no Oriente Médio, na Bulgária e nos clubes menores de Portugal e da Argentina.
- Conferência feita antes de gerar: já estavam no pacote e ficaram fora Fred (CAM), Rodinei, Lucas Veríssimo e Gabriel Brazão (SAN), Kaio César e Pedro Raul (COR), Fuzato, Thiago Mendes, Cuiabano e Robert Renan (VAS), Matheus Henrique (CRU), Weverton (GRE), Tetê (GRE), Iago e Pedro Lima (SPFC), Romarinho (CRI), Fábio Lima (JUV), Gustavo Scarpa e Vitor Bueno, e os estrangeiros Fabricio Bustos (CFC), Gabriel Rojas (CRU), Guido Herrera e Alejo Véliz (BAH), Alan Lescano e Hinestroza (VAS), Christian Oliva (SAN), Enamorado (GRE). Soteldo e Miguel Terceros ficaram fora porque o último clube conhecido é brasileiro.
- Homônimos: `NATAN`, `MARCAO`, `PEDRINHO`, `MARCINHO` e `CAIO VIDAL` também existem entre os livres (outras pessoas). `LUIS H.` (Inter) não é o `L.HENRIQUE` do Zenit.

## Conferência com os elencos do pacote (14/11/2026)

- Nenhum dos 200 está nos `times/*.json` do pacote (Séries A, B e C). Conferido por nome normalizado (sem acento) e por sobrenome + nacionalidade + idade.
- 24 da primeira versão já estavam em clubes do jogo e foram trocados: Andrew (FLA), Carlos Coronel (SPFC), Gabriel Paulista (COR), Robert Renan (VAS), Maripán (INT), Matías Viña (CRU), Moisés (SAN), Vitinho (BOT), Villagra (INT), Kevin Castaño (CAM), Lucas Romero (CRU), Marcos Antônio (SPFC), Santiago Sosa (VAS), Nardoni (GRE), Nicolás Fonseca (CFC), Claudinho (por garantia), Luciano Acosta (FLU), Gabriel Pec (CRU), Andrés Gómez (VAS), Cristian Olivera (BAH), Brian Ocampo (CFC), Jhon Arias (PAL), Colidio (VAS), Brenner (VAS).
- Homônimos que continuam (outra pessoa): Marlon (zagueiro, ex-Shakhtar; os do pacote são de outras posições), Dodô (lateral; o do VIL é meia), Wendel (meia; o do VRE é atacante de 23), Paulinho (português; os do pacote são brasileiros), Lucas Ribeiro (ponta; o do GOI é volante).
- Ao acrescentar jogador, rode a mesma conferência antes de gerar.

## Método

- Notas: mesmo perfil por posição e tags do `montar.py` da Série B/C (nível do WE 12-19 → 3/7/9/…/19). Para cada jogador, o nível é o que deixa o **geral** (pesos de `padroes.ts`) mais perto do **geral alvo** da linha. Tags automáticas: `cab` (≥ 189 cm), `baixo` (≤ 169), `vet` (33+), `vel` (WG/SB até 26), `cri` (OH), `mar` (DH).
- Geral alvo de 13 a 18: o nível dos titulares da Série A no pacote vai de 13 (CFC, REM) a 17,5 (FLA), e os melhores jogadores dos grandes chegam a 18. Os melhores do exterior ficam **acima da média dos titulares da Série A** (17-18, nível de titular de time grande); a maioria fica em 15-16. Distribuição: 13 → 1 · 14 → 19 · 15 → 84 · 16 → 60 · 17 → 32 · 18 → 4. Para subir ou descer alguém, mude o geral alvo na linha.
- Potencial: geral + folga por idade, como no `montar.py` da Série C.
- Taxa: valor de mercado com contrato longo e liga de Série A (`core/mercado/valor.ts`) × fator da liga de origem (`FATOR_ORIGEM`: Europa 1,2 · MEX 1,0 · USA/CAN 0,9 · JPN 0,85 · AUS/RSA 0,8 · CONMEBOL = `fator_valor` do `paises.json`). Resultado: de R$ 0,8 mi a R$ 73,5 mi, mediana R$ 9,85 mi.
