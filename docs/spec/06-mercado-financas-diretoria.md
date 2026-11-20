# 06 · Mercado, finanças, estádio e diretoria

Números são **propostas iniciais**, em `padroes.ts` / `regras.json`, cobertos por teste.

## Janelas

- Configuráveis no pacote: `regras.json`, `mercado.janelas` = lista de `{ "semana_inicio", "semana_fim", "nome"? }` (semanas da temporada, bordas incluídas). Padrão: **duas janelas**, "Início da temporada" (semanas 1-16) e "Meio do Brasileirão" (27-31).
- Editadas na aba **Janelas** do editor (linha do tempo com as competições do `temporada.json`; "Voltar ao padrão" tira a chave do `regras.json`). Valem para carreiras novas.
- Validação (`core/mercado/janelas.ts`): erro se o fim vem antes do início, se sai da temporada ou se duas janelas se sobrepõem; aviso se não há janela nenhuma ou se duas estão coladas.
- As notícias de abertura e fechamento citam o nome da janela.
- Fora da janela: só **jogadores livres** e **renovações** (os **disponíveis do exterior** só na janela). Depois do prazo de renovação, também **pré-contratos** (ver "Renovações e pré-contratos").

## Tipos de negócio (v1)

Compra, venda, **empréstimo** (com duração e divisão de salário), contratação de **livre**, contratação de **disponível do exterior**, **renovação**, **pré-contrato**, pagamento de **multa rescisória** (o clube vendedor é obrigado a aceitar; o jogador ainda negocia salário). Troca (jogador + dinheiro) fica fora.

## Renovações e pré-contratos

- **Prazo de renovação**: contrato que termina na temporada só renova até a semana `mercado.pre_contrato.semana_limite_renovacao` (padrão **46**). O aviso de contratos (semana 30) já diz o prazo. Contratos mais longos renovam a qualquer momento.
- **CPU**: na primeira data depois do prazo cada clube da CPU decide quem renova entre os definitivos que acabam (`virada.renovacao_cpu` pelo lugar no elenco, `fator_veterano`; renovado ganha `virada.temporadas_renovacao`, mesmo salário). Se a temporada acabar antes do prazo, a decisão sai na virada. Uma vez por temporada (`configuracao.renovacao_cpu_<temporada>`).
- **Em fim de contrato**: quem não renovou (CPU ou usuário), contrato definitivo, sem pré-contrato. Emprestado não entra (volta ao clube de origem).
- **Pré-contrato**: depois do prazo, clubes das **ligas nacionais** da temporada (A, B, C: competição `nacional`, pontos corridos, lista) assinam com quem está em fim de contrato de outro clube. Sem taxa; o jogador muda na **virada**, com o salário e a duração combinados (o contrato novo começa na temporada seguinte). Fica em `pre_contrato`.
  - **Usuário**: tipo de negócio "Pré-contrato" no Mercado (filtro "Fim de contrato"). Pula a etapa do clube, vai direto ao salário e à duração, gasta 1 movimento; o jogador aceita pelas regras de quem muda de clube. Conta no elenco da temporada seguinte (máximo `elenco_maximo`). Com saldo negativo, só com salário dentro do orçamento da folha (como um livre).
  - **CPU**: em cada data depois do prazo (a virada é a última), cada clube elegível busca `max(saídas × pre_contrato.por_saida, faltas do elenco projetado)` pré-contratos, até `pre_contrato.maximo` e o elenco máximo, espalhados pelas datas como as compras da janela. Alvo: o melhor para a carência mais grave do **elenco projetado** (quem fica + pré-contratos + emprestados que voltam), dentro do teto da folha e do limite do porte. **Jogadores do usuário também podem ser levados** (notícia); depois do prazo ele não pode mais renová-los.
- **Virada**: os pré-contratos mudam de clube (transferência `pre_contrato`, valor 0; saída `pre_contrato` em `saida_elenco`); quem a CPU não renovou sai livre; os do usuário não renovados saem livres, mas a diretoria renova por 1 temporada os que faltarem para o mínimo (23 e 2 goleiros).

## Jogadores sem clube

Dois tipos de jogador ficam no mercado sem pertencer a nenhum clube do jogo (`jogador.time_id` nulo):

