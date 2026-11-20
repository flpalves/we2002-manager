/**
 * Números de calibragem padrão do jogo. O `regras.json` do pacote sobrescreve qualquer
 * parte deles (ver `mesclarRegras`). Nada de número mágico espalhado pelo núcleo: se um
 * valor pode ser calibrado, ele mora aqui.
 *
 * Os valores ainda são as propostas iniciais das specs (docs/spec/03 a 06).
 */

export interface Regras {
  temporada: {
    /** Duração fixa da temporada em semanas implícitas. */
    semanas_por_temporada: number
  }
  /** Virada de temporada (03-competicoes): contratos da CPU que terminam e idade. */
  virada: {
    /** Chance de a CPU renovar quem tem contrato acabando, pelo lugar no elenco (ordem de geral). */
    renovacao_cpu: { titular: number; reserva: number; encostado: number }
    /** A partir desta idade a chance de renovação é multiplicada por `fator_veterano`. */
    idade_veterano: number
    fator_veterano: number
    /** Temporadas da renovação automática da CPU (e do retorno de emprestado). */
    temporadas_renovacao: number
    /** Todo jogador fica um ano mais velho na virada. */
    envelhecer: boolean
  }
  calendario: {
    /** Dia da semana implícita (0-6) das datas de meio de semana e de fim de semana. */
    dia_meio: number
    dia_fds: number
    /** Dias mínimos entre dois jogos do mesmo time (fds → meio = 3 dias). */
    descanso_minimo_dias: number
  }
  competicao: {
    pontos: { vitoria: number; empate: number; derrota: number }
    /** Substituições por partida (o WE2002 permite 3). */
    substituicoes: number
  }
  jogadores: {
    /**
     * Conversão do atributo do manager (1-20) para o nível bruto do WE (0-7, exibido 12-19).
     * `limites[n]` é o maior valor 1-20 que ainda vira o nível `n`.
     */
    conversao_we: { limites: number[] }
    /** Largura da faixa de potencial exibida, por idade máxima. */
    faixa_potencial: { ate_idade: number; mais_ou_menos: number }[]
    /**
     * Pesos do "geral" por posição (GK, CB...). Posição ausente = média simples dos 16.
     * Padrão de 13/11/2026: o que pesa para a função de cada posição no WE (o pacote pode sobrescrever).
     */
    pesos_geral: Record<string, Record<string, number>>
  }
  elenco: {
    /** Mínimo de convocáveis por time (o WE leva 23) e de goleiros entre eles. */
    convocaveis_minimo: number
    goleiros_minimo: number
    /** Limite do WE para nome_we e nome_curto. */
    tamanho_nome_we: number
  }
  motor: ParametrosMotor
  condicao: {
    /** Gasto em 90 minutos (spec 05): 28 × fator de resistência × fator de idade. */
    gasto_por_90: number
    resistencia_base: number
    resistencia_por_ponto: number
    /** FOLE: multiplica o gasto (1 com FOLE 10). */
    fole_base: number
    fole_por_ponto: number
    fator_idade_gasto: { ate_idade: number; fator: number }[]
    recuperacao_por_dia: number
    fator_idade_recuperacao: { ate_idade: number; fator: number }[]
    /** Condição com que o jogador volta de lesão. */
    volta_de_lesao: number
  }
  lesoes: {
    /** Gravidade: peso no sorteio e faixa de semanas implícitas. */
    faixas: { nome: 'leve' | 'media' | 'grave'; peso: number; semanas: [number, number] }[]
  }
  setas: {
    /** Pontuação = peso_condicao × condição + (1 − peso_condicao) × moral. */
    peso_condicao: number
    /** Pontuação mínima de cada seta (abaixo de `ruim` = péssima). */
    otima: number
    boa: number
    normal: number
    ruim: number
    /** Redução de níveis do WE por condição baixa (o primeiro que servir). */
    reducao_we: { abaixo_de: number; niveis: number }[]
  }
  moral: {
    padrao: number
    /** Quanto volta para o padrão por semana. */
    retorno_semanal: number
    vitoria: number
    empate: number
    derrota: number
    /** Clássico/final: multiplica o efeito do resultado. */
    fator_jogo_grande: number
    gol: number
    assistencia: number
  }
  treino: {
    focos: Record<
      FocoTreino,
      {
        /** Atributos que podem evoluir. REFLE. só conta para goleiros (`so_goleiro`). */
        atributos: string[]
        so_goleiro?: string[]
        recuperacao: number
        lesao: number
        entrosamento: number
      }
    >
    /** Entrosamento: mínimo do decaimento semanal, fator ao trocar a formação, reforço novo no time titular. */
    entrosamento_minimo: number
    entrosamento_troca_formacao: number
    entrosamento_reforco: number
  }
  evolucao: {
    base: number
    divisor: number
    fator_idade: { ate_idade: number; fator: number }[]
    minutos_bom: number
    fator_jogou_bem: number
    fator_entrou: number
    fator_nao_jogou: number
    idade_declinio: number
    declinio_por_ano: number
    atributos_fisicos: string[]
  }
  /**
   * Oscilação semanal (09): uma fração dos jogadores de todos os clubes, sem olhar idade ou time,
   * ganha ou perde pontos num atributo sorteado. Metade sobe, metade desce.
   */
  oscilacao: {
    ativa: boolean
    /** Fração dos jogadores afetados por semana: sorteada entre o mínimo e o máximo (0-1). */
    fracao_min: number
    fracao_max: number
    /** Tamanho da variação (pontos na escala 1-20), sorteado por jogador. */
    delta_min: number
    delta_max: number
  }
  /** Disponíveis do exterior (06, "Jogadores sem clube"). */
  exterior: {
    /** Salário pedido = salário de referência (clube que paga) × isto. */
    premio_salarial: number
    /** Fração do pool que sai na virada ("renovou com o clube dele lá fora"). */
    saida_por_virada: number
    /** A partir desta idade, a chance de saída dobra. */
    idade_saida_dobrada: number
    /** Arredondamento da taxa recalculada na virada (centavos). */
    arredondar_taxa: number
  }
  ia: {
    /** Condição abaixo da qual o titular vira candidato a ser poupado, por prioridade da competição. */
    rodizio_limite: Record<'liga' | 'continental' | 'copa' | 'estadual', number>
    /** Abaixo desta condição o titular é poupado mesmo sem jogo em sequência ou em jogo decisivo. */
    rodizio_critico: number
    /** Próximo jogo em até tantos dias = jogos em sequência (o rodízio só vale aí, fora os críticos). */
    rodizio_dias_sequencia: number
    /** Soma ao limite quando o próximo jogo é de uma competição mais importante que este. */
    rodizio_bonus_proximo_importante: number
    /** Máximo de titulares poupados por jogo, por prioridade da competição. */
    rodizio_maximo: Record<'liga' | 'continental' | 'copa' | 'estadual', number>
    /** Máximo de poupados num jogo decisivo (final, mata-mata que define o confronto). */
    rodizio_maximo_decisivo: number
    /** Perda relativa máxima na força do time que o rodízio aceita, por prioridade. */
    rodizio_perda_maxima: Record<'liga' | 'continental' | 'copa' | 'estadual', number>
    /** Perda a mais aceita para poupar um jogador abaixo do crítico. */
    rodizio_perda_extra_critico: number
    /** Só troca a formação do time se a outra der pelo menos este ganho relativo. */
    ganho_troca_formacao: number
    cansaco_substituicao: number
    minuto_cansaco: number
    minuto_tatica: number
    minuto_segurar: number
    /** Chance de tirar um jogador amarelado e agressivo depois dos 60'. */
    chance_tirar_amarelado: number
  }
  mercado: ParametrosMercado
  financas: ParametrosFinancas
  diretoria: ParametrosDiretoria
  /** Eventos aleatórios (09): no máximo N por avaliação; o fator multiplica a chance de todos. */
  noticias: { maximo_por_avaliacao: number; fator_chance: number; /** Semana do aviso de contratos que terminam na temporada. */ semana_aviso_contratos: number; /** Transferências entre clubes da CPU no jornal por data (as mais caras). */ transferencias_por_data: number }
  /** Valores usados quando o time do pacote não traz finanças/estádio (centavos). */
  padrao_por_porte: Record<
    'grande' | 'medio' | 'pequeno',
    {
      saldo_inicial: number
      patrocinio_temporada: number
      orcamento_folha_mensal: number
      capacidade: number
      ingresso_padrao: number
      custo_por_jogo: number
    }
  >
}

