# 05 · Jogadores, condição, moral, treino e evolução

Todos os números abaixo são **propostas iniciais** e ficam em `padroes.ts` / `regras.json`, cobertos por teste.

## Atributos

- **16 atributos do WE** em escala **1-20**: ATAQU (OFF), DEFESA (DEF), EQUILI. (BAL), FOLE (STA), VELOC. (SPD), ACELE. (ACC), REFLE. (RES), DRIBLE (DRI), PAS (PAS), CHU.F. (SHP), CHUTE M. (SHA), TECN. (TEC), CABECI. (HEA), PULO (JMP), CURV (CUR), AGREC. (AGR). Mais o flag OUTSIDE (sim/não).
- **Só do manager**: condição física (0-100), moral (0-100), potencial (1-20, oculto) e resistência (1-20, oculta; quanto o jogador cansa).
- **Geral** (exibido): média ponderada dos atributos pelos pesos da posição (tabela em `regras.json`), arredondada.

### Conversão para o WE

- Tabela em `regras.json`: cada valor 1-20 → nível bruto do WE 0-7 (exibido 12-19). Padrão sugerido: 1-6 → 0 · 7-8 → 1 · 9-10 → 2 · 11-12 → 3 · 13-14 → 4 · 15-16 → 5 · 17-18 → 6 · 19-20 → 7.
- Aplicar a redução por condição **depois** da conversão (ver abaixo), sem passar de 0.

## Posições

- As **8 posições do WE2002**: GK, CB, SB, DH, SH, OH, CF, WG. Na interface: GOL, ZAG, LAT, VOL, MEI-LAT (SH), MEI, ATA, PON.
- Lado (esquerdo/direito) não é atributo do jogador: vem da **vaga da formação** (as formações do WE têm vagas LB/RB/LH/RH/LW/RW). Uma posição secundária por jogador.
- Formações: **só as do WE2002** (a lista completa precisa ser mapeada; hoje conhecidas 4-3-3B, 4-4-2A, 5-3-2).

## Condição física

- 0-100. **Gasto por partida** = minutos/90 × 28 × fator_resistência × fator_idade.
  - fator_resistência = 1,30 − 0,03 × resistência (1 → 1,27; 20 → 0,70).
  - fator_idade: até 23 → 0,95 · 24-29 → 1,00 · 30-32 → 1,10 · 33+ → 1,20.
- **Recuperação por dia implícito** = 7 × fator_recup_idade × fator_treino, até 100.
  - fator_recup_idade: até 23 → 1,15 · 24-29 → 1,00 · 30-32 → 0,90 · 33+ → 0,80.
  - fator_treino: Descanso 1,40 · Técnico/Tático 1,00 · Ataque/Defesa 0,90 · Físico 0,75.
- Datas vazias recuperam normalmente.
- **Redução no WE**: condição < 45% → −1 nível em todos os atributos injetados; < 30% → −2.

### Setas do WE

- Pontuação = 0,8 × condição + 0,2 × moral.
- ≥ 90 → ↑ ótima · 75-89 → ↗ boa · 60-74 → → normal · 45-59 → ↘ ruim · < 45 → ↓ péssima.
- A seta aparece na escalação, na convocação e na ficha. Ela é **escrita na RAM do WE** quando o endereço estiver mapeado (ver `07-integracao-we.md`); até lá, só a redução de atributos vai para o jogo.
- No motor próprio, a seta não tem efeito separado (condição e moral já entram no atributo efetivo).

## Moral

- 0-100, padrão 60, tende a voltar para 60 devagar (±1 por semana).
- **Sobe/desce** com: resultado do time (vitória +3, empate 0, derrota −3; clássico/final em dobro); desempenho pessoal (gol +2, assistência +1); contrato (renovação negada −15, proposta recusada pelo clube quando o jogador queria sair −10, aumento de salário +10); notícias aleatórias (efeito definido no catálogo).
- Efeito no motor: ±5% no atributo efetivo; efeito na seta (20% da pontuação).
- Tempo de jogo **não** afeta a moral na v1 (decisão da rodada 2).

## Potencial

- Oculto (1-20). Exibido como **faixa que estreita com a idade**: até 19 → ±3 · 20-22 → ±2 · 23-26 → ±1 · 27+ → valor exato. A faixa é gerada uma vez com a semente (não "pula" a cada tela).

## Treino

- **Um foco geral para o time**, vale até ser trocado: **Físico, Técnico, Tático, Ataque, Defesa, Descanso**.

| Foco | Atributos que evoluem | Condição | Risco de lesão | Outro efeito |
|---|---|---|---|---|
| Físico | VELOC., ACELE., FOLE, EQUILI., PULO | recupera menos | +30% | — |
| Técnico | PAS, DRIBLE, TECN., CURV | normal | normal | — |
| Tático | nenhum | normal | normal | **entrosamento +4 por semana** |
| Ataque | ATAQU, CHUTE M., CHU.F., CABECI. | um pouco menos | +10% | — |
| Defesa | DEFESA, REFLE. (GK), CABECI., AGREC. | um pouco menos | +10% | — |
| Descanso | nenhum | recupera mais | −50% | entrosamento −1 por semana |

### Entrosamento

- 0-100 por time, ligado à formação atual. Trocar de formação → cai para 50% do valor. Cada reforço novo no time titular → −3. Tático → +4/semana. Sem tático → −0,5/semana (mínimo 40).

## Evolução

- A cada semana implícita, para cada jogador e cada atributo do grupo do foco:
  - chance = 0,03 × max(0, potencial − atributo) / 5 × fator_idade_evol × fator_minutos.
  - fator_idade_evol: até 21 → 1,5 · 22-25 → 1,0 · 26-28 → 0,5 · 29+ → 0,1.
  - fator_minutos: jogou ≥ 60' na semana → 1,2 · entrou → 1,0 · não jogou → 0,7.
  - Sucesso: +1 no atributo (máximo = potencial).
- **Declínio** a partir dos 30 anos: chance semanal de −1 em atributos físicos = 0,008 × (idade − 29). (Na v1 a idade não avança; o declínio já existe para quem tem 30+.)
- **Notícias aleatórias** também podem mexer em atributos (ver `09-noticias-eventos.md`).

## Lesões

- Gravidade com tempo em **semanas implícitas**: leve 1-2 · média 3-6 · grave 8-30 (proporção ~70/25/5).
- Lesionado não pode ser convocado; volta com condição 70%.

## Dados extras do jogador (fora do motor do WE)

Idade, nacionalidade, posição secundária, contrato (salário, término, multa), valor de mercado (ver `06`), moral, histórico por temporada (jogos, minutos, gols, assistências, cartões).

## Aparência

Editável no manager já na v1 (ficha do jogador e editor do pacote): pele, físico, cabelo, cor do cabelo, barba, cor da barba, chuteira, altura, pé. Vai para o WE pela ponte.
