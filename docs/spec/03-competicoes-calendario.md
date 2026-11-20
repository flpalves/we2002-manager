# 03 · Competições e calendário

## Tempo: passos e semanas implícitas

- A temporada é uma sequência de **passos**. Cada passo é uma "data" com, no máximo, um jogo por time.
- O calendário é **montado automaticamente** intercalando as rodadas das competições segundo a ordem de `temporada.json` (estaduais e regionais no começo, séries depois, copas e continentais intercaladas no meio da semana).
- Cada passo tem uma **duração implícita em dias** (padrão: fim de semana → meio de semana = 3 dias; meio de semana → fim de semana = 4 dias; passo sem jogo de ninguém pode valer 7). A soma vira a **semana implícita** usada por lesões, suspensões em semanas, contratos, janelas, salários (a cada 4 semanas) e notícias.
- **A temporada tem duração fixa** de `semanas_por_temporada` semanas implícitas (padrão **52**, em `padroes.ts`). A semana atual vai de 1 a 52. O calendário de jogos precisa caber nesse total (teste obrigatório); as semanas que sobram depois do último jogo são o **recesso**, que passa de uma vez na virada de temporada (recuperação de condição, contratos vencendo, salários das semanas restantes).
- **Datas vazias** contam: se o time não joga num passo (não está na competição ou foi eliminado), recupera condição e o tempo passa igual.
- O usuário aperta **Continuar**: o tempo avança **uma semana**, mesmo sem jogo nenhum nela. As datas da semana são jogadas; se o jogo do seu time cai nela, o Continuar para antes dele e abre o pré-jogo. Os efeitos semanais (treino, salários, avaliação da diretoria, janelas, eventos da semana) correm uma vez por semana, com ou sem jogo: `carreira.semana_processada` guarda a última semana que já correu e `carreira.dia_atual`, o dia em que os elencos estão (ver `01-arquitetura.md`).

### Datas e `temporada.json` (implementado na fase 2)

- Cada semana implícita tem **duas datas**: meio de semana (quarta, dia 2 da semana) e fim de semana (domingo, dia 6), em `padroes.ts` (`calendario.dia_meio`, `calendario.dia_fds`). Fim de semana → meio = 3 dias; meio → fim de semana = 4 dias. Só as datas com algum jogo viram **passo**; a semana de cada passo sai do dia.
- `calendario.descanso_minimo_dias` (padrão 2): dois jogos do mesmo time precisam de mais que isso entre eles.
- `temporada.json`:

```jsonc
{ "blocos": [
  { "competicao": "estadual", "datas": "fds", "semana_inicio": 2, "semana_fim": 11 },
  { "competicao": "serie-a", "datas": "fds", "semana_inicio": 12, "semana_fim": 50 },
  { "competicao": "copa-do-brasil", "datas": "meio", "semana_inicio": 14, "semana_fim": 45 }  // datas: fds | meio | ambos
] }
```

  A ordem dos blocos é a ordem de encaixe. Competição sem bloco usa os fins de semana da temporada inteira (aviso na validação).
- Fases encadeadas: `pontos_corridos.classificam` (obrigatório se houver `classificam_para`) e `mata_mata.classificam` (padrão: metade se houver próxima fase; 1 = campeão se for a última). Um mata-mata sem `classificam` na última fase vai até a final.
- Ainda não suportado pelo motor (aviso na validação): participantes `por_divisao` e `entram` em fases seguintes. `classificados_de` funciona a partir da 2ª temporada (vagas distribuídas na virada).

### Montagem do calendário (algoritmo)

1. Para cada competição da temporada, o motor de fases gera a lista ordenada de rodadas (uma rodada = conjunto de jogos que podem ser no mesmo passo).
2. Os blocos de `temporada.json` dizem a janela de passos de cada competição e se ela usa passos de fim de semana ou de meio de semana.
3. Encaixe guloso respeitando: nenhum time em dois jogos no mesmo passo; mínimo de 1 passo entre jogos do mesmo time; ida e volta de mata-mata em passos diferentes.
4. Rodadas de mata-mata cujos participantes ainda não são conhecidos reservam passos; os jogos são criados quando a fase anterior termina.
5. Teste obrigatório: temporada completa sem conflito e sem jogo pendente no fim.

## Motor genérico de fases

Cada competição (`competicoes/<id>.json`) é uma lista de fases. O mesmo motor serve para Séries A-D, Copa do Brasil, estaduais, regionais e continentais.

