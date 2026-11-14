import { z } from 'zod'

export const TemaSchema = z.enum(['escuro', 'claro'])
export type Tema = z.infer<typeof TemaSchema>

export const CaminhosSchema = z.object({
  /** Executável do PCSX-Redux. */
  emulador: z.string(),
  /** Imagem do jogo (.cue), serial SLPM-87056. */
  imagem: z.string(),
  /** Pasta dos save states base. */
  estados: z.string(),
})
export type Caminhos = z.infer<typeof CaminhosSchema>

/** `config.json` do app, em `userData`, fora de qualquer carreira. */
export const ConfigAppSchema = z.object({
  versao: z.literal(1),
  tema: TemaSchema,
  pastaCarreiras: z.string().min(1),
  /** Onde ficam os pacotes de dados (pacotes/<id>/). */
  pastaPacotes: z.string().min(1),
  caminhos: CaminhosSchema,
})
export type ConfigApp = z.infer<typeof ConfigAppSchema>

export const ConfigAppParcialSchema = z.object({
  tema: TemaSchema.optional(),
  pastaCarreiras: z.string().min(1).optional(),
  pastaPacotes: z.string().min(1).optional(),
  caminhos: CaminhosSchema.partial().optional(),
})
export type ConfigAppParcial = z.infer<typeof ConfigAppParcialSchema>
