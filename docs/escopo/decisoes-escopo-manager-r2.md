# WE2002 Manager: decisões de escopo (rodada 2 — 12/11/2026)

Continuação de [`decisoes-escopo-manager.md`](decisoes-escopo-manager.md). Quando houver conflito, vale esta rodada.

## Calendário e tempo
- Rodadas das competições **intercaladas automaticamente**; a ordem da temporada (estaduais, séries, copas) é **configurável no pacote**.
- Por trás existem **dias/semanas implícitos**: cada passo do calendário equivale a alguns dias, usados para recuperação física, lesões, suspensões, contratos e janelas (**tudo medido em semanas implícitas**).
- **Datas vazias** (competições em que o time não está ou de que já foi eliminado) também contam tempo e recuperação.
- "Continuar" avança **até o próximo jogo do time do usuário**, simulando tudo no caminho e parando em eventos importantes.
- Virada de temporada: relatório (campeões, acesso/rebaixamento, artilheiros), premiação e avaliação da diretoria, fim de contratos/renovações pendentes, sorteio das vagas e dos grupos das copas.

## Competições
- Estrangeiros: **os 9 outros países da CONMEBOL**, número de times por país **configurável no pacote**, elencos reais. Recebem o **mesmo tratamento dos brasileiros** (elenco, kits, escudo, podem ir para o WE contra o usuário).
- Libertadores e Sul-Americana em **formato simplificado** (grupos + mata-mata). Vagas brasileiras **configuráveis no pacote**.
- Estaduais principais: **SP, RJ, MG, RS**. Copas regionais para os demais: **configuráveis no pacote**.
- Estaduais/regionais incluem **times reais sem divisão nacional**, com elenco.
- **Série D** existe, com formato definido no pacote (motor de fases).
- **Todo time do pacote tem kit titular e reserva** e PNG de escudo.
- Suspensões **configuráveis por competição** (padrão: 3 amarelos = 1 jogo, vermelho = 1 jogo).

## Motor de partida
- Simulação **lance a lance por minuto**.
- Influenciam: **atributos e posição dos escalados** (fora de posição perde), **mando de campo e público**, **condição física e moral**. (Formação não entra como fator de encaixe; entrosamento entra via treino tático.)
- **Semente por carreira, reproduzível.**
- Lesões com **gravidade e tempo em semanas** (chance maior com condição baixa).
- **IA de substituições** em todos os jogos simulados (cansaço, lesão, cartão, placar).
- **IA de técnico** para os times da CPU: escolhe formação e os melhores disponíveis (condição, lesões, suspensões, rodízio).

## Jogadores
- Atributos: **os 15 do WE em escala 1-20** + do manager: **condição física, moral e potencial** (e a resistência oculta da rodada 1).
- Conversão 1-20 → níveis do WE (12-19) por **tabela no pacote de dados**.
- **Seta do WE** calculada pela **condição + moral**; **redução de atributos só com condição baixa** (proposta: <45% −1 nível, <30% −2).
- Condição: gasta com **minutos jogados × resistência oculta**, **idade** e **foco do treino**; recupera com os **dias implícitos** entre jogos.
- Moral: **resultados do time e desempenho pessoal**, **contrato** (renovação negada, salário, proposta recusada) e **notícias aleatórias**.
- Potencial visível como **faixa que estreita com a idade**.
- Posições: **as do WE** (GK, CB, SW, LB, RB, DH, LH, RH, OH, CF, LW, RW), exibidas em português.
- Formações: **só as do WE2002** (mapear a lista e a escrita na RAM).
- Convocação no jogo do usuário: **escolhe 11 + 12 reservas**, com sugestão automática.

## Treino
- Foco geral do time: **Físico / Técnico / Tático / Ataque / Defesa / Descanso**. Cada foco evolui um grupo de atributos e gasta ou recupera condição.
- **Tático** aumenta o **entrosamento com a formação atual** (bônus no motor; cai ao trocar de formação ou com muitos reforços).

## Finanças
- Receitas: **cota de TV** por série/competição, **patrocínio** fixo por temporada, **bilheteria** (público × preço), **premiações** e **vendas de jogadores**.
- Despesas: **salários mensais** + **custo do estádio** por jogo em casa.
- **Saldo negativo permitido**, com bloqueio de contratações e pressão da diretoria.
- Valores iniciais: **o usuário preenche no editor**.

## Mercado
- Janelas padrão: **início da temporada** e **meio do Brasileirão** (configuráveis).
- Valor de mercado por **fórmula** (atributos, idade, potencial, contrato, série), recalculado a cada janela.
- **5 movimentos de negociação no total entre uma partida e outra**, somando todas as negociações. Propostas recebidas pelos jogadores do usuário **não contam** nos movimentos.
- Intensidade da IA de mercado **configurável**.

## Diretoria
- Metas: **posição na liga** (título, G6, não cair, acesso), **fase mínima nas copas**, **finanças** (folha dentro do orçamento, saldo).
- Demissão: **aviso + escolher outro clube que queira o usuário** (porte menor ou igual, com vaga).

## Notícias aleatórias
- **Catálogo completo antes da v1**, mas especificado como **uma parte própria do projeto** (spec separada: gatilho, chance, efeito).

## Carreira e editor
- Nova carreira: **pacote de dados**, **clube (qualquer série)**, **nome do técnico**, **dificuldade** (orçamento, exigência da diretoria).
- Editor do pacote base na v1: **times** (nome, sigla, cores, escudo, kits, estádio, finanças), **jogadores** (todos os campos + aparência), **competições e fases** (motor de fases, desempates, vagas). Tabelas (conversão, calendário, janelas, notícias) ficam editáveis nos JSONs do pacote.

## Integração com o WE
- Mudanças feitas dentro do WE durante a partida são **livres**; o manager só lê o que importa.
- Mantém **`partida.json` / `resultado.json` + `.bat`**, com formatos versionados; caminhos nas configurações do app.