```jsonc
{
  "id": "copa-do-brasil", "nome": "Copa do Brasil", "tipo": "nacional",   // nacional | estadual | regional | continental
  "participantes": { "regra": "lista" | "por_divisao" | "classificados_de", ... },
  "suspensao": { "amarelos": 3, "jogos": 1, "vermelho_jogos": 1, "zera_na_fase": null },
  "substituicoes": 3,                                                      // padrão 3, igual ao limite do WE2002
  "premiacao": { "participacao": 0, "por_posicao": [0, 0, 0] },  // centavos; [0] = campeão. "por_fase" (campeao/vice) segue lido se não houver por_posicao
  "fases": [
    { "id": "f1", "nome": "1ª fase", "formato": "mata_mata",
      "mata_mata": { "jogos": 1, "gol_fora": false, "prorrogacao": false, "penaltis": true, "mando": "pior_campanha" },
      "entram": ["estaduais:*:vagas_cdb"], "classificam_para": "f2" },
    { "id": "grupos", "nome": "Fase de grupos", "formato": "grupos",
      "grupos": { "quantidade": 8, "tamanho": 4, "turnos": 2, "sorteio": "potes", "classificam": 2 },
      "desempate": ["pontos","vitorias","saldo","gols_pro","confronto_direto","sorteio"] },
    { "id": "liga", "nome": "Turno e returno", "formato": "pontos_corridos",
      "pontos_corridos": { "turnos": 2 },
      "desempate": ["pontos","vitorias","saldo","gols_pro","confronto_direto","menos_vermelhos","menos_amarelos","sorteio"],
      "zonas": [ { "de": 1, "ate": 6, "nome": "Libertadores", "cor": "info" }, { "de": 17, "ate": 20, "nome": "Rebaixamento", "cor": "negativo" } ] }
  ],
  "saidas": [ { "posicoes": "1-4", "destino": "serie-a", "tipo": "acesso" }, { "campeao": true, "destino": "libertadores" } ]
}
```

- **Formatos**: `pontos_corridos`, `grupos` (com sorteio por potes), `mata_mata` (1 ou 2 jogos, gol fora sim/não, prorrogação sim/não, pênaltis, critério de mando).
- **Desempates configuráveis** por fase, com a lista acima de critérios (adicionar critérios novos é fácil: cada um é uma função comparadora).
- **Saídas** ligam competições: acesso/rebaixamento entre séries, vagas para Copa do Brasil a partir dos estaduais/regionais, vagas para Libertadores/Sul-Americana. As **vagas brasileiras nas continentais são configuráveis no pacote**.
- Empate em pontos corridos é resultado válido; em mata-mata, a partida só termina com vencedor (agregado → gol fora se ligado → prorrogação se ligada → pênaltis).

### Divisões: acesso e rebaixamento (`divisoes.json`)

A escada das séries fica num arquivo próprio do pacote, editado na aba **Divisões** do editor. Cada degrau é uma competição com participantes por `lista`, da mais alta para a mais baixa. Entre cada par, **o mesmo número sobe e desce** (`troca`), então o tamanho das séries não muda.

```jsonc
{ "divisoes": [
  { "competicao": "serie-a" },
  { "competicao": "serie-b", "troca": 4 },                                    // 4 últimos da A descem, 4 primeiros da B sobem
  { "competicao": "serie-c", "troca": 4,
    "sobem":  { "criterio": "fase", "fase": "quadrangular" } },                // os 4 melhores entre quem jogou o quadrangular
  { "competicao": "serie-d", "troca": 4,
    "descem": { "criterio": "grupo", "fase": "f1", "por_grupo": 1 } }          // o último de cada grupo da 1ª fase da C (4 grupos)
]}
```

- **Critérios** (cada lado de cada par; padrão `posicao`): `posicao` = N primeiros/últimos da classificação final; `fase` = entre quem jogou a fase, os N melhores (sobem) ou piores (descem); `grupo` = os `por_grupo` primeiros/últimos de cada grupo da fase (`por_grupo × grupos` tem de dar a troca).
- **Na criação da carreira** a escada vira saídas `acesso`/`rebaixamento` (`primeiros`, `ultimos`, `fase`, `por_grupo`) e zonas "Acesso"/"Rebaixamento" da tabela (posição e grupo; critério por fase não tem zona). Nas competições da escada, as saídas de acesso/rebaixamento e as zonas com esses nomes escritas no arquivo da competição são substituídas (aviso na validação); vagas e outras zonas ficam. Núcleo em `src/core/competicoes/divisoes.ts`.
- **Validação**: competição inexistente ou repetida, sem `lista`, divisão sem troca, troca do tamanho da série ou maior, fase inexistente, fase com menos times que a troca, grupo que não fecha a conta.
- Carreiras já criadas não mudam (a definição das competições fica no banco da carreira).

