# 09b · Catálogo de notícias (v1)

Complementa `09-noticias-eventos.md`. O catálogo padrão está em `src/core/noticias/catalogoPadrao.ts`; um pacote pode trazer o seu em `noticias.json` (mesmo formato, validado por `CatalogoSchema` em `src/shared/esquemas/noticias.ts`). O catálogo é gravado na carreira na criação, então mudar o pacote depois não muda carreiras em andamento.

## Formato

| Campo | Valores |
|---|---|
| `tipo` | `elenco`, `diretoria`, `mercado`, `financas`, `torcida`, `imprensa`, `jogo`, `competicao` |
| `gatilho.momento` | `semana` (uma avaliação por semana implícita), `pos_jogo` (depois de cada jogo do usuário), `janela_abre`, `janela_fecha`, `virada` (fase 9) |
| `gatilho.condicoes` | `jogador.idade`, `jogador.moral`, `jogador.condicao`, `jogador.geral`, `jogador.potencial`, `jogador.titular` (0/1, os 11 de maior geral), `time.saldo`, `time.confianca`, `time.aproveitamento` (0-1, últimos 5 jogos), `time.folha_acima` (0/1), `time.moral_media`, `partida.resultado` ("V"/"E"/"D"), `partida.gols_pro`, `partida.gols_contra`, `partida.em_casa` (0/1). Operadores `<`, `<=`, `>`, `>=`, `==`, `!=` |
| `alvo` | `jogador_aleatorio_do_usuario` / `jogador_condicionado` (sorteado entre os jogadores do usuário que atendem às condições de jogador; lesionados ficam de fora), `time_usuario`, `time_qualquer` (outro clube; aparece como `{clube}`) |
| `chance` | por avaliação, multiplicada por `regras.noticias.fator_chance` |
| `intervalo_minimo_semanas` | o mesmo evento não se repete antes disso |
| `texto` | marcadores `{jogador}`, `{time}`, `{clube}`, `{valor}` (valor do efeito de saldo) |
| `efeitos[].campo` | `moral`, `moral_elenco`, `condicao`, `atributo` (com `atributo`), `atributo_aleatorio`, `atributo_aleatorio_do_foco`, `potencial`, `confianca`, `saldo` (`valor` em centavos), `lesao` e `disponibilidade` (`semanas`), `interesse_mercado` (proposta de um clube pelo jogador). Cada efeito aceita `chance` |
| `escolhas` | 2 ou mais opções `{ id, texto, resultado?, efeitos }`: o evento fica pendente e trava o Continuar até a resposta |

## Regras do motor

- Avaliação: os eventos do momento são embaralhados pelo `rng` derivado de `('noticias', temporada, semana, momento)`; cada elegível tenta a sua chance; no máximo `regras.noticias.maximo_por_avaliacao` (padrão 1) por avaliação.
- Só um evento com escolha pendente por vez. O Continuar para logo depois da data em que ele surgiu; Continuar e jogar a data do usuário recusam enquanto houver pendência.
- Os efeitos são sorteados quando o evento acontece (inclusive os de cada opção), e aplicados na hora (sem escolha) ou na resposta. Cada aplicação grava `{efeito, antes, depois}` em `noticia.efeitos_aplicados`; atributo mexido também entra em `evolucao` com motivo `noticia`.
- Limites: moral e condição 0-100, atributos e potencial 1-20, confiança 0-100. Lesão e disponibilidade usam os dias de lesão (o jogador fica fora pelas semanas indicadas).
- `interesse_mercado` cria uma proposta na caixa de propostas do Mercado, com o valor de mercado do jogador.

## Catálogo padrão (24 eventos)

| Momento | Eventos |
|---|---|
| Semana | destaque no treino (jovem; moral +8, 50% de +1 num atributo do foco) · jovem promessa (≤ 20; potencial +1 em 50%) · veterano assume a liderança (moral do elenco +3) · atrito no vestiário (moral ≤ 35; **escolha**: multar ou conversar) · assuntos pessoais (fora 1 semana) · lesão no treino (2 semanas) · plano de recuperação (condição ≤ 70; +15) · balada (≤ 27; **escolha**: multar/afastar ou defender) · crítica da imprensa (titular; moral −5) · bônus do patrocinador (aproveitamento ≥ 60%; +R$ 500 mil) · ação promocional (**escolha**: +R$ 300 mil e moral do elenco −2, ou recusar) · multa da federação (−R$ 100 mil) · protesto da torcida (aproveitamento ≤ 30%) · festa da torcida (≥ 70%) · presidente garante o técnico (confiança ≤ 35) · diretoria reclama da folha (folha acima do orçamento) · sondagem de outro clube (titular; proposta + moral −3) |
| Janela | interesse por titular ao abrir (30%) · reserva frustrado ao fechar (moral −6) |
| Pós-jogo | goleada (≥ 4 gols; moral do elenco e confiança) · vexame (sofreu ≥ 4) · craque do jogo (vitória; moral +6) · bicho pela vitória (**escolha**: pagar R$ 200 mil e moral +4, ou negar e moral −3) · reclamação pública depois da derrota (**escolha**: afastar 1 semana ou relevar) |

## Notícias informativas

Geradas pelo jogo, sem efeito: metas da diretoria (início da temporada), resultado do jogo do usuário, lesão e suspensão no elenco do usuário, transferências (todas, inclusive CPU x CPU e as do usuário), propostas recebidas, janela abrindo e fechando, contratos que terminam na temporada (semana `regras.noticias.semana_aviso_contratos`, padrão 30), campeões, cargo ameaçado e demissão. Na virada (fase 9): acesso/rebaixamento, artilheiro de cada competição, balanço das metas, fim de contrato, volta de empréstimo e início da temporada.
