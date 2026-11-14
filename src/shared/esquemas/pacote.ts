import { z } from 'zod'
import type { EventoCatalogo } from './noticias'

/**
 * Formato do pacote de dados (docs/spec/02-dados.md). Os esquemas validam a FORMA de cada
 * arquivo; as regras de consistência entre arquivos (escudo faltando, elenco incompleto,
 * camisa repetida...) ficam em `src/core/pacote/validar.ts`.
 */

export const POSICOES = ['GK', 'CB', 'SB', 'DH', 'SH', 'OH', 'CF', 'WG'] as const
export const PosicaoSchema = z.enum(POSICOES)
export type Posicao = z.infer<typeof PosicaoSchema>

/** Os 16 atributos do WE (15 do painel + AGREC), na escala 1-20 do manager. */
export const ATRIBUTOS = ['OFF', 'DEF', 'BAL', 'STA', 'SPD', 'ACC', 'RES', 'DRI', 'PAS', 'SHP', 'SHA', 'TEC', 'HEA', 'JMP', 'CUR', 'AGR'] as const
export type Atributo = (typeof ATRIBUTOS)[number]

/** Rótulos do menu de edição do WE (BR). */
export const ROTULO_ATRIBUTO: Record<Atributo, string> = {
  OFF: 'ATAQU',
  DEF: 'DEFESA',
  BAL: 'EQUILI.',
  STA: 'FOLE',
  SPD: 'VELOC.',
  ACC: 'ACELE.',
  RES: 'REFLE.',
  DRI: 'DRIBLE',
  PAS: 'PAS',
  SHP: 'CHU.F.',
  SHA: 'CHUTE M.',
  TEC: 'TECN.',
  HEA: 'CABECI.',
  JMP: 'PULO',
  CUR: 'CURV',
  AGR: 'AGREC.',
}

const Nota = z.number().int().min(1).max(20)
export const AtributosSchema = z.object(Object.fromEntries(ATRIBUTOS.map((a) => [a, Nota])) as Record<Atributo, typeof Nota>)
export type Atributos = z.infer<typeof AtributosSchema>

const letras = (ate: string) => z.string().regex(new RegExp(`^[A-${ate}]$`), `letra de A a ${ate}`)

/** 32 modelos de cabelo do menu de edição, na ordem dos bits (docs/we/offsets-we2002.md). */
export const CABELOS = [
  'a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2', 'f1',
  'f2', 'f3', 'g1', 'h1', 'i1', 'i2', 'i3', 'j1', 'k1', 'l1', 'l2', 'l3', 'm1', 'n1', 'o1', 'p1',
] as const

/** Mesmo formato que a ponte e o `tools/lib/registro.mjs` já gravam na RAM. */
export const AparenciaSchema = z.object({
  pele: z.number().int().min(1).max(4),
  fisico: letras('H'),
  cabelo: z.enum(CABELOS),
  cor_cabelo: letras('H'),
  barba: letras('G'),
  cor_barba: letras('G'),
  chuteira: letras('H'),
})
export type Aparencia = z.infer<typeof AparenciaSchema>

export const APARENCIA_PADRAO: Aparencia = { pele: 2, fisico: 'F', cabelo: 'i1', cor_cabelo: 'A', barba: 'A', cor_barba: 'A', chuteira: 'A' }

const Centavos = z.number().int().min(0)
const CodigoPais = z.string().regex(/^[A-Z]{3}$/, 'código de 3 letras maiúsculas')

export const ContratoSchema = z.object({
  salario_mensal: Centavos,
  ate_temporada: z.number().int().min(2000).max(2200),
  multa: Centavos,
})

export const JogadorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'só letras minúsculas, números e hífen'),
  nome: z.string().min(1),
  nome_we: z.string(),
  posicao: PosicaoSchema,
  posicao_secundaria: PosicaoSchema.nullable().optional(),
  camisa: z.number().int().min(1).max(32),
  camisa_real: z.number().int().min(1).max(99).nullable().optional(),
  idade: z.number().int().min(14).max(50),
  nacionalidade: CodigoPais,
  pe: z.enum(['destro', 'canhoto', 'ambidestro']),
  altura: z.number().int().min(148).max(211),
  atributos: AtributosSchema,
  outside: z.boolean(),
  potencial: Nota,
  resistencia: Nota,
  moral_inicial: z.number().int().min(0).max(100).optional(),
  contrato: ContratoSchema,
  aparencia: AparenciaSchema.optional(),
})
export type Jogador = z.infer<typeof JogadorSchema>

export const PORTES = ['grande', 'medio', 'pequeno'] as const
export type Porte = (typeof PORTES)[number]

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor #RRGGBB')

/** Kit e bandeira: formato livre herdado de `data/times` (lido pelas ferramentas de kit). */
const Livre = z.record(z.string(), z.unknown())

