import { z } from 'zod'
import { JogoSchema } from './temporada'
import { SetaSchema } from './elenco'

/** DTOs do pré-jogo, da tela "No emulador" e do pós-jogo (fase 5). */

export const ControleSchema = z.enum(['p1_cpu', 'cpu_p1', 'p1_p2', 'cpu_cpu'])

export const AmbienteWeSchema = z.object({
  raiz: z.string(),
  emulador: z.boolean(),
  imagem: z.boolean(),
  bat: z.boolean(),
  /** Estados base que existem em states/. */
  estados: z.array(ControleSchema),
})
export type AmbienteWe = z.infer<typeof AmbienteWeSchema>

export const EscaladoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  /** Papel da vaga (titulares) ou posição natural (reservas). */
  posicao: z.string(),
  camisa: z.number().int(),
  condicao: z.number(),
  seta: SetaSchema,
})

export const LadoPreJogoSchema = z.object({
  sigla: z.string(),
  formacao: z.string(),
  uniforme: z.enum(['titular', 'reserva']),
  titulares: z.array(EscaladoSchema),
  reservas: z.array(EscaladoSchema),
  desfalques: z.array(z.object({ nome: z.string(), motivo: z.string() })),
})

export const PlacarWeSchema = z.object({
  golsCasa: z.number().int(),
  golsVisitante: z.number().int(),
  penaltisCasa: z.number().int().nullable(),
  penaltisVisitante: z.number().int().nullable(),
  prorrogacao: z.boolean(),
})

export const StatusWeSchema = z.object({
  estado: z.enum(['sem_partida', 'aguardando', 'parcial', 'final', 'invalido']),
  /** partida_id gravado no partida.json. */
  partidaWe: z.string().nullable(),
  jogo: JogoSchema.nullable(),
  controle: ControleSchema.nullable(),
  invertido: z.boolean(),
  modo: z.enum(['jogar', 'assistir']).nullable(),
  /** Já no mando real. */
  placar: PlacarWeSchema.nullable(),
  fase: z.string().nullable(),
  gols: z.array(z.object({ lado: z.enum(['casa', 'visitante']), minuto: z.number().int(), autor: z.string().nullable(), assistencia: z.string().nullable() })),
  motivo: z.string().nullable(),
  /** No mata-mata de ida e volta, o manager decide os pênaltis se o agregado empatar. */
  penaltisNoManager: z.boolean(),
  iniciadoEm: z.string().nullable(),
})
export type StatusWe = z.infer<typeof StatusWeSchema>

export const PreJogoSchema = z.object({
  jogo: JogoSchema,
  /** Texto curto do que acontece em caso de empate. */
  decisao: z.string(),
  precisaVencedor: z.boolean(),
  casa: LadoPreJogoSchema,
  visitante: LadoPreJogoSchema,
  /** Para o modo "jogar" (o pré-jogo mostra o que vai acontecer). */
  controle: ControleSchema,
  invertido: z.boolean(),
  ambiente: AmbienteWeSchema,
  pendente: StatusWeSchema.nullable(),
})
export type PreJogo = z.infer<typeof PreJogoSchema>

export const PlacarManualSchema = z.object({
  golsCasa: z.number().int().min(0).max(30),
  golsVisitante: z.number().int().min(0).max(30),
  penaltisCasa: z.number().int().min(0).max(30).nullable(),
  penaltisVisitante: z.number().int().min(0).max(30).nullable(),
})
