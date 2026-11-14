# 06 · Mercado, finanças, estádio e diretoria

Números são **propostas iniciais**, em `padroes.ts` / `regras.json`, cobertos por teste.

## Janelas

- Configuráveis no pacote: `regras.json`, `mercado.janelas` = lista de `{ "semana_inicio", "semana_fim", "nome"? }` (semanas da temporada, bordas incluídas). Padrão: **duas janelas**, "Início da temporada" (semanas 1-16) e "Meio do Brasileirão" (27-31).
- Editadas na aba **Janelas** do editor (linha do tempo com as competições do `temporada.json`; "Voltar ao padrão" tira a chave do `regras.json`). Valem para carreiras novas.
- Validação (`core/mercado/janelas.ts`): erro se o fim vem antes do início, se sai da temporada ou se duas janelas se sobrepõem; aviso se não há janela nenhuma ou se duas estão coladas.
- As notícias de abertura e fechamento citam o nome da janela.
- Fora da janela: só **jogadores livres** e **renovações**.

## Tipos de negócio (v1)

Compra, venda, **empréstimo** (com duração e divisão de salário), contratação de **livre**, **renovação**, pagamento de **multa rescisória** (o clube vendedor é obrigado a aceitar; o jogador ainda negocia salário). Troca (jogador + dinheiro) fica fora.

## Negociação

- Duas etapas: **clube** (valor/tipo) e depois **jogador** (salário, duração).
- Cada proposta ou contraproposta **do usuário** gasta **1 movimento**. O usuário tem **5 movimentos no total entre uma partida e outra do seu time**, somando todas as negociações. Acabou, só depois do próximo jogo.
- **Propostas recebidas** pelos jogadores do usuário **não gastam** movimentos (nem as respostas a elas).
- Resposta da IA vendedora:
  - pedida = valor de mercado × fator de importância (titular 1,4 · reserva 1,15 · encostado 1,0) × fator de porte do vendedor (pequeno vendendo para grande +10%).
  - oferta ≥ pedida → aceita · oferta ≥ 70% da pedida → contraproposta no meio do caminho (nunca abaixo da última contraproposta) · abaixo → recusa, e a pedida sobe 5% (paciência).
  - Uma negociação morre após 3 recusas seguidas.
- Resposta do jogador: aceita se salário ≥ salário atual × (1,1 se muda de clube) ajustado pelo porte do clube que compra e pela moral; contraproposta semelhante.

## Valor de mercado

Recalculado a cada janela (e mostrado sempre):

valor = 2 mi × 1,85^(geral − 12) × f_idade × f_potencial × f_contrato × f_serie

- f_idade: até 21 → 1,4 · 22-25 → 1,2 · 26-28 → 1,0 · 29-30 → 0,8 · 31-32 → 0,55 · 33+ → 0,3.
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
- Alvos: só jogadores que melhoram o grupo da carência (ou o titular mais fraco, se não houver carência), de clube de porte igual ou menor (pequena chance para cima), dentro da verba e do teto da folha. Elenco do vendedor nunca abaixo do mínimo; jogador emprestado não é revendido.

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
| Premiações | por competição e fase (tabela da competição) |
| Venda de jogadores | na conclusão |

| Despesa | Regra |
|---|---|
| Salários | mensais (a cada 4 semanas implícitas) |
| Estádio | custo fixo por jogo em casa |

- **Saldo negativo é permitido**: bloqueia contratações (exceto livres com salário dentro do orçamento) e aumenta a pressão da diretoria.
- **Orçamento de folha** e **orçamento de contratações** vêm do pacote e da diretoria (por temporada, ajustados pela dificuldade).
- Todos os valores iniciais são **preenchidos pelo usuário no editor** (times sem valor usam o padrão do porte).
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