type Pesos = Record<string, number>

export const FOCOS_TREINO = ['fisico', 'tecnico', 'tatico', 'ataque', 'defesa', 'descanso'] as const
export type FocoTreino = (typeof FOCOS_TREINO)[number]

/** Números do motor de partida (04-motor-partida). Calibrados pelo teste em lote. */
export interface ParametrosMotor {
  fator_posicao: { natural: number; secundaria: number; mesmo_setor: number; fora: number; goleiro_fora: number }
  /** Condição em campo abaixo deste valor reduz o atributo efetivo, até `condicao_reducao_max` em 0. */
  condicao_limite: number
  condicao_reducao_max: number
  /** Moral 0-100 → ±moral_amplitude. */
  moral_amplitude: number
  mando_base: number
  mando_publico_max: number
  /** Entrosamento 0-100 → ±entrosamento_amplitude. */
  entrosamento_amplitude: number
  /** Forma do dia: desvio padrão do fator sorteado por time a cada jogo (dá variância aos placares). */
  variacao_dia: number
  /** Atributos que compõem cada setor e o goleiro. */
  pesos_setor: Record<'gol' | 'defesa' | 'meio' | 'ataque', Pesos>
  /** Quanto cada papel da formação contribui para cada setor. */
  contribuicao: Record<string, Partial<Record<'gol' | 'defesa' | 'meio' | 'ataque', number>>>
  expoente_posse: number
  /** Chance por minuto de o time com a bola criar uma jogada perigosa (forças iguais). */
  chance_jogada: number
  expoente_jogada: number
  /** Chance de uma finalização virar gol (finalizador = goleiro). */
  conversao: number
  expoente_finalizacao: number
  chance_cabeceio: number
  chance_assistencia: number
  peso_finalizador: Record<string, number>
  peso_assistente: Record<string, number>
  /** Faltas por minuto (por time) e conversão em cartões. */
  falta_por_minuto: number
  amarelo_por_falta: number
  vermelho_direto_por_falta: number
  /** Cada ponto de AGREC acima de 10 aumenta a chance de cartão nesta proporção. */
  fator_agressividade: number
  /** Jogador já amarelado se cuida: a chance de outro cartão é multiplicada por isto. */
  cuidado_amarelado: number
  lesao_por_minuto: number
  /** Lesão fica até este fator mais provável com condição em campo 0. */
  lesao_fator_cansaco: number
  acrescimo_primeiro: [number, number]
  acrescimo_segundo: [number, number]
  penalti_conversao: number
  /** Cada ponto de (CHUTE M. − REFLE.) muda a conversão nesta quantidade. */
  penalti_ajuste: number
}