| | **Livre** (`status = 'livre'`) | **Disponível do exterior** (`status = 'exterior'`) |
|---|---|---|
| De onde vem | fim de contrato na virada, rescisão; o pacote pode trazer livres iniciais (`livres.json`) | só do pacote (`exterior.json`): jogadores de clubes de fora do jogo que um clube brasileiro consegue contratar |
| Taxa | nenhuma | **fixa**, por jogador (`jogador.taxa_fixa`); não tem etapa do clube nem contraproposta |
| Salário | negociado com o jogador | negociado com o jogador |
| Quando | a qualquer momento | **só na janela** |
| Saldo negativo | permitido, com salário dentro do orçamento da folha | bloqueado (não há caixa para a taxa) |
| Conta como estrangeiro | pela nacionalidade | pela nacionalidade |

### Disponível do exterior

- Aparece no Mercado com o **clube e o país de origem** (texto informativo: "joga no Zenit (RUS)"), a **taxa** e a tag **Exterior**. O filtro "Sem clube" mostra livres e exterior; um filtro próprio mostra só o exterior.
- **Negociação**: pula a etapa do clube. O usuário aceita a taxa (gasta **1 movimento**) e vai direto para a etapa do jogador (salário, duração), como num livre. Se o jogador recusar 3 vezes, a negociação morre e a taxa não é cobrada.
- **Salário pedido** = salário de referência (clube que paga) × `exterior.premio_salarial` (padrão **1,15**: quem sai de fora quer ganhar mais para vir). O jogador aceita pelas mesmas regras de porte e moral de um livre.
- **Fechamento**: a taxa sai do caixa (`lancamento_financeiro`, categoria `transferencia`), o jogador recebe contrato definitivo, camisa livre (`camisaLivre`) e `status = 'ativo'`. A `transferencia` grava `de = NULL`, `tipo = 'exterior'`, `valor = taxa`, e a origem no texto. Notícia: "Fulano, ex-Zenit, chega ao Bahia".
- Sem caixa para a taxa, não dá para começar a negociação.
- **CPU**: os clubes da CPU também contratam do exterior, na janela, com o custo = taxa + `meses_custo_salario` de salário pedido, como qualquer alvo do plano. Clubes em crise não compram do exterior.
- **Valor da taxa**: vem pronto do pacote (o gerador usa a fórmula do valor de mercado, com contrato longo e liga de Série A, × fator da liga de origem). Na **virada**, cada disponível que sobrou tem a taxa recalculada pela nova idade: `taxa × f_idade(nova) / f_idade(antiga)`, arredondada para R$ 50 mil, e envelhece como os outros.
- **Saída do pool** (`exterior.saida_por_virada`, padrão **15%**): na virada, um sorteio tira parte dos que sobraram ("renovou com o clube dele lá fora"). Quem tem 35 anos ou mais sai com o dobro da chance. Saem do banco como `status = 'fora'` (não aparecem em busca nenhuma). Sem reposição na v1 (o pacote de uma temporada nova traz outra lista).
- Quem é contratado e depois sai do clube vira **livre** normalmente (não volta a ser do exterior).

### Elenco mínimo na semana 1

- Na geração da temporada (semana 1), todo clube que joga **alguma competição** (estadual, regional ou liga) com menos de `elenco_minimo` jogadores, ou com menos goleiros que o mínimo do grupo, puxa **livres** até completar. Um por clube por rodada, em ordem sorteada, pela carência mais grave; respeita o limite do porte. Salário = o de referência do clube.
- Contrato: quem joga **só estadual/regional** assina até o fim da temporada (contrato curto: na semana limite a CPU decide se renova, como qualquer contrato acabando); clube de liga nacional, `virada.temporadas_renovacao`.
- O clube do usuário só entra se estiver abaixo do mínimo (a diretoria completa; notícia).
- Clubes que não jogam nada na temporada não vão ao mercado (nem na semana 1 nem nas janelas).

### Limites por porte

- Toda contratação da CPU (janela, livres, exterior, pré-contrato, semana 1) respeita `mercado.limites_porte[porte do comprador]`: `salario_maximo` (salário mensal do negócio) e `geral_maximo` (o jogador "famoso"); 0 = sem limite. Padrão: **pequeno** até R$ 80 mil e geral 13; médio e grande sem limite. O usuário segue só as regras da negociação.
- Somam-se os limites pelo **nível** do comprador (`mercado.limites_nivel`, chave = nível): sem liga nacional até R$ 40 mil e geral 12 · Série D até R$ 60 mil e geral 13 · Série C até R$ 120 mil e geral 15 · B e A sem limite.

