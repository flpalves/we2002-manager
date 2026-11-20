import { z } from 'zod'

/** DTOs do mercado, das finanças e da diretoria (fase 6). Dinheiro em centavos. */

export const TipoNegocioSchema = z.enum(['compra', 'emprestimo', 'livre', 'renovacao', 'multa', 'exterior', 'pre_contrato'])

export const SituacaoMercadoSchema = z.object({
  movimentos: z.number().int(),
  movimentosMaximo: z.number().int(),
  janelaAberta: z.boolean(),
  janelas: z.array(z.object({ semana_inicio: z.number().int(), semana_fim: z.number().int(), nome: z.string().optional() })),
  semana: z.number().int(),
  saldo: z.number().int(),
  folha: z.number().int(),
  orcamentoFolha: z.number().int(),
  elenco: z.number().int(),
  elencoMinimo: z.number().int(),
  elencoMaximo: z.number().int(),
  demitido: z.boolean(),
  /** Renovações de contratos que acabam só até esta semana; depois, pré-contratos. */
  semanaLimiteRenovacao: z.number().int().optional(),
})
export type SituacaoMercado = z.infer<typeof SituacaoMercadoSchema>

export const JogadorMercadoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  time: z.string().nullable(),
  posicao: z.string(),
  idade: z.number().int(),
  geral: z.number().int(),
  valor: z.number().int(),
  salario: z.number().int(),
  contratoAte: z.number().int().nullable(),
  multa: z.number().int(),
  doUsuario: z.boolean(),
  /** À venda e por quê (null = não está). */
  aVenda: z.enum(['excedente', 'financeiro', 'emprestimo', 'usuario']).nullable(),
  /** Disponível do exterior: clube e país de origem (informativos) e a taxa fixa. */
  origem: z.object({ clube: z.string(), pais: z.string() }).nullable().optional(),
  taxa: z.number().int().nullable().optional(),
  /** Assinou pré-contrato com este clube (sigla): muda na virada. */
  preContrato: z.string().nullable().optional(),
})
export type JogadorMercadoDto = z.infer<typeof JogadorMercadoSchema>

export const FiltrosMercadoSchema = z.object({
  nome: z.string().max(40).optional(),
  posicao: z.string().optional(),
  geralMin: z.number().int().min(1).max(20).optional(),
  idadeMax: z.number().int().min(14).max(50).optional(),
  valorMax: z.number().int().min(0).optional(),
  /** Sem clube: livres e disponíveis do exterior. */
  somenteLivres: z.boolean().optional(),
  /** Só os disponíveis do exterior. */
  somenteExterior: z.boolean().optional(),
  /** Só quem está na lista de venda (de qualquer clube). */
  somenteAVenda: z.boolean().optional(),
  /** Só os jogadores do time do usuário (renovações). */
  somenteMeus: z.boolean().optional(),
  /** Só quem está em fim de contrato (termina nesta temporada, sem pré-contrato). */
  somenteFimDeContrato: z.boolean().optional(),
})

export const MovimentoSchema = z.object({
  quem: z.enum(['usuario', 'clube', 'jogador']),
  etapa: z.enum(['clube', 'jogador']),
  tipo: z.enum(['proposta', 'aceita', 'contraproposta', 'recusa', 'encerrada']),
  valor: z.number().int(),
})

export const NegociacaoDtoSchema = z.object({
  id: z.number().int().nullable(),
  jogador: JogadorMercadoSchema,
  tipo: TipoNegocioSchema,
  etapa: z.enum(['clube', 'jogador', 'concluida', 'encerrada']),
  /** Quanto o clube pede agora (etapa do clube). */
  pedida: z.number().int(),
  valorAcordado: z.number().int().nullable(),
  /** Última contraproposta de salário do jogador (se houver). */
  contraSalario: z.number().int().nullable(),
  historico: z.array(MovimentoSchema),
  /** Tipos possíveis para este jogador agora (janela, dono, multa). */
  tiposPossiveis: z.array(TipoNegocioSchema),
  mensagem: z.string().nullable(),
})
export type NegociacaoDto = z.infer<typeof NegociacaoDtoSchema>

export const PropostaSchema = z.object({
  jogadorId: z.string(),
  tipo: TipoNegocioSchema,
  /** Etapa do clube: valor oferecido. */
  valor: z.number().int().min(0).optional(),
  /** Etapa do jogador: salário mensal e duração do contrato. */
  salario: z.number().int().min(0).optional(),
  temporadas: z.number().int().min(1).max(5).optional(),
})

export const PropostaRecebidaSchema = z.object({
  id: z.number().int(),
  jogadorId: z.string(),
  jogador: z.string(),
  clube: z.string(),
  valor: z.number().int(),
  valorMercado: z.number().int(),
  semana: z.number().int(),
  /** Última semana para responder. */
  prazo: z.number().int(),
  /** Quanto o usuário pediu na contraproposta (null = ainda pode contrapropor). */
  contraproposta: z.number().int().nullable(),
  /** O jogador está na lista de venda. */
  aVenda: z.boolean(),
})
export type PropostaRecebida = z.infer<typeof PropostaRecebidaSchema>

export const ResultadoContrapropostaSchema = z.object({
  resposta: z.enum(['aceita', 'cobre', 'desiste']),
  valor: z.number().int().nullable(),
  mensagem: z.string(),
  propostas: z.array(PropostaRecebidaSchema),
})
export type ResultadoContraproposta = z.infer<typeof ResultadoContrapropostaSchema>

export const LancamentoDtoSchema = z.object({
  semana: z.number().int(),
  categoria: z.string(),
  valor: z.number().int(),
  descricao: z.string(),
})

export const FinancasSchema = z.object({
  saldo: z.number().int(),
  folha: z.number().int(),
  orcamentoFolha: z.number().int(),
  patrocinioTemporada: z.number().int(),
  cotaTvTemporada: z.number().int(),
  porCategoria: z.array(z.object({ categoria: z.string(), valor: z.number().int() })),
  extrato: z.array(LancamentoDtoSchema),
  estadio: z.object({
    nome: z.string(),
    capacidade: z.number().int(),
    ingresso: z.number().int(),
    precoReferencia: z.number().int(),
    custoPorJogo: z.number().int(),
    /** Público e renda estimados para um jogo de liga contra um time médio. */
    publicoEstimado: z.number().int(),
    rendaEstimada: z.number().int(),
    ultimosJogos: z.array(z.object({ adversario: z.string(), publico: z.number().int(), renda: z.number().int() })),
  }),
})
export type Financas = z.infer<typeof FinancasSchema>

export const DiretoriaSchema = z.object({
  confianca: z.number(),
  limite: z.number(),
  avaliacoesRuins: z.number().int(),
  demitido: z.boolean(),
  metas: z.array(
    z.object({
      tipo: z.enum(['posicao_liga', 'saldo_positivo', 'folha_no_orcamento']),
      descricao: z.string(),
      status: z.enum(['andamento', 'atingida', 'perdida']),
      critica: z.boolean(),
      /** Situação hoje: posição na liga, saldo ou folha (centavos). */
      atual: z.number().int().nullable(),
      /** Posição máxima ou orçamento da folha. */
      alvo: z.number().int().nullable(),
      /** A meta seria cumprida se a temporada acabasse hoje. */
      noCaminho: z.boolean(),
    }),
  ),
  clubesInteressados: z.array(z.object({ sigla: z.string(), nome: z.string(), porte: z.string() })),
})
export type Diretoria = z.infer<typeof DiretoriaSchema>
