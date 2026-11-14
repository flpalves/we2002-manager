import { z } from 'zod'
import { ConfigAppParcialSchema, ConfigAppSchema } from './config'
import { AparenciaSchema, CompeticaoSchema, DivisoesSchema, JanelaTransferenciaSchema, ManifestoSchema, PaisSchema, TemporadaSchema, TimeSchema } from './pacote'
import { ElencoSchema, EscalacaoSalvaSchema, EscalacaoSchema, FichaJogadorSchema, FocoSchema, TreinoSchema } from './elenco'
import { DiretoriaSchema, FiltrosMercadoSchema, FinancasSchema, JogadorMercadoSchema, NegociacaoDtoSchema, PropostaRecebidaSchema, PropostaSchema, ResultadoContrapropostaSchema, SituacaoMercadoSchema, TipoNegocioSchema } from './mercado'
import { CaixaNoticiasSchema, CatalogoSchema, EventoCatalogoSchema, TipoNoticiaSchema } from './noticias'
import { DetalheTimeSchema, FiltroTransferenciasSchema, ListaTransferenciasSchema } from './time'
import { PlacarManualSchema, PreJogoSchema, StatusWeSchema } from './we'
import { AutosaveSchema, EntradaCarreiraNovaSchema, ResumoCarreiraSchema } from './carreira'
import { ArtilheiroSchema, CalendarioSchema, EdicaoDetalheSchema, EdicaoResumoSchema, PreviaViradaSchema, RelatorioTemporadaSchema, ResultadoContinuarSchema, SumulaSchema, TimeResumoSchema } from './temporada'

const IdPacote = z.string().regex(/^[a-z0-9-]+$/)

export const ProblemaSchema = z.object({
  nivel: z.enum(['erro', 'aviso']),
  codigo: z.string(),
  mensagem: z.string(),
  arquivo: z.string().optional(),
  time: z.string().optional(),
  jogador: z.string().optional(),
  competicao: z.string().optional(),
})

/** Pacote aberto no editor: conteúdo + resultado da validação. */
export const PacoteAbertoSchema = z.object({
  id: z.string(),
  manifesto: ManifestoSchema.nullable(),
  paises: z.array(PaisSchema),
  times: z.array(TimeSchema),
  competicoes: z.array(CompeticaoSchema),
  /** Escada de acesso e rebaixamento (`divisoes.json`); null = sem escada. */
  divisoes: DivisoesSchema.nullable(),
  /** Janelas de transferência em vigor (as do regras.json ou as padrão) e o que a aba precisa para desenhar a temporada. */
  janelas: z.object({
    lista: z.array(JanelaTransferenciaSchema),
    /** true = vêm do regras.json do pacote; false = padrão do jogo. */
    doPacote: z.boolean(),
    semanas: z.number().int(),
    blocos: z.array(z.object({ competicao: z.string(), semana_inicio: z.number().int(), semana_fim: z.number().int() })),
  }),
  /** `temporada.json` (null = arquivo ausente) e a duração da temporada em vigor. */
  temporada: z.object({
    arquivo: TemporadaSchema.nullable(),
    semanas: z.number().int(),
    /** true = a duração vem do regras.json do pacote; false = padrão do jogo. */
    semanasDoPacote: z.boolean(),
    semanasPadrao: z.number().int(),
  }),
  /** Catálogo de eventos em vigor (o `noticias.json` ou o padrão do jogo) e as regras gerais dos eventos. */
  noticias: z.object({
    catalogo: z.array(EventoCatalogoSchema),
    /** true = vem do `noticias.json` do pacote; false = catálogo padrão do jogo. */
    doPacote: z.boolean(),
    /** O `noticias.json` existe mas não passou na validação (o editor mostra o padrão). */
    arquivoInvalido: z.boolean(),
    regras: z.object({ fator_chance: z.number(), maximo_por_avaliacao: z.number().int() }),
    regrasPadrao: z.object({ fator_chance: z.number(), maximo_por_avaliacao: z.number().int() }),
    /** Janelas e semanas da temporada, para estimar a frequência dos eventos. */
    semanas: z.number().int(),
    janelas: z.number().int(),
  }),
  escudos: z.array(z.string()),
  problemas: z.array(ProblemaSchema),
  /** Muda a cada leitura: entra na URL dos escudos para furar o cache. */
  versao: z.number(),
})
export type PacoteAberto = z.infer<typeof PacoteAbertoSchema>