### Segunda divisão fantasma dos estaduais (`segunda_divisao`)

Um estadual ou regional com participantes por `lista` pode ter uma **segunda divisão que não é jogada**. Na virada, os piores caem para ela e o mesmo número sobe, **sorteado** com o gerador com semente (`criarRng(semente).derivar('virada', temporada).derivar('segunda_divisao', id)`; a prévia do Fim de temporada já mostra quem vai subir, e a virada repete o sorteio).

```jsonc
"segunda_divisao": {
  "troca": 2,                                   // quantos caem e quantos sobem
  "nome": "Série A2",                           // opcional; padrão "<nome> (2ª divisão)"
  "descem": { "criterio": "posicao" },          // opcional; mesmos critérios do divisoes.json (posicao | fase | grupo)
  "times": ["AUD", "BON"],                      // aptos a subir (marcados no editor); se houver, só eles sobem
  "estados": ["RJ"]                             // sem aptos marcados: os clubes desses estados (padrão: os dos participantes)
}
```

- **Quem pode subir**: os **aptos** marcados em `times`; sem marcação, os clubes do pacote dos `estados`. Nos dois casos, menos quem jogou o estadual nesta temporada e quem joga outro estadual/regional. Clubes das séries nacionais podem subir se não jogam estadual nenhum (no pacote real eles já estão no seu estadual).
- **A lista de aptos roda**: na virada, quem sobe sai de `times` e quem cai entra (a definição da competição no banco da carreira é atualizada). Sem marcação não há lista: vale o estado.
- **Faltam candidatos**: caem só tantos quantos sobem (o estadual mantém o tamanho); a validação avisa.
- O balanço mostra os dois lados como movimentos (rebaixamento para a segunda divisão, acesso dela) e vira notícia. O clube que sobe com elenco vazio recebe livres na semana 1 (06, "Elenco mínimo na semana 1").
- **Editor**: aba Competições, seção "Segunda divisão" (só estadual/regional por lista): liga/desliga, nome, quantos, critério de quem cai e **Clubes aptos a subir** (seletor com busca para incluir, lista só com os marcados e a contagem, "Tirar" em cada um; o botão "Marcar os clubes de RJ" inclui de uma vez os do estado). Sem aptos marcados, aparece o campo de estados. A lista avisa quem já joga este ou outro estadual. Os participantes de qualquer competição por lista usam o mesmo seletor.
- **Validação**: erro se a competição não for estadual/regional por lista, se a troca não for menor que o estadual, se a fase do critério não existir (ou o grupo não fechar a conta) ou se um apto não existir; aviso se um apto já joga este ou outro estadual e se houver menos candidatos que a troca.
- No pacote Brasil 2026: Cariocão com `troca: 2` e 8 aptos marcados (AUD, BON, CAB, FRI, GOY, NIG, NTE, OLA).

### Competições por vagas (Série D)

Decisões de 19/11/2026: a Série D é montada **no mesmo ano** pelos estaduais e regionais (inclusive na 1ª temporada, diferente da realidade, em que o estadual classifica para o ano seguinte); só os estaduais/regionais mandam times; os rebaixados da Série C entram direto; se as vagas não fecharem o formato, completam os próximos colocados; o formato é o do editor.

- **`participantes: { "regra": "lista", "times": [], "quantidade": 64, "por_vagas": true }`**: `quantidade` é obrigatória e é o tamanho do formato. `times` são os **garantidos**: quem chega por acesso/rebaixamento (a virada põe ali os que caem da C) e, na 1ª temporada, os do pacote (em geral nenhum: o jogo define todos pelas vagas). A competição continua na escada do `divisoes.json` (troca com a C).
- **Origens**: as competições com saída de vaga para ela. No editor, a competição por vagas tem a seção **Vagas por origem** (cada estadual/regional com o número de vagas); ao salvar, cada número vira, no estadual, a saída `{ "primeiros": N, "destino": "serie-d" }` (um `exceto_de` que já existia nela é mantido). As saídas também podem ser editadas na própria origem.
- **Quem é pulado** fica no destino: `"pula_quem_joga": ["serie-a", "serie-b", "serie-c"]` (ver "Pular quem joga", abaixo).
- **No calendário**: na geração da temporada, a edição nasce **aguardando vagas** (`aguardandoVagas`): todas as rodadas reservadas, com `possiveis` = garantidos + participantes das origens. Quando a última origem disputada acaba (no fim do passo em que ela termina), o motor define os participantes:
  1. os garantidos;
  2. as vagas de cada origem, na ordem do pacote e das saídas; quem joga, **nesta temporada**, as competições do `pula_quem_joga` (ou do `exceto_de` da saída) ou já entrou é pulado e a vaga desce;
  3. se faltar, os próximos colocados de cada origem, um de cada vez (com os mesmos pulos);
  4. com a lista cheia, sorteia a 1ª fase (ranking por força) nas rodadas reservadas e gera a notícia ("Definidos os N participantes", ou "Vaga garantida!" para o usuário).
