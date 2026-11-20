import { z } from 'zod'

/** DTOs das telas de calendário e competições e do Continuar. */

export const PlacarSchema = z.object({
  golsCasa: z.number().int(),
  golsVisitante: z.number().int(),
  prorrogacao: z.boolean(),
  penaltisCasa: z.number().int().nullable(),
  penaltisVisitante: z.number().int().nullable(),
})
export type Placar = z.infer<typeof PlacarSchema>

export const JogoSchema = z.object({
  id: z.string(),
  passo: z.number().int(),
  semana: z.number().int(),
  competicao: z.string(),
  competicaoNome: z.string(),
  fase: z.string(),
  faseNome: z.string(),
  grupo: z.string().nullable(),
  rodada: z.number().int(),
  jogo: z.number().int(),
  casa: z.string(),
  visitante: z.string(),
  placar: PlacarSchema.nullable(),
})
export type Jogo = z.infer<typeof JogoSchema>

export const TimeResumoSchema = z.object({
  sigla: z.string(),
  nome: z.string(),
  cores: z.array(z.string()),
  escudo: z.string().nullable(),
})
export type TimeResumo = z.infer<typeof TimeResumoSchema>

export const CalendarioSchema = z.object({
  temporada: z.number().int(),
  passoAtual: z.number().int(),
  /** Última semana que já passou (0 = nenhuma): o Continuar anda uma por vez. */
  semanaAtual: z.number().int(),
  encerrada: z.boolean(),
  passos: z.array(
    z.object({
      indice: z.number().int(),
      semana: z.number().int(),
      tipo: z.enum(['meio', 'fds']),
      /** Jogo do usuário nesse passo (se houver). */
      jogo: JogoSchema.nullable(),
      /** Competições com jogo nesse passo. */
      competicoes: z.array(z.string()),
    }),
  ),
})
export type Calendario = z.infer<typeof CalendarioSchema>

export const LinhaTabelaSchema = z.object({
  time: z.string(),
  posicao: z.number().int(),
  jogos: z.number().int(),
  vitorias: z.number().int(),
  empates: z.number().int(),
  derrotas: z.number().int(),
  golsPro: z.number().int(),
  golsContra: z.number().int(),
  saldo: z.number().int(),
  pontos: z.number().int(),
  ultimos: z.array(z.enum(['V', 'E', 'D'])),
  /** Zona da tabela (cor do design system), se houver. */
  zona: z.object({ nome: z.string(), cor: z.string() }).nullable(),
})

export type LinhaTabela = z.infer<typeof LinhaTabelaSchema>

export const ConfrontoSchema = z.object({
  id: z.string(),
  rodada: z.number().int(),
  jogos: z.array(JogoSchema),
  vencedor: z.string().nullable(),
})

export const FaseVisaoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  formato: z.enum(['pontos_corridos', 'grupos', 'mata_mata']),
  iniciada: z.boolean(),
  encerrada: z.boolean(),
  tabelas: z.array(z.object({ grupo: z.string().nullable(), linhas: z.array(LinhaTabelaSchema) })),
  confrontos: z.array(ConfrontoSchema),
  /** Rodadas da fase (pontos corridos e grupos). */
  rodadas: z.array(z.object({ rodada: z.number().int(), jogos: z.array(JogoSchema) })),
})

export const EdicaoResumoSchema = z.object({
  id: z.string(),
  competicao: z.string(),
  nome: z.string(),
  campeao: z.string().nullable(),
  usuarioParticipa: z.boolean(),
})
export type EdicaoResumo = z.infer<typeof EdicaoResumoSchema>

export const EdicaoDetalheSchema = EdicaoResumoSchema.extend({ fases: z.array(FaseVisaoSchema) })
export type EdicaoDetalhe = z.infer<typeof EdicaoDetalheSchema>

export const ResultadoContinuarSchema = z.object({
  passosJogados: z.number().int(),
  semana: z.number().int(),
  encerrada: z.boolean(),
  /** Jogo do usuário que acabou de ser jogado. */
  jogoDoUsuario: JogoSchema.nullable(),
  /** Jogo do usuário na data atual, esperando o pré-jogo. */
  preJogo: JogoSchema.nullable(),
  /** Campeões decididos neste avanço. */
  campeoes: z.array(z.object({ competicao: z.string(), time: z.string() })),
  /** Uma notícia pede decisão do usuário (o Continuar parou por ela). */
  eventoPendente: z.boolean(),
})
export type ResultadoContinuar = z.infer<typeof ResultadoContinuarSchema>

