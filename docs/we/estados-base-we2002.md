# Estados base (save states) por controle — 11/11/2026

Todos os estados param no mesmo ponto: **tela das bandeiras, Brasil (41, casa) x Holanda (8, visitante), antes de confirmar o visitante**. O que muda é a configuração de controle na seleção.

| id (`partida.json` → `controle`) | Arquivo em `states/` | Quem controla |
|---|---|---|
| `p1_cpu` | `amistoso.sstate` (o antigo) | Pad 1 = casa (Brasil), CPU = visitante |
| `cpu_p1` | `base_cpu_p1.sstate` | CPU = casa, pad 1 = visitante (Holanda) |
| `p1_p2` | `base_p1_p2.sstate` | Pad 1 = casa, pad 2 = visitante — **pausado (11/11)**: tirado do `config.json` → `estados`, o app não oferece mais. O arquivo e o código continuam; para voltar, readicionar `"p1_p2": "states/base_p1_p2.sstate"` |
| `cpu_cpu` | `base_cpu_cpu.sstate` | CPU x CPU (só assistir) |

Os 4 arquivos existem (os 3 novos criados em 11/11 ~21h). Conferido na RAM: os 4 têm casa 41, visitante 8, cena 18, fase 0.

## Como o app escolhe (`campeonato.js` → `escolherControle`)

- Opção explícita `p1_p2` ou `cpu_cpu` (select "2 jogadores" no card do seu jogo / botão "Assistir CPU x CPU" nos outros jogos), se o estado estiver disponível.
- Seu time é visitante e existe `base_cpu_p1` → `cpu_p1`, **sem inverter mando** (seu time entra na vaga da Holanda).
- Seu time é visitante e não existe `base_cpu_p1` → `p1_cpu` com mando invertido (comportamento antigo: seu time na vaga do Brasil e o placar é desinvertido ao gravar).
- Resto → `p1_cpu`.
- `config.json` → `estados` lista os arquivos; o app só oferece o que está listado e existe no disco (`estadosDisponiveis`).

## Ponte (`bridge/we2002.lua`)

- `ESTADOS_BASE` + autoload pelo `controle` do `partida.json`; se o arquivo faltar, cai no `amistoso.sstate` e loga.
- Seção "Início rápido (save state)": botões **Salvar/Carregar** por estado e status OK/falta.
- O início automático continua apertando ○ no pad 1 (a confirmar na prática para `cpu_p1`/`cpu_cpu`).

## Bytes de controle na RAM (comparando os 4 estados)

| Endereço | amistoso (P1xCPU) | CPUxP1 | P1xP2 | CPUxCPU | Leitura provável |
|---|---|---|---|---|---|
| `0x8007555F` | 1 | 2 | 1 | 0 | máscara de lados humanos (bit0 casa, bit1 visitante) |
| `0x800758DD` | 00 | 01 | 00 | ff | lado do pad 1 (0 casa, 1 visitante, ff nenhum) |
| `0x800758DE` | ff | ff | **01** | ff | lado do pad 2 |
| `0x800758E9`/`EA` | 00/ff | ff/00 | 00/ff | ff/ff | pad que controla casa / visitante |
| `0x800758EF`/`F3` | 0b/01 | 0b/0c | 0b/01 | ff/ff | ? |

- No P1xP2 o pad 2 está no lado visitante (`0x800758DE` = 1), mas a máscara (1) e `0x800758EA` (ff) ainda dizem "só a casa é humana". Hipótese: só são atualizados ao confirmar. Não testado (cenário pausado).
- Esses bytes permitiriam no futuro um único estado base com o controle escrito pela ponte (a validar).