type PorPorte = Record<'grande' | 'medio' | 'pequeno', number>
type PorDificuldade = Record<'facil' | 'normal' | 'dificil', number>

/** Mercado (06): valor, salário, negociação, janelas e IA. Centavos. */
export interface ParametrosMercado {
  /** valor = valor_base × base_geral^(geral − geral_referencia) × fatores. */
  valor_base: number
  base_geral: number
  geral_referencia: number
  /** Anos de carreira e revenda (independe do potencial). */
  fator_idade: { ate_idade: number; fator: number }[]
  /** Quanto da margem (potencial − geral) entra no geral projetado, por idade. */
  realizacao_potencial: { ate_idade: number; fator: number }[]
  /** Semanas restantes de contrato → fator (o primeiro que servir). */
  fator_contrato: { ate_semanas: number; fator: number }[]
  /** Liga do time → fator (id da competição); sem liga: `fator_sem_liga`; estrangeiro: país. */
  fator_serie: Record<string, number>
  fator_sem_liga: number
  /** Arredonda o valor para múltiplos disto. */
  arredondar: number
  /**
   * Salário mensal de referência = salario_base × base_geral_salario^(geral − geral_referencia)
   * × fator_serie_salario × prêmio, com prêmio = (fator_idade × base_geral^(projetado − geral))^expoente_premio
   * limitado a [premio_minimo, premio_maximo]. Inicializa quem vem com salário 0 e baliza a negociação.
   */
  salario_base: number
  base_geral_salario: number
  expoente_premio: number
  premio_minimo: number
  premio_maximo: number
  /** Liga do clube que paga → fator; sem liga: `fator_sem_liga_salario`; estrangeiro: país. */
  fator_serie_salario: Record<string, number>
  fator_sem_liga_salario: number
  salario_minimo: number
  /** Multa padrão = valor × isto (quem vem com multa 0). */
  multa_por_valor: number
  importancia: { titular: number; reserva: number; encostado: number }
  /** Quantos são titulares e reservas pela ordem de geral no time. */
  titulares: number
  reservas: number
  /** Pequeno vendendo para grande pede mais. */
  porte_vendedor_menor: number
  contraproposta_minima: number
  paciencia: number
  recusas_maximas: number
  /** Jogador: muda de clube pede mais; clube maior aceita menos; moral mexe um pouco. */
  jogador_mudanca: number
  jogador_porte_maior: number
  jogador_porte_menor: number
  jogador_contraproposta_minima: number
  movimentos_por_jogo: number
  /** Taxa de empréstimo = valor × isto. */
  taxa_emprestimo: number
  /** Janelas de transferência (semanas da temporada); ver core/mercado/janelas.ts. */
  janelas: { semana_inicio: number; semana_fim: number; nome?: string }[]
  elenco_minimo: number
  elenco_maximo: number
  /** Intensidade da IA de mercado (Configurações): multiplica as chegadas-alvo de cada janela. */
  intensidade: Record<'baixa' | 'media' | 'alta', number>
  /** Chance de buscar alvo em clube de porte maior. */
  chance_porte_maior: number
  /** Geral abaixo da média do time que conta como carência. */
  carencia_geral: number
  /**
   * Contratações da CPU por porte do comprador (06, "Limites por porte"): teto do salário mensal
   * e do geral (o jogador "famoso"). 0 = sem limite.
   */
  limites_porte: Record<'grande' | 'medio' | 'pequeno', { salario_maximo: number; geral_maximo: number }>
  /** Nível do clube (06, "Nível do clube"): a divisão manda na hierarquia do mercado. */
  nivel: ParametrosNivel
  /** Limites de contratação da CPU pelo nível do comprador (chave = nível; 0 = sem limite). Somam-se aos do porte. */
  limites_nivel: Record<string, { salario_maximo: number; geral_maximo: number }>
  /** Fim de contrato (06, "Renovações e pré-contratos"). */
  pre_contrato: {
    /** Renovações de quem tem contrato acabando só até esta semana; depois, pré-contratos. */
    semana_limite_renovacao: number
    /** Pré-contratos que um clube da CPU busca = saídas por fim de contrato × isto (ou as carências do elenco projetado). */
    por_saida: number
    maximo: number
  }
  /** IA de mercado dos clubes da CPU (06, "IA de mercado"). */
  ia: ParametrosIaMercado
}

