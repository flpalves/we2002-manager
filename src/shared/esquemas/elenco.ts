import { z } from 'zod'
import { AparenciaSchema } from './pacote'

export const SetaSchema = z.enum(['otima', 'boa', 'normal', 'ruim', 'pessima'])
export const FocoSchema = z.enum(['fisico', 'tecnico', 'tatico', 'ataque', 'defesa', 'descanso'])

export const JogadorElencoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  nomeWe: z.string(),
  posicao: z.string(),
  posicaoSecundaria: z.string().nullable(),
  camisa: z.number().int(),
  idade: z.number().int(),
  nacionalidade: z.string(),
  geral: z.number().int(),
  condicao: z.number(),
  moral: z.number(),
  seta: SetaSchema,
  /** Semanas que faltam para voltar de lesão (0 = disponível). */
  lesaoSemanas: z.number().int(),
  /** Competições em que está suspenso. */
  suspenso: z.array(z.string()),
  /** Amarelos pendurados (a um cartão da suspensão) por competição. */
  pendurado: z.array(z.string()),
  contratoAte: z.number().int().nullable(),
  salario: z.number().int(),
  /** Valor de mercado (centavos). */
  valor: z.number().int(),
})
export type JogadorElenco = z.infer<typeof JogadorElencoSchema>

export const ElencoSchema = z.object({
  time: z.string(),
  entrosamento: z.number(),
  jogadores: z.array(JogadorElencoSchema),
})
export type Elenco = z.infer<typeof ElencoSchema>

export const LinhaHistoricoSchema = z.object({
  competicao: z.string(),
  jogos: z.number().int(),
  minutos: z.number().int(),
  gols: z.number().int(),
  assistencias: z.number().int(),
  amarelos: z.number().int(),
  vermelhos: z.number().int(),
})

export const EvolucaoSchema = z.object({
  semana: z.number().int(),
  jogadorId: z.string(),
  jogador: z.string(),
  atributo: z.string(),
  delta: z.number().int(),
  motivo: z.string(),
})
export type Evolucao = z.infer<typeof EvolucaoSchema>

export const FichaJogadorSchema = JogadorElencoSchema.extend({
  time: z.string(),
  pe: z.string(),
  altura: z.number().int(),
  outside: z.boolean(),
  atributos: z.record(z.string(), z.number().int()),
  /** Número que o WE vai mostrar (12-19), já com a redução por condição. */
  atributosWe: z.record(z.string(), z.number().int()),
  potencial: z.object({ min: z.number().int(), max: z.number().int() }),
  aparencia: AparenciaSchema.nullable(),
  historico: z.array(LinhaHistoricoSchema),
  evolucoes: z.array(EvolucaoSchema),
})
export type FichaJogador = z.infer<typeof FichaJogadorSchema>

export const TreinoSchema = z.object({
  foco: FocoSchema,
  focos: z.array(
    z.object({
      id: FocoSchema,
      atributos: z.array(z.string()),
      recuperacao: z.number(),
      lesao: z.number(),
      entrosamento: z.number(),
    }),
  ),
  entrosamento: z.number(),
  condicaoMedia: z.number(),
  moralMedia: z.number(),
  lesionados: z.number().int(),
  evolucoes: z.array(EvolucaoSchema),
})
export type Treino = z.infer<typeof TreinoSchema>

// ------------------------------------------------------------------ escalação (fase 8)

export const EscalacaoSalvaSchema = z.object({
  formacao: z.string(),
  /** 11 ids na ordem das vagas (0 = goleiro); null = vaga vazia (a IA completa no dia). */
  titulares: z.array(z.string().nullable()).length(11),
  reservas: z.array(z.string()).max(12),
})

export const EscalacaoSchema = z.object({
  /** A IA escala a cada jogo (nada salvo). */
  automatica: z.boolean(),
  formacao: z.string(),
  /** Papel de cada vaga (GK, CB...) em cada formação do WE. */
  formacoes: z.array(z.object({ id: z.string(), papeis: z.array(z.string()) })),
  titulares: z.array(z.string().nullable()),
  reservas: z.array(z.string()),
  /** Escalação que vai a campo no próximo jogo (com os desfalques trocados pela IA). */
  noProximoJogo: z.object({ titulares: z.array(z.string()), reservas: z.array(z.string()), substituidos: z.array(z.string()) }).nullable(),
  proximoJogo: z.object({ competicao: z.string(), adversario: z.string(), emCasa: z.boolean() }).nullable(),
  entrosamento: z.number(),
})
export type Escalacao = z.infer<typeof EscalacaoSchema>
