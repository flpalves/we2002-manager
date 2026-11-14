# 04 · Motor de partida e IA de técnico

## Como cada partida pode ser decidida

| Modo | Quem decide | Origem gravada |
|---|---|---|
| `we` | o usuário joga no WE2002 (pad 1) | `resultado.json` |
| `cpu_cpu_we` | o WE joga CPU x CPU, o usuário assiste | `resultado.json` |
| `simulada` | motor próprio | motor (semente da partida) |
| `manual` | o usuário digita o placar (fallback) | usuário |

- Jogos do usuário: ele escolhe o modo no **pré-jogo**. Os outros são sempre simulados, mas o usuário pode pedir para assistir um jogo qualquer como CPU x CPU no WE.
- Se o emulador fechar ou o resultado não chegar: **jogar de novo**, **simular** ou **digitar o placar**. Resultado manual vem sem autores; o usuário pode marcar gols e autores, e o resto fica sem detalhe.

## Motor próprio: lance a lance por minuto

Simula os 90 minutos (mais acréscimos, prorrogação e pênaltis quando o formato pedir) e entrega: **placar, autores dos gols e assistências (com minuto), cartões, lesões, substituições e minutos jogados**. Não entrega nota nem narração (pode existir internamente para depuração).

### Entradas

- Os 11 titulares e reservas de cada time com: atributos 1-20, posição na formação, posição natural/secundária, condição, moral, resistência.
- Formação de cada time, entrosamento (0-100), mando de campo, público (ocupação do estádio).
- Regras da competição (substituições, prorrogação, pênaltis).
- `rng` derivado de `(semente da carreira, partida_id)`.

### Força por setor (a cada minuto)

1. **Atributo efetivo** de cada jogador = atributo × fator de posição × fator de condição × fator de moral.
   - Posição: natural 1,00 · secundária 0,92 · mesmo setor 0,85 · fora 0,70. GK fora do gol 0,40.
   - Condição em campo: começa na condição do pré-jogo e cai a cada minuto conforme resistência e FOLE; abaixo de 60% reduz o efetivo até −15%.
   - Moral: 0-100 → ±5%.
2. **Setores**: defesa, meio, ataque, a partir dos atributos relevantes de quem ocupa cada vaga (pesos em `padroes.ts`; ex.: meio usa PAS, TECN., DRIBLE, FOLE, DEFESA).
3. **Modificadores do time**: mando de campo +4% (+0 a +3% conforme ocupação do estádio), entrosamento −5% a +5%.

### Lances

A cada minuto:
1. Disputa de meio → quem tem a posse (probabilidade pela razão das forças de meio).
2. Chance de criar jogada perigosa: ataque do time com a bola vs. defesa do outro.
3. Se houver jogada, escolher o finalizador (peso por posição e ATAQU/finalização) e o possível assistente (PAS, TECN.).
4. Finalização vira gol pela comparação entre CHUTE M./CHU.F./CABECI. do finalizador e REFLE./DEFESA do goleiro.
5. Eventos de falta → cartão (AGREC. aumenta a chance) e, raramente, lesão (maior com condição baixa).

### Calibração (metas do teste em lote, 10.000 jogos entre times equilibrados)

| Métrica | Alvo |
|---|---|
| Gols por jogo | 2,4 a 2,7 |
| Empates | 24% a 28% |
| Vantagem do mandante | +0,25 a +0,35 gol por jogo |
| Amarelos por jogo | 4 a 5 |
| Vermelhos por jogo | 0,10 a 0,20 |
| Lesões por jogo (as duas equipes) | 0,15 a 0,35 |
| Time 2 níveis de geral acima | vence 55% a 65% |

Os números do motor ficam em `padroes.ts` / `regras.json` e o teste em lote falha se sair da faixa. Depois, recalibrar com os resultados reais do WE.

### Prorrogação e pênaltis

- Prorrogação de 2 × 15 com a condição já gasta.
- Pênaltis: 5 cobranças alternadas + alternadas até decidir; conversão base ~75% ajustada por CHUTE M. do batedor e REFLE. do goleiro. Ordem de batedores: IA escolhe os melhores finalizadores em campo.

## IA de técnico (times da CPU e sugestão para o usuário)

- **Formação**: a do time no pacote, trocada por outra **formação do WE2002** se faltarem jogadores de um setor (ganho ≥ `ia.ganho_troca_formacao`). A escolha usa a qualidade de ficha do elenco disponível (sem condição), para não mudar de jogo para jogo por cansaço.
- **Time base**: os melhores de ficha (com moral) em cada vaga, entre os disponíveis (sem lesionados e suspensos). Os melhores jogam sempre que não são poupados.
- **Rodízio controlado** (`src/core/partida/ia.ts`, parâmetros `ia.rodizio_*`):
  - Candidatos: titulares do time base com condição abaixo do limite da competição (`rodizio_limite`: liga 70, continental 70, copa 75, estadual 80). Se o próximo jogo for de uma competição mais importante, o limite sobe `rodizio_bonus_proximo_importante` (poupar no estadual para a Libertadores).
  - Só há rodízio com **jogos em sequência** (próximo jogo do time em até `rodizio_dias_sequencia` dias). Sem jogo logo em seguida, só é poupado quem está abaixo de `rodizio_critico`.
  - **Jogo decisivo** (final, ou o jogo que fecha um confronto de mata-mata): só o crítico, no máximo `rodizio_maximo_decisivo`.
  - Poupa do mais cansado para o menos, até `rodizio_maximo` por jogo (liga 2, continental 2, copa 3, estadual 4), e só enquanto a força do time no dia (com condição) não cair mais que `rodizio_perda_maxima` (o craque cansado joga se o reserva for muito pior). Só as vagas dos poupados mudam; o poupado vai para o banco.
  - A escalação devolve `poupados` (ids), para notícias e interface.
- **Convocação de 23**: 11 titulares + 12 reservas, pelo menos 2 GK.
- **Substituições** (todos os jogos simulados, inclusive o do usuário quando simulado): por lesão (imediata), por cansaço (condição em campo < ~55% a partir dos 55'), por cartão amarelo de risco, e ofensivas/defensivas conforme o placar após os 65'. Limite de substituições da competição (padrão **3**, igual ao WE2002, para jogos simulados e jogados seguirem a mesma regra).
- A mesma IA gera a **sugestão automática** da tela de escalação do usuário.
