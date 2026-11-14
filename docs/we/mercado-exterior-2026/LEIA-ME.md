# Disponíveis do exterior 2026: lista e gerador

Gera `pacotes/brasil-2026/exterior.json` (feito em 14/11/2026). Regras do jogo em `docs/spec/06-mercado-financas-diretoria.md`, "Jogadores sem clube"; formato do arquivo em `docs/spec/02-dados.md`.

| Arquivo | O que é |
|---|---|
| `jogadores.txt` | 200 jogadores, uma linha cada: nome, nome_we, posição, secundária, ano de nascimento, nacionalidade, pé, altura, clube e país da liga de origem, geral alvo (1-20), tags, "validar". |
| `montar.py` | Monta o `exterior.json`: notas, potencial e taxa. Sempre regrava o arquivo inteiro. |

```bash
python3 docs/we/mercado-exterior-2026/montar.py pacotes/brasil-2026
```

## Critério da lista

- Jogadores que um clube brasileiro consegue contratar: brasileiros e sul-americanos em times médios da Europa (Portugal, Rússia, Ucrânia, Turquia, Espanha, Itália, Grécia, Bélgica), na MLS, no México, no Japão e em qualquer time da América do Sul. Alguns mexicanos, americanos, um japonês e dois portugueses.
- Fora: craques de nível mundial e quem ganha muito no clube atual (Arábia Saudita, Catar, salários de topo na Europa).
- Distribuição: GK 21 · CB 30 · SB 32 · DH 32 · OH 24 · WG 33 · CF 28. Nacionalidades: ARG 56, BRA 32, URU 25, COL 21, MEX 16, CHI 13, ECU 11, PAR 10, PER 6, VEN 4, POR 2, JPN 2, USA 2.
- **Clubes de referência: até meados de 2026**, sem conferir na internet jogador por jogador. A janela do meio do ano pode ter mudado alguns. `validar = 1` marca os 82 que podem ter mudado ou que pedem conferência. O clube só aparece como texto no jogo.
- Altura e pé: conhecidos para alguns; o resto usa a média da posição e destro (laterais esquerdos canhotos). Sem aparência (o WE mantém a do jogador original da vaga).

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