export const TimeSchema = z.object({
  sigla: z.string().regex(/^[A-Z0-9]{2,5}$/, '2 a 5 letras maiúsculas ou números'),
  nome: z.string().min(1),
  nome_curto: z.string(),
  pais: CodigoPais,
  estado: z.string().regex(/^[A-Z]{2}$/).optional(),
  cores: z.array(Hex).min(1).max(3),
  porte: z.enum(PORTES),
  estadio: z
    .object({
      nome: z.string().min(1),
      capacidade: z.number().int().min(0),
      ingresso_padrao: Centavos,
      custo_por_jogo: Centavos,
    })
    .optional(),
  financas: z
    .object({
      saldo_inicial: z.number().int(),
      patrocinio_temporada: Centavos,
      orcamento_folha_mensal: Centavos,
    })
    .optional(),
  formacao: z.string().min(1),
  kit: Livre.optional(),
  kit_reserva: Livre.optional(),
  kit_goleiro: Livre.optional(),
  bandeira: Livre.optional(),
  jogadores: z.array(JogadorSchema),
})
export type Time = z.infer<typeof TimeSchema>

export const ManifestoSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  nome: z.string().min(1),
  versao: z.string().min(1),
  temporada_inicial: z.number().int().min(2000).max(2200),
  tipo: z.enum(['real', 'ficticio']),
  autor: z.string().optional(),
})
export type Manifesto = z.infer<typeof ManifestoSchema>

export const PaisSchema = z.object({
  codigo: CodigoPais,
  nome: z.string().min(1),
  /** Multiplicador do valor de mercado de jogadores de clubes desse país (06-mercado). */
  fator_valor: z.number().positive(),
})
export const PaisesSchema = z.array(PaisSchema)
export type Pais = z.infer<typeof PaisSchema>

// ---------------------------------------------------------------- competições (03)

const CRITERIOS_DESEMPATE = [
  'pontos',
  'vitorias',
  'saldo',
  'gols_pro',
  'confronto_direto',
  'menos_vermelhos',
  'menos_amarelos',
  'sorteio',
] as const
export const CriterioDesempateSchema = z.enum(CRITERIOS_DESEMPATE)

const ZonaSchema = z.object({
  de: z.number().int().min(1),
  ate: z.number().int().min(1),
  nome: z.string().min(1),
  cor: z.enum(['positivo', 'atencao', 'negativo', 'info', 'diretoria']),
})

const FaseBase = {
  id: z.string().min(1),
  nome: z.string().min(1),
  entram: z.array(z.string()).optional(),
  classificam_para: z.string().optional(),
  desempate: z.array(CriterioDesempateSchema).optional(),
  zonas: z.array(ZonaSchema).optional(),
}

export const FaseSchema = z.discriminatedUnion('formato', [
  z.object({
    ...FaseBase,
    formato: z.literal('pontos_corridos'),
    /** classificam: quantos avançam para a próxima fase (obrigatório se houver classificam_para). */
    pontos_corridos: z.object({ turnos: z.number().int().min(1).max(4), classificam: z.number().int().min(1).optional() }),
  }),
  z.object({
    ...FaseBase,
    formato: z.literal('grupos'),
    grupos: z.object({
      quantidade: z.number().int().min(1),
      tamanho: z.number().int().min(2),
      turnos: z.number().int().min(1).max(4),
      sorteio: z.enum(['potes', 'livre']),
      classificam: z.number().int().min(1),
    }),
  }),
  z.object({
    ...FaseBase,
    formato: z.literal('mata_mata'),
    mata_mata: z.object({
      jogos: z.union([z.literal(1), z.literal(2)]),
      gol_fora: z.boolean(),
      prorrogacao: z.boolean(),
      penaltis: z.boolean(),
      mando: z.enum(['pior_campanha', 'melhor_campanha', 'sorteio']),
      /** Quantos saem da fase (padrão: metade se houver próxima fase; 1 = campeão se for a última). */
      classificam: z.number().int().min(1).optional(),
    }),
  }),
])
export type Fase = z.infer<typeof FaseSchema>

export const ParticipantesSchema = z.discriminatedUnion('regra', [
  z.object({ regra: z.literal('lista'), times: z.array(z.string()), quantidade: z.number().int().min(2).optional() }),
  z.object({ regra: z.literal('por_divisao'), divisao: z.string(), quantidade: z.number().int().min(2).optional() }),
  z.object({ regra: z.literal('classificados_de'), origens: z.array(z.string()).min(1), quantidade: z.number().int().min(2).optional() }),
])

/**
 * Saída de uma competição: quem vai para outra (acesso, rebaixamento, vaga).
 * Escolha dos times: `campeao`; `posicoes` ("1-4") na classificação final; `primeiros`/`ultimos`
 * N da classificação final (só entre quem jogou `fase`, se houver); ou `por_grupo`.
 */