### Nível do clube

O porte sozinho não separa as divisões (174 dos 216 clubes do Brasil 2026 são pequenos, do LON da Série B ao clube sem liga). A hierarquia do mercado vem do **nível**: a liga nacional de maior nível que o clube joga na temporada (`mercado.nivel.liga`: A 5 · B 4 · C 3 · D 2; sem liga 1; estrangeiro 5). O porte só desempata dentro do mesmo nível. Código em `core/mercado/nivel.ts`.

- **Vendedor** (CPU): fora da lista de venda, **titular não sai para clube de nível menor**; reserva sai com ágio de `agio_rotacao` (1,3) por nível de diferença; encostado e quem está à venda, pela pedida normal. Clube de nível menor vendendo para o de cima pede +10% (`porte_vendedor_menor`).
- **Jogador**: para descer, pede (1 + `salario_por_nivel`) por nível — 30% por nível, no lugar do fator de porte menor. Titular ou reserva com menos de `idade_aceita_cair` (31) anos **recusa cair `queda_recusa` (2) níveis ou mais**; veterano e encostado aceitam pelo salário. Vale nas compras e pré-contratos da CPU e nas propostas pelos jogadores do usuário (o clube nem tenta); na negociação do usuário vale o salário (a recusa ainda não).
- **Comprador** (CPU): mira até a média dos seus titulares + `margem_alvo` (2) de geral, em compras, livres, exterior e pré-contratos — time de baixo não vai atrás de craque.
- Buscar fora da lista em clube de **patamar** maior (nível, depois porte) continua com `chance_porte_maior` por clube e data (a sortear por janela, em estudo).

### Livres

- Já funcionam como estão nesta spec (taxa 0, só salário, a qualquer momento). O pacote pode trazer **livres iniciais** em `livres.json` (mesmo formato do `exterior.json`, sem `origem` e `taxa`), para que a CPU tenha quem contratar quando todo elenco tem 23 (decisão 31).

## Negociação

- Duas etapas: **clube** (valor/tipo) e depois **jogador** (salário, duração).
- Cada proposta ou contraproposta **do usuário** gasta **1 movimento**. O usuário tem **5 movimentos no total entre uma partida e outra do seu time**, somando todas as negociações. Acabou, só depois do próximo jogo.
- **Propostas recebidas** pelos jogadores do usuário **não gastam** movimentos (nem as respostas a elas).
- Resposta da IA vendedora:
  - pedida = valor de mercado × fator de importância (titular 1,4 · reserva 1,15 · encostado 1,0) × fator de patamar do vendedor (nível menor vendendo para o de cima, ou porte menor no mesmo nível, +10%).
  - oferta ≥ pedida → aceita · oferta ≥ 70% da pedida → contraproposta no meio do caminho (nunca abaixo da última contraproposta) · abaixo → recusa, e a pedida sobe 5% (paciência).
  - Uma negociação morre após 3 recusas seguidas.
- Resposta do jogador: aceita se salário ≥ salário atual × (1,1 se muda de clube) ajustado pelo patamar do clube que compra (nível; ver "Nível do clube") e pela moral; contraproposta semelhante.

## Valor de mercado

Recalculado a cada janela (e mostrado sempre):

valor = 2 mi × 1,85^(geral − 12) × f_idade × f_potencial × f_contrato × f_serie

- f_idade: até 21 → 1,2 · 22-24 → 1,1 · 25-28 → 1,0 · 29-30 → 0,92 · 31-32 → 0,82 · 33-34 → 0,68 · 35 → 0,45 · 36 → 0,3 · 37 → 0,2 · 38+ → 0,12. A queda é suave enquanto o jogador ainda tem anos de carreira e acelera a partir dos 35.
- f_potencial: 1 + 0,10 × max(0, potencial − geral).
- f_contrato, pelas **semanas restantes** de contrato (cálculo em `02-dados.md`): ≤ 26 → 0,5 · ≤ 52 → 0,75 · mais → 1,0.
- f_serie: A 1,0 · B 0,6 · C 0,35 · D 0,2 · estrangeiro: fator do país em `paises.json`.

## IA de mercado (clubes da CPU)

Números em `padroes.ts` → `mercado.ia` (sobrescrevíveis no `regras.json`). Código em `core/mercado/` (`perfil.ts`, `plano.ts`, `ia.ts`).

### Perfil financeiro