export interface ParametrosNivel {
  /** Liga nacional → nível (a de maior nível vale). */
  liga: Record<string, number>
  /** Clube sem liga nacional na temporada. */
  sem_liga: number
  /** Clube estrangeiro. */
  exterior: number
  /** Salário pedido × (1 + isto) por nível que o jogador desce. */
  salario_por_nivel: number
  /** Titular ou reserva abaixo de `idade_aceita_cair` recusa descer esta quantidade de níveis ou mais. */
  queda_recusa: number
  idade_aceita_cair: number
  /** Reserva fora da lista vendido para clube de nível menor: pedida × isto por nível. */
  agio_rotacao: number
  /** O comprador da CPU mira até a média dos titulares + isto. */
  margem_alvo: number
}

export type PerfilFinanceiro = 'rico' | 'equilibrado' | 'apertado' | 'crise'
export type GrupoPosicao = 'gol' | 'zaga' | 'lateral' | 'volante' | 'meia' | 'ataque'
type PorPerfil = Record<PerfilFinanceiro, number>

export interface ChegadasJanela {
  base: number
  por_carencia: number
  por_saida: number
  minimo: number
  maximo: number
}

export interface ParametrosIaMercado {
  /** Grupos de posição para contar o elenco: posições do WE, mínimo e ideal por grupo. */
  grupos: Record<GrupoPosicao, { posicoes: string[]; minimo: number; ideal: number }>
  /** Perfil: saldo em meses de folha e folha comparada ao orçamento. */
  perfil: { meses_rico: number; meses_apertado: number; folha_apertado: number; folha_crise: number }
  /** Chegadas-alvo: a primeira janela da temporada é a principal. */
  chegadas: { principal: ChegadasJanela; outras: ChegadasJanela }
  fator_perfil_chegadas: PorPerfil
  /** Verba da janela = saldo × fração; parte do que vende volta para a verba. */
  fracao_verba: PorPerfil
  reinveste_venda: PorPerfil
  /** Teto da folha = orçamento × isto. */
  teto_folha: PorPerfil
  /** Custo de um alvo = preço + salário × estes meses (oportunidade dos apertados). */
  meses_custo_salario: number
  /** Pedida de jogador à venda × isto (vendedor em crise: `desconto_crise`). */
  desconto_a_venda: number
  desconto_crise: number
  /** Jovem sem espaço até esta idade sai emprestado. */
  idade_emprestimo: number
  /** Previsão de saída no fim da temporada (outras janelas): peso de quem tem contrato acabando. */
  peso_saida_prevista: number
  propostas: {
    /** Mínimo por janela (sorteado entre os dois) se algum jogador interessa; máximo. */
    minimo: [number, number]
    maximo: number
    /** Propostas extras por jogador do usuário que interessa a algum clube. */
    por_interessante: number
    /** Um jogador conta inteiro como interessante com este número de clubes interessados (menos: fração). */
    clubes_para_interesse_cheio: number
    /** Janelas depois da principal recebem esta fração do volume. */
    fator_outras_janelas: number
    peso_a_venda: number
    peso_contrato_acabando: number
    peso_jovem: number
    idade_jovem: number
    /** Oferta (fração do valor) pelo perfil do comprador; jogador à venda: `oferta_a_venda`. */
    oferta: Record<'rico' | 'equilibrado' | 'apertado', [number, number]>
    oferta_a_venda: [number, number]
    /** Teto oculto da contraproposta (fração do valor). */
    teto: Record<'rico' | 'equilibrado' | 'apertado', number>
    /** Pedido até teto × isto: a CPU cobre parte (oferece o teto); acima, desiste. */
    cobre_ate: number
    prazo_semanas: number
  }
}

export interface ParametrosFinancas {
  /** Ciclo dos salários, patrocínio e TV (semanas). */
  ciclo_semanas: number
  /** Cota de TV por temporada, por liga (id da competição). */
  cota_tv: Record<string, number>
  cota_tv_sem_liga: number
  /** Público. */
  demanda_base: PorPorte
  fator_adversario: PorPorte
  fator_competicao: Record<'liga' | 'copa' | 'estadual' | 'continental' | 'final', number>
  /** f_momento: 1 + peso × (aproveitamento dos últimos jogos − 0,5). */
  peso_momento: number
  preco_base: number
  /**
   * f_preco = preco_base − preco_peso × preço / preço_referência, limitado. Com o peso 1 da spec o
   * fator já seria o mínimo no próprio preço de referência; 0,25 dá 0,9 na referência e 0,65 no dobro.
   */
  preco_peso: number
  preco_minimo: number
  preco_maximo: number
  /** Ajuste do orçamento inicial pela dificuldade. */
  orcamento_dificuldade: PorDificuldade
  /**
   * Orçamento pela divisão (06): o padrão do porte (saldo e orçamento da folha) × o fator da liga
   * para quem não traz finanças no pacote; na virada, o orçamento da folha de todos acompanha a
   * divisão nova (× fator novo / antigo). O patrocínio não muda.
   */
  orcamento_divisao: { liga: Record<string, number>; sem_liga: number }
}

export interface ParametrosDiretoria {
  confianca_inicial: number
  /** Confiança abaixo disto por 2 avaliações seguidas = demissão. */
  limite_demissao: PorDificuldade
  avaliacoes_para_demissao: number
  /** Por jogo: k × (pontos obtidos − pontos esperados). */
  peso_jogo: number
  /** Por avaliação (a cada ciclo): saldo negativo e folha acima do orçamento. */
  saldo_negativo: number
  folha_acima: number
  /** Metas de posição na liga por porte (fração da tabela). */
  meta_posicao: PorPorte
  /** Dificuldade mexe na meta (posições a mais ou a menos). */
  meta_dificuldade: PorDificuldade
  meta_atingida: number
  meta_perdida: number
}