- **Não fechou** (as origens não têm times suficientes): a edição é **cancelada** naquele ano (`cancelada`), as reservas são liberadas e sai a notícia de que não será disputada. Sem origem disputada no ano, só joga se os garantidos fecharem a quantidade.
- **Na virada**: a lista da competição fica só com os garantidos da próxima temporada (quem chegou por acesso/rebaixamento); quem subiu para a C sai; o resto vem das vagas do ano seguinte.
- **Validação**: erro se faltar `quantidade`, se houver mais garantidos que a quantidade, se a competição ou alguma origem não tiver janela no `temporada.json` ou se a janela dela não começar **depois** do fim de todas as origens (`calendario_vagas`); aviso se nenhuma competição manda vagas, se as origens não têm times para fechar (não será disputada) ou se as vagas configuradas não fecham (`vagas_completadas`: o resto vai para os próximos colocados).
- Núcleo em `src/core/competicoes/vagas.ts` (`participantesPorVagas`), `fases.ts` (`reservarEdicao`) e `temporada.ts` (`definirVagas`, chamado em `concluirPasso`).

### Pular quem joga (`pula_quem_joga`)

Decisão de 19/11/2026: a checagem "o clube já está em outra competição?" é **regra da competição de destino**, configurada no editor, e só **exclui** (não há regra de "só quem joga X").

```jsonc
// competicoes/serie-d.json
"pula_quem_joga": ["serie-a", "serie-b", "serie-c"]
// competicoes/sul-americana.json (classificados_de)
"pula_quem_joga": ["libertadores"]
```

- Quem joga uma das competições marcadas não entra por vaga; **a vaga desce** para o próximo colocado da origem que não esteja pulado nem já dentro. Vale para todas as vagas que chegam: campeão (desce para o vice...), posições ("7-12" começa no 7º e anda até preencher 6) e primeiros. Últimos e por grupo não pulam (são de rebaixamento).
- **Quando conta**: competição por vagas (Série D) → quem joga no **mesmo ano** (participantes das edições da temporada); `classificados_de` (Sul-Americana) → quem vai jogar na **próxima temporada** (listas depois de acesso/rebaixamento e as vagas já distribuídas na virada; as vagas sem pulo são distribuídas antes das com pulo, então a Libertadores já está montada quando a Sul-Americana pula quem está nela).
- Cada saída ainda pode ter o seu `exceto_de` (somado ao do destino), em campeão, posições ou primeiros.
- **Editor**: nas competições que recebem vagas (por vagas ou `classificados_de`), a seção **Classificação: pular quem joga**: uma caixa por competição do pacote, o botão "Marcar as séries nacionais" e, se alguma origem já pula na própria saída, o aviso com **Trazer para cá** (a regra passa para o destino e, ao salvar, o `exceto_de` sai das saídas das origens).
- **Validação**: erro se citar competição que não existe ou a própria; aviso se a competição não recebe vagas (sem efeito); saída com `exceto_de` em últimos/por grupo é erro.
- Núcleo: `escolherComPulo` (`competicoes/fases.ts`), usado por `participantesPorVagas` (vagas.ts) e pela virada.
- **Falta no pacote Brasil 2026**: a competição `serie-d` (formato, `quantidade`, `por_vagas`, janela no `temporada.json` depois dos estaduais, degrau no `divisoes.json` com a troca com a C) e os estaduais/regionais que vão dar as vagas (hoje só o Cariocão).

## Competições da v1

| Competição | Formato padrão (no pacote, editável) |
|---|---|
| Série A, B | 20 times, pontos corridos em 2 turnos; 4 sobem / 4 caem |
| Série C | 20 times; formato no pacote (ex.: 1ª fase em pontos corridos + quadrangulares) |
| Série D | formato no pacote (motor de fases); por vagas dos estaduais/regionais do mesmo ano ("Competições por vagas") |
| Copa do Brasil | mata-mata com entrada escalonada |
| Paulista, Carioca, Mineiro, Gaúcho | formato no pacote |
| Copas regionais | agrupamento dos demais estados configurável no pacote |
| Libertadores, Sul-Americana | **simplificado**: grupos + mata-mata, sem fase prévia e sem transferência de 3º colocado |