/**
 * Contrato do IPC: um canal por caso de uso, validado com Zod nas duas pontas
 * (preload valida a entrada antes de enviar e a saída ao receber; main valida a entrada
 * ao receber e a saída antes de responder).
 */
export const contratos = {
  'app:info': {
    entrada: z.undefined(),
    saida: z.object({
      versao: z.string(),
      pastaCarreiras: z.string(),
      /** A pasta das carreiras está dentro do OneDrive (risco de corromper o SQLite). */
      carreirasNoOneDrive: z.boolean(),
    }),
  },
  'config:obter': {
    entrada: z.undefined(),
    saida: ConfigAppSchema,
  },
  'config:salvar': {
    entrada: ConfigAppParcialSchema,
    saida: ConfigAppSchema,
  },

  // ------------------------------------------------------------ pacote / editor
  'pacote:listar': {
    entrada: z.undefined(),
    saida: z.array(z.object({ id: z.string(), nome: z.string(), versao: z.string(), temporada: z.number().int().nullable() })),
  },
  'pacote:abrir': { entrada: z.object({ pacote: IdPacote }), saida: PacoteAbertoSchema },
  'pacote:salvarTime': {
    entrada: z.object({ pacote: IdPacote, time: TimeSchema, siglaAnterior: z.string().optional() }),
    saida: PacoteAbertoSchema,
  },
  'pacote:removerTime': { entrada: z.object({ pacote: IdPacote, sigla: z.string() }), saida: PacoteAbertoSchema },
  'pacote:salvarCompeticao': {
    entrada: z.object({ pacote: IdPacote, competicao: CompeticaoSchema, idAnterior: z.string().optional() }),
    saida: PacoteAbertoSchema,
  },
  'pacote:removerCompeticao': { entrada: z.object({ pacote: IdPacote, id: z.string() }), saida: PacoteAbertoSchema },
  /** Grava as janelas de transferência no regras.json; null volta ao padrão do jogo. */
  'pacote:salvarJanelas': { entrada: z.object({ pacote: IdPacote, janelas: z.array(JanelaTransferenciaSchema).nullable() }), saida: PacoteAbertoSchema },
  /** Grava o `temporada.json` e a duração da temporada (`regras.json`; null = padrão do jogo). */
  'pacote:salvarTemporada': {
    entrada: z.object({ pacote: IdPacote, temporada: TemporadaSchema, semanas: z.number().int().min(1).max(200).nullable() }),
    saida: PacoteAbertoSchema,
  },
  /** Grava o `divisoes.json` (escada vazia apaga o arquivo). */
  'pacote:salvarDivisoes': { entrada: z.object({ pacote: IdPacote, divisoes: DivisoesSchema }), saida: PacoteAbertoSchema },
  /**
   * Grava o catálogo de eventos (`noticias.json`; null apaga e volta ao catálogo padrão) e as
   * regras gerais dos eventos no `regras.json` (null em cada uma = padrão do jogo).
   */
  'pacote:salvarNoticias': {
    entrada: z.object({
      pacote: IdPacote,
      catalogo: CatalogoSchema.nullable(),
      regras: z.object({ fator_chance: z.number().min(0).max(10).nullable(), maximo_por_avaliacao: z.number().int().min(1).max(10).nullable() }),
    }),
    saida: PacoteAbertoSchema,
  },
  /** Abre o seletor de arquivo e copia o PNG para escudos/<SIGLA>.png; `null` se cancelado. */
  'pacote:importarEscudo': { entrada: z.object({ pacote: IdPacote, sigla: z.string() }), saida: PacoteAbertoSchema.nullable() },
  /** Kit original do WE usado como base dos uniformes desenhados (PNG 128x256 RGBA e página 8 bits, em base64); null se faltar. */
  'kit:base': { entrada: z.undefined(), saida: z.object({ rgba: z.string(), pagina: z.string() }).nullable() },
  /** Desenha a arte 4x do uniforme e grava no pacote (kits/desenhos) e no times/<SIGLA>.json. */
  'pacote:gerarKit': {
    entrada: z.object({
      pacote: IdPacote,
      sigla: z.string(),
      campo: z.enum(['kit', 'kit_reserva', 'kit_goleiro']),
      design: z.record(z.string(), z.unknown()),
      cor_numero: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    }),
    saida: PacoteAbertoSchema,
  },

  // ------------------------------------------------------------ carreiras
  'carreira:listar': { entrada: z.undefined(), saida: z.array(ResumoCarreiraSchema) },
  'carreira:criar': { entrada: EntradaCarreiraNovaSchema, saida: ResumoCarreiraSchema },
  'carreira:abrir': { entrada: z.object({ id: z.string() }), saida: ResumoCarreiraSchema },
  'carreira:atual': { entrada: z.undefined(), saida: ResumoCarreiraSchema.nullable() },
  'carreira:fechar': { entrada: z.undefined(), saida: z.null() },
  'carreira:apagar': { entrada: z.object({ id: z.string() }), saida: z.null() },
  'carreira:autosaves': { entrada: z.object({ id: z.string() }), saida: z.array(AutosaveSchema) },
  'carreira:restaurar': { entrada: z.object({ id: z.string(), numero: z.number().int().min(1) }), saida: ResumoCarreiraSchema },
  'carreira:continuar': { entrada: z.undefined(), saida: ResultadoContinuarSchema },
  'carreira:times': { entrada: z.undefined(), saida: z.array(TimeResumoSchema) },

  // ------------------------------------------------------------ temporada
  'temporada:calendario': { entrada: z.undefined(), saida: CalendarioSchema },
  'temporada:edicoes': { entrada: z.undefined(), saida: z.array(EdicaoResumoSchema) },
  'temporada:edicao': { entrada: z.object({ id: z.string() }), saida: EdicaoDetalheSchema },
  'temporada:artilharia': { entrada: z.object({ edicao: z.string() }), saida: z.array(ArtilheiroSchema) },
  'virada:previa': { entrada: z.undefined(), saida: PreviaViradaSchema },
  'virada:executar': { entrada: z.undefined(), saida: RelatorioTemporadaSchema },
  'virada:relatorio': { entrada: z.object({ temporada: z.number().int() }), saida: RelatorioTemporadaSchema.nullable() },
  'partida:sumula': { entrada: z.object({ id: z.string() }), saida: SumulaSchema },

  // ------------------------------------------------------------ elenco e treino
  'elenco:listar': { entrada: z.undefined(), saida: ElencoSchema },
  'elenco:ficha': { entrada: z.object({ id: z.string() }), saida: FichaJogadorSchema },
  'elenco:salvarAparencia': { entrada: z.object({ id: z.string(), aparencia: AparenciaSchema.nullable() }), saida: FichaJogadorSchema },
  'treino:obter': { entrada: z.undefined(), saida: TreinoSchema },
  'treino:definir': { entrada: z.object({ foco: FocoSchema }), saida: TreinoSchema },
  'escalacao:obter': { entrada: z.undefined(), saida: EscalacaoSchema },
  'escalacao:salvar': { entrada: EscalacaoSalvaSchema, saida: EscalacaoSchema },
  'escalacao:sugerir': { entrada: z.object({ formacao: z.string().optional() }), saida: EscalacaoSchema },
  'escalacao:automatica': { entrada: z.undefined(), saida: EscalacaoSchema },

  // ------------------------------------------------------------ outros clubes e transferências
  'time:detalhe': { entrada: z.object({ sigla: z.string() }), saida: DetalheTimeSchema },
  'time:transferencias': { entrada: FiltroTransferenciasSchema, saida: ListaTransferenciasSchema },

  // ------------------------------------------------------------ jogo do usuário (pré-jogo, WE, pós-jogo)
  'prejogo:obter': { entrada: z.undefined(), saida: PreJogoSchema },
  'prejogo:simular': { entrada: z.undefined(), saida: ResultadoContinuarSchema },
  'we:iniciar': { entrada: z.object({ modo: z.enum(['jogar', 'assistir']) }), saida: StatusWeSchema },
  'we:status': { entrada: z.undefined(), saida: StatusWeSchema },
  'we:jogarDeNovo': { entrada: z.undefined(), saida: StatusWeSchema },
  'we:confirmar': { entrada: z.object({ aceitarParcial: z.boolean().optional() }).optional(), saida: ResultadoContinuarSchema },
  'we:descartar': { entrada: z.undefined(), saida: z.null() },
  'we:manual': { entrada: PlacarManualSchema, saida: ResultadoContinuarSchema },

  // ------------------------------------------------------------ mercado, finanças, diretoria
  'mercado:situacao': { entrada: z.undefined(), saida: SituacaoMercadoSchema },
  'mercado:intensidade': { entrada: z.object({ valor: z.enum(['baixa', 'media', 'alta']).optional() }), saida: z.enum(['baixa', 'media', 'alta']) },
  'mercado:buscar': { entrada: FiltrosMercadoSchema, saida: z.array(JogadorMercadoSchema) },
  'mercado:negociacao': { entrada: z.object({ jogadorId: z.string(), tipo: TipoNegocioSchema.optional() }), saida: NegociacaoDtoSchema },
  'mercado:propor': { entrada: PropostaSchema, saida: NegociacaoDtoSchema },
  'mercado:propostas': { entrada: z.undefined(), saida: z.array(PropostaRecebidaSchema) },
  'mercado:responder': { entrada: z.object({ id: z.number().int(), aceitar: z.boolean() }), saida: z.array(PropostaRecebidaSchema) },
  'mercado:contrapropor': { entrada: z.object({ id: z.number().int(), valor: z.number().int().min(0) }), saida: ResultadoContrapropostaSchema },
  'mercado:aVenda': { entrada: z.object({ jogadorId: z.string(), aVenda: z.boolean() }), saida: JogadorMercadoSchema },
  'financas:obter': { entrada: z.undefined(), saida: FinancasSchema },
  'financas:ingresso': { entrada: z.object({ preco: z.number().int().min(0) }), saida: FinancasSchema },
  'diretoria:obter': { entrada: z.undefined(), saida: DiretoriaSchema },
  'diretoria:assumir': { entrada: z.object({ sigla: z.string() }), saida: DiretoriaSchema },

  // ------------------------------------------------------------ notícias
  'noticias:caixa': { entrada: z.object({ tipo: TipoNoticiaSchema.optional() }), saida: CaixaNoticiasSchema },
  'noticias:lidas': { entrada: z.object({ ids: z.array(z.number().int()).nullable() }), saida: z.null() },
  'noticias:responder': { entrada: z.object({ id: z.number().int(), escolha: z.string() }), saida: CaixaNoticiasSchema },
} as const

export type Contratos = typeof contratos
export type Canal = keyof Contratos
export type Entrada<C extends Canal> = z.input<Contratos[C]['entrada']>
export type Saida<C extends Canal> = z.output<Contratos[C]['saida']>

export interface ErroIpc {
  codigo: string
  mensagem: string
}

export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: ErroIpc }

export const canais = Object.keys(contratos) as Canal[]

export function ok<T>(dados: T): Resposta<T> {
  return { ok: true, dados }
}

export function falha(codigo: string, mensagem: string): Resposta<never> {
  return { ok: false, erro: { codigo, mensagem } }
}

/** Mensagem curta a partir dos problemas do Zod. */
export function descreverErroZod(erro: z.ZodError): string {
  return erro.issues
    .slice(0, 3)
    .map((i) => `${i.path.length ? i.path.join('.') : '(raiz)'}: ${i.message}`)
    .join('; ')
}

/** API exposta pelo preload em `window.api`. */
export interface Api {
  invocar<C extends Canal>(canal: C, entrada: Entrada<C>): Promise<Resposta<Saida<C>>>
}
