import { z } from 'zod'

/**
 * Notícias e eventos (09). Catálogo de eventos aleatórios (`noticias.json` do pacote) e os
 * DTOs da caixa de notícias.
 */

export const TIPOS_NOTICIA = ['elenco', 'diretoria', 'mercado', 'financas', 'torcida', 'imprensa', 'jogo', 'competicao'] as const
export const TipoNoticiaSchema = z.enum(TIPOS_NOTICIA)
export type TipoNoticia = z.infer<typeof TipoNoticiaSchema>

export const MOMENTOS = ['semana', 'pos_jogo', 'janela_abre', 'janela_fecha', 'virada'] as const
export const MomentoSchema = z.enum(MOMENTOS)
export type Momento = z.infer<typeof MomentoSchema>

/** Campos que as condições podem ler (ver core/noticias/motor.ts). */
export const CAMPOS_CONDICAO = [
  'jogador.idade',
  'jogador.moral',
  'jogador.condicao',
  'jogador.geral',
  'jogador.potencial',
  'jogador.titular',
  'time.saldo',
  'time.confianca',
  'time.aproveitamento',
  'time.folha_acima',
  'time.moral_media',
  'partida.resultado',
  'partida.gols_pro',
  'partida.gols_contra',
  'partida.em_casa',
] as const

export const CondicaoSchema = z.object({
  campo: z.enum(CAMPOS_CONDICAO),
  op: z.enum(['<', '<=', '>', '>=', '==', '!=']),
  /** Número; em `partida.resultado`: "V", "E" ou "D"; booleanos como 0/1. */
  valor: z.union([z.number(), z.string()]),
})
export type Condicao = z.infer<typeof CondicaoSchema>

export const CAMPOS_EFEITO = [
  'moral',
  'moral_elenco',
  'condicao',
  'atributo',
  'atributo_aleatorio',
  'atributo_aleatorio_do_foco',
  'potencial',
  'confianca',
  'saldo',
  'lesao',
  'disponibilidade',
  'interesse_mercado',
] as const

export const EfeitoSchema = z.object({
  campo: z.enum(CAMPOS_EFEITO),
  /** moral, condição, atributo, potencial, confiança: variação. */
  delta: z.number().optional(),
  /** saldo: centavos (+ receita, − despesa). */
  valor: z.number().int().optional(),
  /** lesão e disponibilidade. */
  semanas: z.number().int().min(1).max(52).optional(),
  /** atributo: sigla do atributo (ex.: "SHA"). */
  atributo: z.string().optional(),
  /** Chance do efeito acontecer (padrão 1). */
  chance: z.number().min(0).max(1).optional(),
})
export type Efeito = z.infer<typeof EfeitoSchema>

export const AlvoSchema = z.enum(['jogador_aleatorio_do_usuario', 'jogador_condicionado', 'time_usuario', 'time_qualquer'])

export const EventoCatalogoSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  tipo: TipoNoticiaSchema,
  gatilho: z.object({ momento: MomentoSchema, condicoes: z.array(CondicaoSchema).default([]) }),
  alvo: AlvoSchema,
  chance: z.number().min(0).max(1),
  intervalo_minimo_semanas: z.number().int().min(0).default(0),
  /** Marcadores: {jogador}, {time}, {clube} (time qualquer), {valor} (saldo do 1º efeito). */
  texto: z.string().min(1),
  efeitos: z.array(EfeitoSchema).default([]),
  escolhas: z
    .array(z.object({ id: z.string(), texto: z.string(), resultado: z.string().optional(), efeitos: z.array(EfeitoSchema).default([]) }))
    .min(2)
    .nullable()
    .default(null),
})
export type EventoCatalogo = z.infer<typeof EventoCatalogoSchema>
export type EventoCatalogoEntrada = z.input<typeof EventoCatalogoSchema>

export const CatalogoSchema = z.array(EventoCatalogoSchema).superRefine((lista, ctx) => {
  const vistos = new Set<string>()
  for (const [i, e] of lista.entries()) {
    if (vistos.has(e.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `id repetido: ${e.id}` })
    vistos.add(e.id)
  }
})

// ------------------------------------------------------------------ caixa de notícias

export const NoticiaSchema = z.object({
  id: z.number().int(),
  temporada: z.number().int(),
  semana: z.number().int(),
  tipo: TipoNoticiaSchema,
  /** Informativa (gerada pelo jogo) ou evento do catálogo. */
  origem: z.enum(['info', 'evento']),
  evento: z.string().nullable(),
  texto: z.string(),
  jogadorId: z.string().nullable(),
  time: z.string().nullable(),
  lida: z.boolean(),
  /** Evento com escolha esperando resposta (bloqueia o Continuar). */
  pendente: z.boolean(),
  escolhas: z.array(z.object({ id: z.string(), texto: z.string() })).nullable(),
  escolhaFeita: z.string().nullable(),
  /** Efeitos aplicados, em texto para a interface. */
  efeitos: z.array(z.string()),
})
export type Noticia = z.infer<typeof NoticiaSchema>

export const CaixaNoticiasSchema = z.object({
  noticias: z.array(NoticiaSchema),
  naoLidas: z.number().int(),
  pendentes: z.number().int(),
})
export type CaixaNoticias = z.infer<typeof CaixaNoticiasSchema>