export const PADROES: Regras = {
  temporada: {
    semanas_por_temporada: 52,
  },
  virada: {
    renovacao_cpu: { titular: 0.9, reserva: 0.6, encostado: 0.25 },
    idade_veterano: 33,
    fator_veterano: 0.5,
    temporadas_renovacao: 2,
    envelhecer: true,
  },
  // quarta (2) e domingo (6): fds → meio = 3 dias, meio → fds = 4 dias (03-competicoes)
  calendario: {
    dia_meio: 2,
    dia_fds: 6,
    descanso_minimo_dias: 2,
  },
  competicao: {
    pontos: { vitoria: 3, empate: 1, derrota: 0 },
    substituicoes: 3,
  },
  jogadores: {
    // 1-6 → 0 · 7-8 → 1 · 9-10 → 2 · 11-12 → 3 · 13-14 → 4 · 15-16 → 5 · 17-18 → 6 · 19-20 → 7
    conversao_we: { limites: [6, 8, 10, 12, 14, 16, 18, 20] },
    faixa_potencial: [
      { ate_idade: 19, mais_ou_menos: 3 },
      { ate_idade: 22, mais_ou_menos: 2 },
      { ate_idade: 26, mais_ou_menos: 1 },
      { ate_idade: 999, mais_ou_menos: 0 },
    ],
    pesos_geral: {
      GK: { RES: 6, DEF: 3, JMP: 2, BAL: 1 },
      CB: { DEF: 5, HEA: 2, JMP: 2, BAL: 1.5, SPD: 1, PAS: 0.5 },
      SB: { STA: 2.5, SPD: 2.5, ACC: 1.5, DEF: 2, CUR: 1.5, PAS: 1, OFF: 1, DRI: 1, TEC: 0.5 },
      DH: { DEF: 3, STA: 2, PAS: 2.5, RES: 1, BAL: 1, TEC: 1, SHP: 0.5 },
      SH: { PAS: 2.5, TEC: 2, DRI: 2, STA: 1.5, SPD: 1.5, CUR: 1.5, OFF: 1, DEF: 1, ACC: 1 },
      OH: { PAS: 3, TEC: 2.5, DRI: 2, OFF: 1.5, SHA: 1, CUR: 1, STA: 1, SPD: 0.5, ACC: 0.5 },
      CF: { OFF: 3, SHA: 2.5, DRI: 1.5, SPD: 1.5, TEC: 1, SHP: 1, HEA: 1, ACC: 1, BAL: 0.5 },
      WG: { OFF: 2, DRI: 2.5, SPD: 2, ACC: 1.5, TEC: 1.5, SHA: 1.5, PAS: 1, CUR: 1 },
    },
  },
  elenco: {
    convocaveis_minimo: 23,
    goleiros_minimo: 2,
    tamanho_nome_we: 10,
  },
  motor: {
    fator_posicao: { natural: 1, secundaria: 0.92, mesmo_setor: 0.85, fora: 0.7, goleiro_fora: 0.4 },
    condicao_limite: 60,
    condicao_reducao_max: 0.15,
    moral_amplitude: 0.05,
    mando_base: 0.055,
    mando_publico_max: 0.03,
    entrosamento_amplitude: 0.05,
    variacao_dia: 0.08,
    pesos_setor: {
      gol: { RES: 3, DEF: 1.5, JMP: 1, BAL: 0.5 },
      defesa: { DEF: 4, BAL: 1, SPD: 1, HEA: 1, JMP: 1, RES: 0.5 },
      meio: { PAS: 3, TEC: 2, DRI: 1.5, STA: 1.5, DEF: 1, BAL: 0.5 },
      ataque: { OFF: 3, SHA: 2, SHP: 1, DRI: 1.5, SPD: 1.5, ACC: 1, TEC: 1 },
    },
    contribuicao: {
      GK: { gol: 1 },
      CB: { defesa: 1, meio: 0.1 },
      SB: { defesa: 0.8, meio: 0.3, ataque: 0.2 },
      DH: { defesa: 0.5, meio: 0.9 },
      SH: { defesa: 0.2, meio: 0.8, ataque: 0.4 },
      OH: { meio: 0.8, ataque: 0.6 },
      CF: { meio: 0.1, ataque: 1 },
      WG: { meio: 0.3, ataque: 0.9 },
    },
    expoente_posse: 1,
    chance_jogada: 0.112,
    expoente_jogada: 1.2,
    conversao: 0.24,
    expoente_finalizacao: 1,
    chance_cabeceio: 0.25,
    chance_assistencia: 0.72,
    peso_finalizador: { GK: 0, CB: 0.4, SB: 0.4, DH: 0.8, SH: 1.3, OH: 2.2, CF: 4.5, WG: 2.6 },
    peso_assistente: { GK: 0.05, CB: 0.4, SB: 1, DH: 1, SH: 1.6, OH: 2.4, CF: 1.2, WG: 1.8 },
    falta_por_minuto: 0.16,
    amarelo_por_falta: 0.15,
    vermelho_direto_por_falta: 0.002,
    fator_agressividade: 0.05,
    cuidado_amarelado: 0.2,
    lesao_por_minuto: 0.0014,
    lesao_fator_cansaco: 2,
    acrescimo_primeiro: [0, 3],
    acrescimo_segundo: [1, 5],
    penalti_conversao: 0.75,
    penalti_ajuste: 0.015,
  },
  condicao: {
    gasto_por_90: 28,
    resistencia_base: 1.3,
    resistencia_por_ponto: 0.03,
    fole_base: 1.15,
    fole_por_ponto: 0.015,
    fator_idade_gasto: [
      { ate_idade: 23, fator: 0.95 },
      { ate_idade: 29, fator: 1 },
      { ate_idade: 32, fator: 1.1 },
      { ate_idade: 999, fator: 1.2 },
    ],
    recuperacao_por_dia: 7,
    fator_idade_recuperacao: [
      { ate_idade: 23, fator: 1.15 },
      { ate_idade: 29, fator: 1 },
      { ate_idade: 32, fator: 0.9 },
      { ate_idade: 999, fator: 0.8 },
    ],
    volta_de_lesao: 70,
  },
  lesoes: {
    faixas: [
      { nome: 'leve', peso: 70, semanas: [1, 2] },
      { nome: 'media', peso: 25, semanas: [3, 6] },
      { nome: 'grave', peso: 5, semanas: [8, 30] },
    ],
  },
  setas: {
    peso_condicao: 0.8,
    otima: 90,
    boa: 75,
    normal: 60,
    ruim: 45,
    reducao_we: [
      { abaixo_de: 30, niveis: 2 },
      { abaixo_de: 45, niveis: 1 },
    ],
  },
  moral: {
    padrao: 60,
    retorno_semanal: 1,
    vitoria: 3,
    empate: 0,
    derrota: -3,
    fator_jogo_grande: 2,
    gol: 2,
    assistencia: 1,
  },
  treino: {
    focos: {
      fisico: { atributos: ['SPD', 'ACC', 'STA', 'BAL', 'JMP'], recuperacao: 0.75, lesao: 1.3, entrosamento: -0.5 },
      tecnico: { atributos: ['PAS', 'DRI', 'TEC', 'CUR'], recuperacao: 1, lesao: 1, entrosamento: -0.5 },
      tatico: { atributos: [], recuperacao: 1, lesao: 1, entrosamento: 4 },
      ataque: { atributos: ['OFF', 'SHA', 'SHP', 'HEA'], recuperacao: 0.9, lesao: 1.1, entrosamento: -0.5 },
      defesa: { atributos: ['DEF', 'HEA', 'AGR'], so_goleiro: ['RES'], recuperacao: 0.9, lesao: 1.1, entrosamento: -0.5 },
      descanso: { atributos: [], recuperacao: 1.4, lesao: 0.5, entrosamento: -1 },
    },
    entrosamento_minimo: 40,
    entrosamento_troca_formacao: 0.5,
    entrosamento_reforco: -3,
  },
  oscilacao: { ativa: true, fracao_min: 0.01, fracao_max: 0.03, delta_min: 1, delta_max: 2 },
  exterior: { premio_salarial: 1.15, saida_por_virada: 0.15, idade_saida_dobrada: 35, arredondar_taxa: 5_000_000 },
  evolucao: {
    base: 0.03,
    divisor: 5,
    fator_idade: [
      { ate_idade: 21, fator: 1.5 },
      { ate_idade: 25, fator: 1 },
      { ate_idade: 28, fator: 0.5 },
      { ate_idade: 999, fator: 0.1 },
    ],
    minutos_bom: 60,
    fator_jogou_bem: 1.2,
    fator_entrou: 1,
    fator_nao_jogou: 0.7,
    idade_declinio: 29,
    declinio_por_ano: 0.008,
    atributos_fisicos: ['SPD', 'ACC', 'STA', 'BAL', 'JMP'],
  },
  ia: {
    rodizio_limite: { liga: 70, continental: 70, copa: 75, estadual: 80 },
    rodizio_critico: 50,
    rodizio_dias_sequencia: 4,
    rodizio_bonus_proximo_importante: 10,
    rodizio_maximo: { liga: 2, continental: 2, copa: 3, estadual: 4 },
    rodizio_maximo_decisivo: 1,
    rodizio_perda_maxima: { liga: 0.03, continental: 0.03, copa: 0.05, estadual: 0.08 },
    rodizio_perda_extra_critico: 0.05,
    ganho_troca_formacao: 0.03,
    cansaco_substituicao: 55,
    minuto_cansaco: 55,
    minuto_tatica: 65,
    minuto_segurar: 78,
    chance_tirar_amarelado: 0.35,
  },
  mercado: {
    valor_base: 180_000_000, // R$ 1,8 mi (escala das finanças do jogo)
    base_geral: 1.8,
    geral_referencia: 12,
    fator_idade: [
      { ate_idade: 21, fator: 1.2 },
      { ate_idade: 24, fator: 1.1 },
      { ate_idade: 27, fator: 1 },
      { ate_idade: 29, fator: 0.85 },
      { ate_idade: 31, fator: 0.65 },
      { ate_idade: 33, fator: 0.45 },
      { ate_idade: 999, fator: 0.3 },
    ],
    realizacao_potencial: [
      { ate_idade: 19, fator: 0.5 },
      { ate_idade: 21, fator: 0.4 },
      { ate_idade: 23, fator: 0.3 },
      { ate_idade: 25, fator: 0.2 },
      { ate_idade: 27, fator: 0.1 },
      { ate_idade: 999, fator: 0 },
    ],
    fator_contrato: [
      { ate_semanas: 26, fator: 0.5 },
      { ate_semanas: 52, fator: 0.75 },
      { ate_semanas: 99999, fator: 1 },
    ],
    fator_serie: { 'serie-a': 1, 'serie-b': 0.85, 'serie-c': 0.7, 'serie-d': 0.55 },
    fator_sem_liga: 0.55,
    arredondar: 5_000_000, // R$ 50 mil
    salario_base: 6_000_000, // R$ 60 mil
    base_geral_salario: 1.6,
    expoente_premio: 0.2,
    premio_minimo: 0.8,
    premio_maximo: 1.3,
    fator_serie_salario: { 'serie-a': 1, 'serie-b': 0.7, 'serie-c': 0.4, 'serie-d': 0.25 },
    fator_sem_liga_salario: 0.25,
    salario_minimo: 1_500_000, // R$ 15 mil
    multa_por_valor: 3,
    importancia: { titular: 1.4, reserva: 1.15, encostado: 1 },
    titulares: 11,
    reservas: 7,
    porte_vendedor_menor: 1.1,
    contraproposta_minima: 0.7,
    paciencia: 1.05,
    recusas_maximas: 3,
    jogador_mudanca: 1.1,
    jogador_porte_maior: 0.9,
    jogador_porte_menor: 1.15,
    jogador_contraproposta_minima: 0.85,
    movimentos_por_jogo: 5,
    taxa_emprestimo: 0.1,
    janelas: [
      { semana_inicio: 1, semana_fim: 16, nome: 'Início da temporada' },
      { semana_inicio: 27, semana_fim: 31, nome: 'Meio do Brasileirão' },
    ],
    elenco_minimo: 23,
    elenco_maximo: 32,
    intensidade: { baixa: 0.6, media: 1, alta: 1.4 },
    chance_porte_maior: 0.1,
    carencia_geral: 2,
    limites_porte: {
      grande: { salario_maximo: 0, geral_maximo: 0 },
      medio: { salario_maximo: 0, geral_maximo: 0 },
      pequeno: { salario_maximo: 8_000_000, geral_maximo: 13 }, // R$ 80 mil
    },
    nivel: {
      liga: { 'serie-a': 5, 'serie-b': 4, 'serie-c': 3, 'serie-d': 2 },
      sem_liga: 1,
      exterior: 5,
      salario_por_nivel: 0.3,
      queda_recusa: 2,
      idade_aceita_cair: 31,
      agio_rotacao: 1.3,
      margem_alvo: 2,
    },
    limites_nivel: {
      '1': { salario_maximo: 4_000_000, geral_maximo: 12 }, // sem liga: R$ 40 mil
      '2': { salario_maximo: 6_000_000, geral_maximo: 13 }, // Série D: R$ 60 mil
      '3': { salario_maximo: 12_000_000, geral_maximo: 15 }, // Série C: R$ 120 mil
    },
    pre_contrato: { semana_limite_renovacao: 46, por_saida: 0.6, maximo: 5 },
    ia: {
      grupos: {
        gol: { posicoes: ['GK'], minimo: 2, ideal: 3 },
        zaga: { posicoes: ['CB'], minimo: 3, ideal: 4 },
        lateral: { posicoes: ['SB'], minimo: 2, ideal: 4 },
        volante: { posicoes: ['DH'], minimo: 2, ideal: 4 },
        meia: { posicoes: ['OH', 'SH'], minimo: 2, ideal: 4 },
        ataque: { posicoes: ['CF', 'WG'], minimo: 4, ideal: 7 },
      },
      perfil: { meses_rico: 6, meses_apertado: 2, folha_apertado: 1.05, folha_crise: 1.25 },
      chegadas: {
        principal: { base: 1.5, por_carencia: 0.5, por_saida: 0.8, minimo: 1, maximo: 7 },
        outras: { base: 0, por_carencia: 0.4, por_saida: 0.5, minimo: 0, maximo: 3 },
      },
      fator_perfil_chegadas: { rico: 1.2, equilibrado: 1, apertado: 0.85, crise: 0.5 },
      fracao_verba: { rico: 0.6, equilibrado: 0.45, apertado: 0.25, crise: 0 },
      reinveste_venda: { rico: 0.7, equilibrado: 0.5, apertado: 0.3, crise: 0 },
      teto_folha: { rico: 1.15, equilibrado: 1.05, apertado: 1, crise: 1 },
      meses_custo_salario: 12,
      desconto_a_venda: 0.85,
      desconto_crise: 0.75,
      idade_emprestimo: 21,
      peso_saida_prevista: 0.5,
      propostas: {
        minimo: [1, 2],
        maximo: 10,
        por_interessante: 0.3,
        clubes_para_interesse_cheio: 4,
        fator_outras_janelas: 0.6,
        peso_a_venda: 3,
        peso_contrato_acabando: 1.5,
        peso_jovem: 1.3,
        idade_jovem: 23,
        oferta: { rico: [0.95, 1.25], equilibrado: [0.85, 1.1], apertado: [0.75, 0.95] },
        oferta_a_venda: [0.8, 1],
        teto: { rico: 1.4, equilibrado: 1.2, apertado: 1.05 },
        cobre_ate: 1.15,
        prazo_semanas: 2,
      },
    },
  },
  financas: {
    ciclo_semanas: 4,
    cota_tv: { 'serie-a': 6_000_000_000, 'serie-b': 1_500_000_000, 'serie-c': 300_000_000, 'serie-d': 100_000_000 },
    cota_tv_sem_liga: 100_000_000,
    demanda_base: { grande: 0.75, medio: 0.6, pequeno: 0.5 },
    fator_adversario: { grande: 1.25, medio: 1, pequeno: 0.85 },
    fator_competicao: { liga: 1, copa: 1.1, estadual: 0.75, continental: 1.2, final: 1.4 },
    peso_momento: 0.4,
    preco_base: 1.15,
    preco_peso: 0.25,
    preco_minimo: 0.15,
    preco_maximo: 1,
    orcamento_dificuldade: { facil: 1.25, normal: 1, dificil: 0.75 },
    orcamento_divisao: { liga: { 'serie-a': 1, 'serie-b': 0.85, 'serie-c': 0.6, 'serie-d': 0.45 }, sem_liga: 0.4 },
  },
  diretoria: {
    confianca_inicial: 60,
    limite_demissao: { facil: 10, normal: 20, dificil: 30 },
    avaliacoes_para_demissao: 2,
    peso_jogo: 3,
    saldo_negativo: -3,
    folha_acima: -2,
    meta_posicao: { grande: 0.3, medio: 0.55, pequeno: 0.8 },
    meta_dificuldade: { facil: 2, normal: 0, dificil: -2 },
    meta_atingida: 15,
    meta_perdida: -20,
  },
  noticias: { maximo_por_avaliacao: 1, fator_chance: 1, semana_aviso_contratos: 30, transferencias_por_data: 3 },
  // Propostas iniciais (calibrar na fase 6). R$ em centavos.
  padrao_por_porte: {
    grande: {
      saldo_inicial: 5_000_000_000, // R$ 50 mi
      patrocinio_temporada: 8_000_000_000, // R$ 80 mi
      orcamento_folha_mensal: 1_200_000_000, // R$ 12 mi
      capacidade: 45_000,
      ingresso_padrao: 6_000, // R$ 60
      custo_por_jogo: 40_000_000, // R$ 400 mil
    },
    medio: {
      saldo_inicial: 1_500_000_000,
      patrocinio_temporada: 2_500_000_000,
      orcamento_folha_mensal: 400_000_000,
      capacidade: 25_000,
      ingresso_padrao: 4_000,
      custo_por_jogo: 15_000_000,
    },
    pequeno: {
      saldo_inicial: 300_000_000,
      patrocinio_temporada: 600_000_000,
      orcamento_folha_mensal: 100_000_000,
      capacidade: 12_000,
      ingresso_padrao: 2_500,
      custo_por_jogo: 5_000_000,
    },
  },
}