export const SaidaSchema = z.object({
  posicoes: z.string().optional(),
  campeao: z.boolean().optional(),
  primeiros: z.number().int().min(1).optional(),
  ultimos: z.number().int().min(1).optional(),
  fase: z.string().optional(),
  por_grupo: z.object({ fase: z.string(), lado: z.enum(['primeiros', 'ultimos']), n: z.number().int().min(1) }).optional(),
  destino: z.string(),
  tipo: z.string().optional(),
})
export type SaidaCompeticao = z.infer<typeof SaidaSchema>

export const CompeticaoSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  nome: z.string().min(1),
  tipo: z.enum(['nacional', 'estadual', 'regional', 'continental']),
  participantes: ParticipantesSchema,
  suspensao: z
    .object({
      amarelos: z.number().int().min(1),
      jogos: z.number().int().min(1),
      vermelho_jogos: z.number().int().min(1),
      zera_na_fase: z.string().nullable(),
    })
    .optional(),
  substituicoes: z.number().int().min(0).max(5).optional(),
  premiacao: z.object({ por_fase: z.record(z.string(), Centavos) }).optional(),
  fases: z.array(FaseSchema).min(1),
  saidas: z.array(SaidaSchema).optional(),
})
export type Competicao = z.infer<typeof CompeticaoSchema>

/** Critério de quem sobe ou desce entre duas divisões (`divisoes.json`). */
export const CriterioDivisaoSchema = z.discriminatedUnion('criterio', [
  /** Os N primeiros (sobem) ou os N últimos (descem) da classificação final. */
  z.object({ criterio: z.literal('posicao') }),
  /** Entre quem jogou a fase: os N melhores (sobem) ou os N piores (descem) da classificação final. */
  z.object({ criterio: z.literal('fase'), fase: z.string().min(1) }),
  /** Em cada grupo da fase: os `por_grupo` primeiros (sobem) ou últimos (descem). */
  z.object({ criterio: z.literal('grupo'), fase: z.string().min(1), por_grupo: z.number().int().min(1) }),
])
export type CriterioDivisao = z.infer<typeof CriterioDivisaoSchema>

/**
 * Um degrau da escada. A 1ª divisão só tem `competicao`; as outras dizem quantos trocam
 * com a de cima (`troca`, igual para os dois lados), como descem os da de cima (`descem`)
 * e como sobem os desta (`sobem`). Sem critério, vale a posição.
 */
export const DivisaoSchema = z.object({
  competicao: z.string().min(1),
  troca: z.number().int().min(1).optional(),
  descem: CriterioDivisaoSchema.optional(),
  sobem: CriterioDivisaoSchema.optional(),
})
export type Divisao = z.infer<typeof DivisaoSchema>

/** `divisoes.json`: a escada de divisões, da mais alta para a mais baixa. */
export const DivisoesSchema = z.object({ divisoes: z.array(DivisaoSchema) })
export type Divisoes = z.infer<typeof DivisoesSchema>

/** `temporada.json`: janela de semanas e tipo de data de cada competição (03-competicoes). */
export const TemporadaSchema = z.object({
  blocos: z.array(
    z.object({
      competicao: z.string(),
      /** fds = fins de semana; meio = meio de semana; ambos = qualquer data. */
      datas: z.enum(['fds', 'meio', 'ambos']),
      semana_inicio: z.number().int().min(1),
      semana_fim: z.number().int().min(1),
    }),
  ),
})
export type Temporada = z.infer<typeof TemporadaSchema>

/** Janela de transferência (`regras.json`, `mercado.janelas`). */
export const JanelaTransferenciaSchema = z.object({
  semana_inicio: z.number().int().min(1),
  semana_fim: z.number().int().min(1),
  nome: z.string().max(40).optional(),
})
export type JanelaTransferencia = z.infer<typeof JanelaTransferenciaSchema>

/** `regras.json`: qualquer parte de `Regras` (core/config/padroes.ts); chaves desconhecidas são ignoradas. */
export const RegrasArquivoSchema = z.record(z.string(), z.unknown())

// ---------------------------------------------------------------- pacote carregado

/** Um arquivo que não passou no esquema (vira erro na validação). */
export interface ArquivoInvalido {
  arquivo: string
  mensagem: string
}

/** Pacote lido do disco, já passado pelos esquemas. Entrada do validador e da importação. */
export interface Pacote {
  manifesto: Manifesto | null
  regras: Record<string, unknown>
  temporada: Temporada | null
  /** Escada de divisões (`divisoes.json`); ausente = acesso e rebaixamento só pelas saídas. */
  divisoes?: Divisoes | null
  paises: Pais[]
  times: Time[]
  competicoes: Competicao[]
  /** Catálogo de eventos (`noticias.json`); ausente = catálogo padrão. */
  noticias?: EventoCatalogo[] | null
  /** Siglas com `escudos/<SIGLA>.png`. */
  escudos: string[]
  /** Arquivos de kit presentes (caminhos relativos ao pacote, com `/`). */
  arquivosKit: string[]
  invalidos: ArquivoInvalido[]
}
