import { z } from 'zod'
import { ElencoSchema } from './elenco'

/** Página de um clube qualquer da carreira: dados, elenco e escalação provável. */
export const DetalheTimeSchema = z.object({
  sigla: z.string(),
  nome: z.string(),
  nomeCurto: z.string(),
  pais: z.string(),
  estado: z.string().nullable(),
  porte: z.enum(['grande', 'medio', 'pequeno']),
  cores: z.array(z.string()),
  escudo: z.string().nullable(),
  estadio: z.object({ nome: z.string(), capacidade: z.number().int() }),
  /** É o clube do usuário. */
  usuario: z.boolean(),
  elenco: ElencoSchema,
  /** Escalação que a IA (ou o usuário, se salvou) põe em campo no próximo jogo; null = menos de 11. */
  escalacao: z
    .object({
      formacao: z.string(),
      papeis: z.array(z.string()),
      titulares: z.array(z.string()),
      reservas: z.array(z.string()),
    })
    .nullable(),
  proximoJogo: z.object({ competicao: z.string(), adversario: z.string(), emCasa: z.boolean() }).nullable(),
})
export type DetalheTime = z.infer<typeof DetalheTimeSchema>

export const TransferenciaSchema = z.object({
  id: z.number().int(),
  temporada: z.number().int(),
  semana: z.number().int(),
  jogadorId: z.string(),
  jogador: z.string(),
  posicao: z.string(),
  nacionalidade: z.string(),
  idade: z.number().int(),
  /** null = estava sem clube. */
  de: z.string().nullable(),
  para: z.string().nullable(),
  tipo: z.string(),
  /** Centavos. */
  valor: z.number().int(),
  /** Salário mensal no clube novo (centavos). */
  salario: z.number().int(),
})
export type Transferencia = z.infer<typeof TransferenciaSchema>

export const FiltroTransferenciasSchema = z.object({
  /** Só as que envolvem este clube (chegada ou saída). */
  sigla: z.string().optional(),
  /** Temporada; sem ela, a atual. */
  temporada: z.number().int().optional(),
})

export const ListaTransferenciasSchema = z.object({
  temporada: z.number().int(),
  /** Temporadas com alguma transferência (mais a atual), da mais recente para a mais antiga. */
  temporadas: z.array(z.number().int()),
  lista: z.array(TransferenciaSchema),
  /** Só com `sigla`: quanto o clube gastou e arrecadou na temporada (centavos). */
  saldo: z.object({ gasto: z.number().int(), arrecadado: z.number().int(), chegadas: z.number().int(), saidas: z.number().int() }).nullable(),
})
export type ListaTransferencias = z.infer<typeof ListaTransferenciasSchema>
