import { z } from 'zod'

export const DificuldadeSchema = z.enum(['facil', 'normal', 'dificil'])

/** Uma cópia de segurança da carreira (autosave-<numero>.sqlite; 1 = a mais nova). */
export const AutosaveSchema = z.object({
  numero: z.number().int().min(1),
  /** Momento real da cópia (metadado; nada do jogo usa). */
  em: z.string(),
  temporada: z.number().int(),
  semana: z.number().int(),
  motivo: z.string(),
})
export type Autosave = z.infer<typeof AutosaveSchema>

export const ResumoCarreiraSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tecnico: z.string(),
  pacote: z.string(),
  dificuldade: z.string(),
  temporada: z.number().int(),
  semana: z.number().int(),
  criadaEm: z.string(),
  /** Saldo do clube do usuário, em centavos. */
  saldo: z.number().int(),
  time: z.object({
    sigla: z.string(),
    nome: z.string(),
    cores: z.array(z.string()),
    /** Caminho do escudo dentro da pasta da carreira. */
    escudo: z.string().nullable(),
  }),
  /** Último autosave (null = ainda nenhum). */
  ultimoAutosave: AutosaveSchema.nullable(),
})
export type ResumoCarreira = z.infer<typeof ResumoCarreiraSchema>

export const EntradaCarreiraNovaSchema = z.object({
  pacote: z.string().regex(/^[a-z0-9-]+$/),
  time: z.string().min(1),
  tecnico: z.string().trim().min(1, 'informe o nome do técnico').max(40),
  nome: z.string().max(60),
  dificuldade: DificuldadeSchema,
})
