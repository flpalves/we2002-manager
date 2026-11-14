# WE2002 Manager: decisões de escopo (rodada 1 — 12/11/2026)

Base para os arquivos de especificação do Claude Code (`CLAUDE.md` + `docs/spec/` por domínio + `docs/roadmap.md`).

## Visão
- Usuário é **técnico + dirigente**. Carreira **presa ao clube** na v1; carreira de técnico (trocar de clube) depois.
- Referências: **Brasfoot, Championship Manager 01/02, Modo Carreira do FIFA**.
- Carreira **sem fim**; envelhecimento, jovens gerados e categorias de base na **v2**.
- **Pacotes de dados separados** desde já (nomes/escudos reais no pacote do Felipe, trocáveis por fictícios).
- Começa na temporada **2026**, com os elencos atuais. Dinheiro em **R$, valores realistas**.

## Competições e calendário
- v1: **Séries A, B e C**, **Copa do Brasil**, **principais estaduais** e **copas regionais** (agrupando os demais estados por região), **Libertadores** e **Sul-Americana**. Criaremos todos os times necessários.
- Continentais: **pool fixo de times estrangeiros por país, com elencos reais**; a cada ano um número X por país é sorteado para entrar. Times estrangeiros **não podem ser controlados** pelo usuário (por enquanto).
- **Motor genérico de fases**: cada competição é uma lista de fases configuráveis (pontos corridos, grupos, mata-mata).
- Mata-mata: formato **configurável por competição** (jogo único/ida e volta, gol fora, prorrogação, pênaltis).
- Desempates: **configuráveis por competição**.
- Tempo passa **rodada a rodada**.

## Partida
- Em cada jogo do usuário ele escolhe: **jogar no WE**, **assistir CPU x CPU** ou **simular**.
- Se o resultado não chegar: **jogar de novo**, **simular** ou **digitar o placar à mão**.
- **Motor próprio** que simula a partida completa internamente, mas expõe: placar, autores dos gols (e assistências), cartões e lesões.
- Calibração do motor pelas médias do futebol real (~2,5 gols/jogo, ~25% empates, vantagem do mando); ajustar depois com resultados do WE.
- **Condição física** entre jogos, reduzindo os atributos injetados no WE. As **setinhas de condição do WE** serão mapeadas e escritas na RAM, pré-calculadas pela condição física.
- Cartões e lesões nos jogos do WE: **ignorados na v1**, mapeados depois.
- **Substituições do WE (quem entrou, minutos jogados): mapear na RAM antes da v1.**
- Tática: **só formação + escalação**.
- **Sem nota** de jogador por partida.

## Jogadores
- Elenco de **até ~35**; convocação de **23 por jogo** para o WE.
- Atributos na escala **1-20** (estilo CM), convertidos para os 8 níveis do WE (12-19).
- Dados extras (fora do motor do WE): idade, nacionalidade, posição secundária, contrato (salário, término), valor de mercado, moral, histórico por temporada (jogos, gols, cartões).
- Evolução: **treino**, **potencial visível de acordo com a idade** e **notícias/eventos aleatórios** (a desenhar).
- Atributos ocultos: **potencial** e **resistência física** (quanto o jogador cansa).
- Aparência (pele, cabelo, altura) **editável no manager já na v1**.

## Mercado e finanças
- Janelas de transferência **configuráveis**.
- IA dos clubes **negocia entre si** em segundo plano.
- Negócios: **compra/venda, empréstimo, livres, renovação e multa rescisória** (sem troca).
- Negociação com **contraproposta, até 5 movimentos entre uma partida e outra**.
- Finanças **intermediárias**: receitas por categoria + folha salarial + orçamento de contratações.
- Estádio: **capacidade + preço do ingresso + público**.
- Diretoria: **metas + demissão**, mas a demissão não encerra o jogo (como seguir em outro clube: a definir).
- Treino: **um foco geral para o time**.

## Interface
- Estética **retrô anos 2000** (Brasfoot / CM 01/02, tabelas densas).
- Tema configurável: **claro + cores do clube nos detalhes** ou **escuro + cores do clube nos detalhes**.
- **Barra lateral + barra superior** (data/rodada, saldo, "Continuar").
- Tela inicial: **painel resumo** (próximo jogo, tabela, elenco) + notícias.
- Janela mínima **1280x720, redimensionável**; **gamepad** também no manager.
- **PNG de escudo obrigatório** por time.
- Mockups das telas principais serão feitos no chat antes de fechar a spec.

## Técnico
- **Projeto novo** em Vue + Vite + Electron, **TypeScript**, portando a lógica testada do `campeonato/` (escolherControle, desinversão do resultado, validação do `resultado.json`, escolha de uniforme).
- **Um `.sqlite` por carreira, várias carreiras**, autosave por rodada.
- Dados iniciais: **pacote de JSONs importado ao criar a carreira**; depois o `.sqlite` é a fonte da verdade.
- **Editor do pacote base já na v1** (times, jogadores, competições).
- Emulador: **só PCSX-Redux** (ponte Lua).
- **Vitest obrigatório** nas regras de negócio.
- Entrega: **tudo pronto antes de jogar a primeira temporada** (sem marcos jogáveis intermediários).
