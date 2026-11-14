# Série C 2026: elencos e gerador

Gera os 20 times da Série C 2026 em `pacotes/brasil-2026/times/` (feito em 14/11/2026).

| Arquivo | O que é |
|---|---|
| `dados-ogol.json` | 26 jogadores por clube (3 goleiros + 23 de linha), tirados do ogol.com.br: elenco atual de 2026 e minutos jogados na Série C. Traz posição detalhada, pé, altura, nascimento, nacionalidade, camisa, jogos, gols e minutos. |
| `coletar.py` | Refaz o `dados-ogol.json` (precisa de internet; guarda as páginas em `.cache/`). |
| `kits.json` | Uniformes (titular, reserva e goleiro) no formato `kit.design`. São aproximações pelas cores do clube. |
| `montar.py` | Monta os `times/<SIG>.json`. Sem `--forcar`, não regrava time que já existe. Com `--forcar`, regrava só os 20 da Série C. |

```bash
python3 docs/we/elencos-serie-c-2026/montar.py pacotes/brasil-2026 [--forcar]
```

## Método

- Notas: mesmo método do `montar.py` da Série B (perfil por posição + tags, nível do WE 12-19 convertido para 3/7/9/…/19). O nível do jogador vem da força do clube e dos minutos jogados na Série C. A força do clube vem dos pontos na 1ª fase, com um bônus para quem foi bem no quadrangular. `AJUSTE = -0.2` deixa a Série C abaixo da B (média dos 11 melhores de 6,4 a 7,8; a B vai de 7,9 a 9,1).
- Titulares: a formação (`4-3-3B` se houver pelo menos 3 pontas entre os 16 mais usados, senão `4-4-2B`) é preenchida pelos jogadores com mais minutos em cada posição.
- Posição secundária deduzida da principal (CB→DH, SB→SH, DH→OH, OH→SH, WG→SH, CF→WG). Goleiro fica sem posição secundária.
- Finanças por porte: médio (PAY, STA, GUA, FIG) com saldo de R$ 5 mi, patrocínio de R$ 10 mi e orçamento de folha de R$ 1,5 mi/mês. Pequeno com R$ 2 mi, R$ 4 mi e R$ 600 mil/mês.
- Salários: titular R$ 60 mil (médio) ou R$ 30 mil (pequeno), reserva R$ 20 mil ou R$ 12 mil. Os dois variam com os minutos jogados. Contratos vencem entre 2026 e 2030.
- Estádio e capacidade: ficha do clube no ogol.