### Estrangeiros

- Pool fixo por país (**9 outros países da CONMEBOL**), com elencos reais no pacote; quantidade por país configurável.
- A cada temporada, um número X de times por país é **sorteado** para Libertadores e Sul-Americana (X por país no pacote).
- Times estrangeiros **não podem ser escolhidos** pelo usuário (por enquanto), mas podem enfrentá-lo no WE (mesmo tratamento: elenco, kits, escudo).
- Fora das continentais, os estrangeiros não jogam competições (não há ligas estrangeiras). A condição deles se recupera normalmente com o tempo.

## Suspensões e cartões

- Contagem **por competição** (padrão: 3 amarelos = 1 jogo; vermelho = 1 jogo). Configurável por competição; opção de zerar amarelos ao mudar de fase.
- O jogador suspenso não aparece como disponível na convocação; a IA de técnico também respeita.
- Nos jogos do WE, cartões ainda não são lidos da RAM: **v1 ignora cartões nos jogos do WE** (o usuário pode registrar à mão no pós-jogo, opcional). Ver `07-integracao-we.md`.

## Virada de temporada

Quando o último jogo da temporada termina:

1. Relatório: campeões de cada competição, acesso/rebaixamento, artilheiros, campanha do usuário.
2. Premiação em dinheiro (por competição/fase) e **avaliação da diretoria** (metas atingidas, confiança).
3. Contratos que terminam: renovação só até a semana limite (06, "Renovações e pré-contratos"); depois dela, pré-contratos. Na virada os pré-contratos mudam de clube, quem não renovou sai livre.
4. Aplicar acesso/rebaixamento, montar participantes da próxima temporada, **sorteio das vagas estrangeiras e dos grupos das copas**.
5. Novas metas da diretoria; nova cota de TV e patrocínio.
6. (v2) Envelhecimento, aposentadorias e jovens gerados.

### Como está implementado (fase 9)

Núcleo em `src/core/competicoes/virada.ts` (participantes), `core/diretoria` (`metaAtingida`, `fecharMetas`) e `core/mercado/contratos.ts` (`cpuRenova`); caso de uso em `src/main/carreira/virada.ts`; tela `TelaFimTemporada.vue`.

- **Fluxo**: o Continuar com a temporada encerrada abre **Fim de temporada** (prévia: campeões, campanha, acesso/rebaixamento, artilheiros e os **contratos do usuário que vão acabar**). O botão Renovar abre o Mercado na renovação (`/mercado?renovar=<id>`) enquanto o prazo de renovação está aberto; depois dele a prévia mostra quem sai livre, quem assinou pré-contrato e quem chega. **Iniciar a temporada** faz a virada numa transação e mostra o relatório (gravado em `relatorio_temporada`).
- **Recesso**: condição, treino e salários correm até a semana `semanas_por_temporada`.
- **Saídas**: `acesso`/`rebaixamento` movem o time entre competições por `lista` (a definição da competição no banco da carreira é atualizada); os outros tipos são vagas para competições por `classificados_de` (gravadas em `configuracao`, chave `participantes_<temporada>`) ou, para `lista` por vagas, valem no mesmo ano (na virada a lista fica só com os garantidos). Depois vêm as segundas divisões fantasmas (sorteio com a semente da carreira; os clubes e estados saem da tabela `time`) e as vagas pulando.
- **Metas**: fechadas pela classificação final, saldo e folha; meta crítica perdida = demissão (o usuário escolhe outro clube antes de jogar).
- **Contratos** (`ate_temporada` ≤ temporada): pré-contratos mudam de clube; empréstimo volta ao clube de origem (`virada.temporadas_renovacao`); a CPU já decidiu as renovações na semana limite (se a temporada acabou antes, decide aqui) e quem sobrou sai livre; os do usuário não renovados saem livres. O elenco do usuário não fica abaixo de `mercado.elenco_minimo` nem com menos de 2 goleiros: os melhores que faltarem são renovados por 1 temporada ("renovados pela diretoria"). Os da CPU são completados com livres na semana 1 da temporada nova (06, "Elenco mínimo na semana 1").
- **Resto**: idade +1 (`virada.envelhecer`), amarelos zerados (suspensões pendentes seguem), propostas e negociações abertas encerradas, calendário e sorteios da temporada nova, valores de mercado e metas novas.
- Ainda não: aposentadorias e jovens (v2). Autosave e golden file: ver `01-arquitetura.md`.