Calculado na abertura de cada janela, pelo saldo (em meses de folha) e pela folha comparada ao orçamento:

| Perfil | Regra | Contrata | Vende |
|---|---|---|---|
| **crise** | saldo < 0 ou folha > 125% do orçamento | só livres e empréstimos, dentro do orçamento da folha | põe à venda os maiores salários e os mais valiosos até a folha caber no orçamento |
| **apertado** | saldo < 2 meses de folha ou folha > 105% do orçamento | oportunidades: ganho de geral por custo (preço + 12 meses de salário); livres e jogadores à venda pesam a favor | excedentes |
| **rico** | saldo ≥ 6 meses de folha e folha dentro do orçamento | o maior geral que cabe na verba | excedentes |
| **equilibrado** | o resto | geral, com o custo como desempate forte | excedentes |

Verba da janela = fração do saldo pelo perfil (rico 60% · equilibrado 45% · apertado 25% · crise 0), mais parte do que vender durante a janela (reinvestimento 70/50/30/0%). Teto da folha = orçamento × (1,15 · 1,05 · 1,0 · 1,0).

### Plano de janela

Na primeira data de cada janela, cada clube da CPU recebe um plano (gravado em `plano_janela`):

- **Grupos de posição** para contar elenco: gol (GK), zaga (CB), lateral (SB), volante (DH), meia (OH, SH) e ataque (CF, WG), cada um com mínimo e ideal.
- **Carências** (lista ordenada): grupo abaixo do mínimo, grupo abaixo do ideal, titular do grupo bem abaixo da média do time.
- **Chegadas-alvo** = base + peso × carências + peso × saídas, × fator do perfil × intensidade (baixa 0,6 · média 1 · alta 1,4), arredondado com sorteio e limitado:
  - janela principal (a primeira da temporada): base 2, média de 3 a 5, de 1 a 7;
  - outras janelas: base 0, de 0 a 3.
  - **Saídas** = quem saiu por fim de contrato na virada (`saida_elenco`) e, nas outras janelas, a previsão de quem sai no fim da temporada. Quem perde muitos jogadores repõe um número parecido.
  - Cada venda durante a janela que deixa um grupo abaixo do ideal soma uma reposição ao alvo.
- As compras se espalham pelas datas: em cada data a chance é (alvo − feitas) / datas restantes na janela.
- Alvos: só jogadores que melhoram o grupo da carência (ou o titular mais fraco, se não houver carência), até a média dos titulares + 2, de clube de patamar igual ou menor (pequena chance para cima), dentro da verba, do teto da folha e das regras de nível (vendedor e jogador). Elenco do vendedor nunca abaixo do mínimo; jogador emprestado não é revendido. Quem já mudou de clube na temporada (vindo de outro clube, livre ou do exterior) não é comprado de novo pela CPU até a virada.

### Lista de venda e saídas

- Todo jogador pode estar **à venda** (`jogador.a_venda` com o motivo): `excedente`, `financeiro`, `emprestimo` (jovem sem espaço, sai emprestado) ou `usuario`.
- Na abertura da janela a CPU refaz a lista dela: em cada grupo, quem passa do ideal na ordem de geral fica sem espaço. Jovens (até 21) vão para empréstimo; os outros, para venda. Clubes em crise somam os maiores salários e os mais valiosos.
- **Depois de cada chegada**, o grupo é reavaliado: quem perdeu espaço vai para a lista, mesmo que tenha geral alto. Isso libera folha e caixa.
- Jogador à venda: pedida com desconto (15%; 25% se o vendedor está em crise), vale também para o usuário. O usuário pode pôr os seus à venda no Mercado, e eles atraem mais propostas.
- Empréstimo entre clubes da CPU: taxa (`taxa_emprestimo` × valor), salário pago por quem recebe, até o fim da temporada (a virada devolve).

### Propostas pelos jogadores do usuário