export type Parcial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: Parcial<T[K]> }
    : T

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Aplica as regras do pacote sobre os padrões. Objetos são mesclados chave a chave;
 * listas e valores simples são substituídos inteiros. Chaves desconhecidas são ignoradas
 * (a validação do `regras.json` acusa no editor). Nunca altera os argumentos.
 */
export function mesclarRegras(base: Regras, sobrescrita: Parcial<Regras> | undefined): Regras {
  return mesclar(base, sobrescrita, '') as Regras
}

/** Caminhos que são mapas livres (as chaves vêm do pacote, não dos padrões). */
const MAPAS = new Set(['jogadores.pesos_geral', 'mercado.fator_serie', 'mercado.fator_serie_salario', 'financas.cota_tv'])
/** Mapas cujos itens o pacote substitui inteiros (os pesos de uma posição não se misturam aos padrões). */
const SUBSTITUI_ITENS = new Set(['jogadores.pesos_geral'])

function mesclar(base: unknown, sobre: unknown, caminho: string): unknown {
  if (sobre === undefined) return clonar(base)
  if (!ehObjeto(base) || !ehObjeto(sobre)) {
    // Tipo diferente do padrão (ex.: texto onde se espera número): fica o padrão.
    if (ehObjeto(base) !== ehObjeto(sobre) || Array.isArray(base) !== Array.isArray(sobre)) return clonar(base)
    if (typeof base !== typeof sobre) return clonar(base)
    return clonar(sobre)
  }
  const chaves = MAPAS.has(caminho) ? new Set([...Object.keys(base), ...Object.keys(sobre)]) : Object.keys(base)
  const saida: Record<string, unknown> = {}
  for (const chave of chaves) {
    const sub = caminho ? `${caminho}.${chave}` : chave
    const substitui = SUBSTITUI_ITENS.has(caminho) && ehObjeto(sobre[chave])
    saida[chave] = chave in base && !substitui ? mesclar(base[chave], sobre[chave], sub) : clonar(sobre[chave])
  }
  return saida
}

function clonar<T>(v: T): T {
  return structuredClone(v)
}