export const EventoSumulaSchema = z.object({
  minuto: z.number().int(),
  acrescimo: z.number().int(),
  tipo: z.enum(['gol', 'amarelo', 'vermelho', 'lesao', 'substituicao']),
  time: z.string(),
  /** Autor, cartão, lesionado ou quem sai. */
  jogador: z.string().nullable(),
  /** Assistência ou quem entra. */
  outro: z.string().nullable(),
  detalhe: z.string().nullable(),
})

export const AtuacaoSchema = z.object({
  jogador: z.string(),
  camisa: z.number().int(),
  posicao: z.string(),
  titular: z.boolean(),
  minutos: z.number().int(),
})

export const SumulaSchema = z.object({
  jogo: JogoSchema,
  eventos: z.array(EventoSumulaSchema),
  casa: z.array(AtuacaoSchema),
  visitante: z.array(AtuacaoSchema),
})
export type Sumula = z.infer<typeof SumulaSchema>

export const ArtilheiroSchema = z.object({
  jogador: z.string(),
  time: z.string(),
  gols: z.number().int(),
  assistencias: z.number().int(),
  jogos: z.number().int(),
})
export type Artilheiro = z.infer<typeof ArtilheiroSchema>

// ---------------------------------------------------------------- virada de temporada (fase 9)

export const ContratoAcabandoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  posicao: z.string(),
  idade: z.number().int(),
  geral: z.number(),
  /** Assinou pré-contrato com este clube (nome): sai na virada. */
  preContrato: z.string().nullable().optional(),
})
export type ContratoAcabando = z.infer<typeof ContratoAcabandoSchema>

/** O que a temporada encerrada deixou: vale para a prévia e para o relatório gravado. */
export const BalancoTemporadaSchema = z.object({
  temporada: z.number().int(),
  campeoes: z.array(z.object({ competicao: z.string(), time: z.string() })),
  /** Acessos e rebaixamentos (nomes das competições). */
  movimentos: z.array(z.object({ time: z.string(), de: z.string(), para: z.string(), tipo: z.string() })),
  artilheiros: z.array(z.object({ competicao: z.string(), jogador: z.string(), time: z.string(), gols: z.number().int() })),
  /** Campanha do usuário em cada competição disputada. */
  campanhas: z.array(z.object({ competicao: z.string(), posicao: z.number().int().nullable(), campeao: z.boolean() })),
})
export type BalancoTemporada = z.infer<typeof BalancoTemporadaSchema>

/** Antes de virar: o balanço e os contratos do usuário que vão acabar (pendência de renovação). */
export const PreviaViradaSchema = BalancoTemporadaSchema.extend({
  contratosAcabando: z.array(ContratoAcabandoSchema),
  /** Quantos dos que acabam a diretoria renova por 1 temporada para o elenco não ficar abaixo do mínimo. */
  minimoElenco: z.number().int(),
  elencoAtual: z.number().int(),
  /** Ainda dá para renovar (antes da semana limite de renovação). */
  renovacaoAberta: z.boolean().optional(),
  semanaLimiteRenovacao: z.number().int().optional(),
  /** Quem chega por pré-contrato na virada. */
  chegam: z.array(z.object({ id: z.string(), nome: z.string(), posicao: z.string(), de: z.string() })).optional(),
})
export type PreviaVirada = z.infer<typeof PreviaViradaSchema>

export const RelatorioTemporadaSchema = BalancoTemporadaSchema.extend({
  time: z.string(),
  metas: z.array(z.object({ descricao: z.string(), atingida: z.boolean(), critica: z.boolean() })),
  confianca: z.number().int(),
  demitido: z.boolean(),
  saldo: z.number().int(),
  /** Contratos do usuário: quem saiu livre e quem a diretoria renovou para completar o elenco. */
  saidas: z.array(z.string()),
  renovadosPelaDiretoria: z.array(z.string()),
  voltaramDeEmprestimo: z.array(z.string()),
  /** Chegaram ao clube do usuário por pré-contrato. */
  chegaramPorPreContrato: z.array(z.string()).optional(),
  proximaTemporada: z.number().int(),
})
export type RelatorioTemporada = z.infer<typeof RelatorioTemporadaSchema>