- **Interesse real**: um clube da CPU só faz proposta se tem carência no grupo do jogador (ou se ele vira titular lá) e se tem verba. Pesam a favor estar à venda (×3), contrato acabando (×1,5) e ser jovem.
- **Volume por janela**: entre 1 e 2 propostas no mínimo (se alguém tiver interesse) e até 10, crescendo com o número de jogadores do usuário que interessam a alguém. Espalhadas pelas datas da janela.
- Oferta pelo perfil do comprador (rico 95-125% do valor · equilibrado 85-110% · apertado 75-95%; jogador à venda 80-100%). Cada proposta tem um **teto oculto** (rico 140% · equilibrado 120% · apertado 105%, limitado pela verba).
- **Contraproposta (1 rodada)**: o usuário pede um valor. Até o teto, a CPU aceita e o negócio fecha. Até 15% acima do teto, ela **cobre parte**: oferece o teto e o usuário só pode aceitar ou recusar. Acima disso, **desiste**.
- Prazo de 2 semanas (e nunca depois do fim da janela). Um clube recusado não volta pelo mesmo jogador na mesma janela. Não gastam movimentos.
- Notícias: transferências concluídas ("Cruzeiro contrata…", só as 3 mais caras de cada data, `noticias.transferencias_por_data`; a lista completa fica em Transferências), propostas recebidas, clube em crise pondo jogadores à venda, jogador que perde espaço com uma chegada e clube que vai repor muitas saídas.

## Finanças (intermediárias)

| Receita | Regra |
|---|---|
| Cota de TV | por série/competição, paga em parcelas a cada 4 semanas |
| Patrocínio | valor fixo por temporada (do pacote), em parcelas |
| Bilheteria | por jogo em casa = público × preço do ingresso |
| Premiações | por competição, no fim dela: cota de participação para todos + prêmio por colocação final (`premiacao.participacao` e `por_posicao`, editados na aba Competições do editor) |
| Venda de jogadores | na conclusão |

| Despesa | Regra |
|---|---|
| Salários | mensais (a cada 4 semanas implícitas) |
| Estádio | custo fixo por jogo em casa |

- **Saldo negativo é permitido**: bloqueia contratações (exceto livres com salário dentro do orçamento) e aumenta a pressão da diretoria.
- **Orçamento de folha** e **orçamento de contratações** vêm do pacote e da diretoria (por temporada, ajustados pela dificuldade).
- Todos os valores iniciais são **preenchidos pelo usuário no editor** (times sem valor usam o padrão do porte; saldo e orçamento da folha × o fator da divisão inicial).
- **Orçamento pela divisão** (`financas.orcamento_divisao`: A 1 · B 0,85 · C 0,6 · D 0,45 · sem liga 0,4): o saldo inicial e o orçamento da folha do padrão do porte são multiplicados pelo fator da divisão de quem não traz finanças no pacote. Na **virada**, quem sobe ou desce (o usuário também) tem o orçamento da folha × fator novo / fator antigo. O **patrocínio não muda** (a folha mínima de um elenco não cai com a divisão; cortá-lo deixava os clubes sem liga no vermelho) e o saldo também não. A migração 016 aplica o fator às carreiras em andamento (só quem ainda tinha a folha padrão do porte, fora o usuário).
- Extrato: cada lançamento vira uma linha em `lancamento_financeiro`.

## Estádio e público

- Capacidade e custo por jogo (pacote); **preço do ingresso** ajustável na tela de Finanças.
- Público = capacidade × min(1, demanda), com
  demanda = base_porte × f_momento (posição e últimos 5 jogos) × f_adversario (porte/clássico) × f_competicao × f_preco,
  f_preco = 1,15 − preço / preço_referência_do_porte (limitado entre 0,15 e 1).
- O público entra no motor (vantagem de mando) e na bilheteria.

## Diretoria

- **Metas por temporada**: posição na liga (título, G-N, não cair, acesso), fase mínima em cada copa, finanças (folha dentro do orçamento, saldo não negativo). Geradas pelo porte, pela série e pela dificuldade.
- **Confiança** 0-100: começa em 60; ajusta a cada jogo (resultado vs. expectativa pela força relativa), a cada meta atingida/perdida e com saldo negativo.
- **Demissão** quando a confiança fica abaixo do limite da dificuldade (fácil 10 · normal 20 · difícil 30) por 2 avaliações seguidas (avaliação a cada 4 semanas) ou ao falhar uma meta crítica na virada.
- Demissão **não encerra o jogo**: aviso + lista de **clubes que queiram o usuário** (porte menor ou igual, com técnico demitido ou vaga aberta). O usuário escolhe e a carreira continua no novo clube. Sem propostas, os clubes de porte menor da série abaixo entram na lista.

## Dificuldade (ao criar a carreira)

Ajusta: orçamento inicial (±25%), exigência das metas e limite de confiança. A agressividade da IA de mercado é a **intensidade** (Configurações, por carreira).
