import { ATRIBUTOS } from '@shared/esquemas/pacote'
import { CAMPOS_CONDICAO, type Condicao, type Efeito, type EventoCatalogo, type Momento } from '@shared/esquemas/noticias'

/**
 * Apoio ao editor do catálogo de notícias (09b): coerência de cada evento (o que o esquema não
 * pega, como efeito de jogador num evento de time) e a frequência esperada de cada um.
 * Puro: o renderer usa para mostrar problemas e a "periodicidade"; o validar do pacote também.
 */

export interface ProblemaNoticia {
  nivel: 'erro' | 'aviso'
  codigo: string
  mensagem: string
  /** Evento (id) do problema; ausente = catálogo inteiro. */
  evento?: string
}

/** Efeitos que precisam de um jogador como alvo. */
export const EFEITOS_DE_JOGADOR: readonly Efeito['campo'][] = [
  'moral',
  'condicao',
  'atributo',
  'atributo_aleatorio',
  'atributo_aleatorio_do_foco',
  'potencial',
  'lesao',
  'disponibilidade',
  'interesse_mercado',
]

/** Efeitos que usam `delta`. */
export const EFEITOS_COM_DELTA: readonly Efeito['campo'][] = ['moral', 'moral_elenco', 'condicao', 'atributo', 'atributo_aleatorio', 'atributo_aleatorio_do_foco', 'potencial', 'confianca']

/** Condições lidas como 0/1. */
export const CONDICOES_BOOLEANAS: readonly Condicao['campo'][] = ['jogador.titular', 'time.folha_acima', 'partida.em_casa']

export const alvoDeJogador = (alvo: EventoCatalogo['alvo']) => alvo === 'jogador_aleatorio_do_usuario' || alvo === 'jogador_condicionado'

/** Deixa só os campos que o tipo de efeito usa (o editor troca o campo e sobram valores). */
export function limparEfeito(e: Efeito): Efeito {
  const saida: Efeito = { campo: e.campo }
  if (EFEITOS_COM_DELTA.includes(e.campo)) saida.delta = e.delta ?? 0
  if (e.campo === 'atributo') saida.atributo = e.atributo ?? 'OFF'
  if (e.campo === 'saldo') saida.valor = e.valor ?? 0
  if (e.campo === 'lesao' || e.campo === 'disponibilidade') saida.semanas = e.semanas ?? 1
  if (e.chance !== undefined && e.chance < 1) saida.chance = e.chance
  return saida
}

export function limparEvento(e: EventoCatalogo): EventoCatalogo {
  return {
    ...e,
    texto: e.texto.trim(),
    efeitos: e.efeitos.map(limparEfeito),
    escolhas: e.escolhas
      ? e.escolhas.map((o) => {
          const resultado = o.resultado?.trim()
          return { id: o.id.trim(), texto: o.texto.trim(), ...(resultado ? { resultado } : {}), efeitos: o.efeitos.map(limparEfeito) }
        })
      : null,
  }
}

/** Id livre a partir de uma base (`evento-novo`, `evento-novo-2`...). */
export function idLivre(base: string, usados: Iterable<string>): string {
  const ja = new Set(usados)
  const limpa = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'evento'
  if (!ja.has(limpa)) return limpa
  for (let n = 2; ; n++) if (!ja.has(`${limpa}-${n}`)) return `${limpa}-${n}`
}

export function eventoNovo(usados: Iterable<string>): EventoCatalogo {
  return {
    id: idLivre('evento-novo', usados),
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [] },
    alvo: 'jogador_aleatorio_do_usuario',
    chance: 0.02,
    intervalo_minimo_semanas: 8,
    texto: '{jogador} ...',
    efeitos: [{ campo: 'moral', delta: 5 }],
    escolhas: null,
  }
}

function problemasDosEfeitos(efeitos: readonly Efeito[], ondeTexto: string, porJogador: boolean, add: (n: ProblemaNoticia['nivel'], c: string, m: string) => void): void {
  for (const e of efeitos) {
    if (e.campo === 'atributo' && !(ATRIBUTOS as readonly string[]).includes(e.atributo ?? '')) add('erro', 'efeito_atributo', `${ondeTexto}: efeito de atributo sem um atributo válido.`)
    if (e.campo === 'saldo' && !e.valor) add('aviso', 'efeito_zerado', `${ondeTexto}: lançamento de saldo com valor zero.`)
    if (EFEITOS_COM_DELTA.includes(e.campo) && !e.delta) add('aviso', 'efeito_zerado', `${ondeTexto}: efeito de ${e.campo} com variação zero.`)
    if (e.chance !== undefined && e.chance <= 0) add('aviso', 'efeito_sem_chance', `${ondeTexto}: efeito com chance 0 (nunca acontece).`)
    if (!porJogador && EFEITOS_DE_JOGADOR.includes(e.campo)) add('aviso', 'efeito_sem_jogador', `${ondeTexto}: o efeito ${e.campo} precisa de um jogador, mas o alvo é um time (será ignorado).`)
  }
}

/** Problemas de um evento (sem os de catálogo, como id repetido). */
export function validarEvento(e: EventoCatalogo): ProblemaNoticia[] {
  const p: ProblemaNoticia[] = []
  const add = (nivel: ProblemaNoticia['nivel'], codigo: string, mensagem: string) => p.push({ nivel, codigo, mensagem, evento: e.id })
  const porJogador = alvoDeJogador(e.alvo)

  if (!/^[a-z0-9-]+$/.test(e.id)) add('erro', 'id_invalido', 'Id só aceita letras minúsculas, números e hífen.')
  if (!e.texto.trim()) add('erro', 'texto_vazio', 'Texto da notícia vazio.')
  if (!(e.chance >= 0 && e.chance <= 1)) add('erro', 'chance_invalida', 'Chance precisa ficar entre 0% e 100%.')
  else if (e.chance === 0) add('aviso', 'sem_chance', 'Chance 0%: o evento nunca acontece.')
  if (!Number.isInteger(e.intervalo_minimo_semanas) || e.intervalo_minimo_semanas < 0) add('erro', 'intervalo_invalido', 'Intervalo mínimo precisa ser um número inteiro de semanas (0 ou mais).')

  // Condições
  for (const c of e.gatilho.condicoes) {
    if (!(CAMPOS_CONDICAO as readonly string[]).includes(c.campo)) add('erro', 'condicao_campo', `Condição com campo desconhecido: ${c.campo}.`)
    if (c.campo.startsWith('partida.') && e.gatilho.momento !== 'pos_jogo') add('erro', 'condicao_partida', `A condição ${c.campo} só existe no pós-jogo: com este momento o evento nunca acontece.`)
    if (c.campo.startsWith('jogador.') && !porJogador) add('erro', 'condicao_jogador', `A condição ${c.campo} pede alvo de jogador: com alvo de time o evento nunca acontece.`)
    if (c.campo === 'partida.resultado') {
      if (!['V', 'E', 'D'].includes(String(c.valor))) add('erro', 'condicao_valor', 'Resultado da partida precisa ser V, E ou D.')
      if (c.op !== '==' && c.op !== '!=') add('erro', 'condicao_operador', 'Resultado da partida só aceita "é" ou "não é".')
    } else if (typeof c.valor !== 'number' || Number.isNaN(c.valor)) add('erro', 'condicao_valor', `A condição ${c.campo} precisa de um número.`)
  }
  if (e.alvo === 'jogador_condicionado' && !e.gatilho.condicoes.some((c) => c.campo.startsWith('jogador.'))) {
    add('aviso', 'condicionado_sem_condicao', 'Alvo "jogador que atende às condições" sem condição de jogador: vale qualquer jogador.')
  }

  // Efeitos e escolhas
  problemasDosEfeitos(e.efeitos, 'Consequências', porJogador, add)
  if (e.escolhas) {
    if (e.escolhas.length < 2) add('erro', 'escolhas_poucas', 'Uma decisão precisa de pelo menos 2 opções.')
    const ids = new Set<string>()
    e.escolhas.forEach((o, i) => {
      const nome = `Opção ${i + 1}`
      if (!/^[a-z0-9_-]+$/.test(o.id)) add('erro', 'escolha_id', `${nome}: id só aceita letras minúsculas, números, hífen e sublinhado.`)
      else if (ids.has(o.id)) add('erro', 'escolha_repetida', `${nome}: id "${o.id}" repetido.`)
      ids.add(o.id)
      if (!o.texto.trim()) add('erro', 'escolha_texto', `${nome}: texto do botão vazio.`)
      problemasDosEfeitos(o.efeitos, nome, porJogador, add)
    })
  }
  if (!e.efeitos.length && !e.escolhas?.some((o) => o.efeitos.length)) add('aviso', 'sem_efeito', 'Evento sem consequência: só aparece como notícia.')

  // Marcadores do texto
  const textos = [e.texto, ...(e.escolhas?.flatMap((o) => [o.texto, o.resultado ?? '']) ?? [])].join(' ')
  if (textos.includes('{jogador}') && !porJogador) add('aviso', 'marcador_jogador', 'O texto usa {jogador}, mas o alvo é um time (vai sair vazio).')
  const efeitosTodos = [...e.efeitos, ...(e.escolhas?.flatMap((o) => o.efeitos) ?? [])]
  if (textos.includes('{valor}') && !efeitosTodos.some((x) => x.campo === 'saldo')) add('aviso', 'marcador_valor', 'O texto usa {valor}, mas não há efeito de saldo.')
  if (textos.includes('{clube}') && e.alvo !== 'time_qualquer' && !efeitosTodos.some((x) => x.campo === 'interesse_mercado')) {
    add('aviso', 'marcador_clube', 'O texto usa {clube}, mas não há outro clube (alvo "outro clube" ou efeito de interesse do mercado).')
  }
  const desconhecidos = [...textos.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]).filter((m) => !['jogador', 'time', 'clube', 'valor'].includes(m ?? ''))
  if (desconhecidos.length) add('aviso', 'marcador_desconhecido', `Marcador desconhecido no texto: {${desconhecidos[0]}}.`)
  return p
}

/** Problemas do catálogo inteiro: os de cada evento e os ids repetidos. */
export function validarCatalogo(catalogo: readonly EventoCatalogo[]): ProblemaNoticia[] {
  const p: ProblemaNoticia[] = []
  const vistos = new Set<string>()
  for (const e of catalogo) {
    if (vistos.has(e.id)) p.push({ nivel: 'erro', codigo: 'id_repetido', mensagem: `Id "${e.id}" usado por mais de um evento.`, evento: e.id })
    vistos.add(e.id)
    p.push(...validarEvento(e))
  }
  if (!catalogo.length) p.push({ nivel: 'aviso', codigo: 'catalogo_vazio', mensagem: 'Catálogo vazio: nenhum evento aleatório nas carreiras deste pacote.' })
  return p
}

// ------------------------------------------------------------------ periodicidade

export interface BaseFrequencia {
  /** `regras.noticias.fator_chance`. */
  fatorChance: number
  semanasPorTemporada: number
  /** Janelas de transferência por temporada (momentos de janela). */
  janelas: number
  /** Jogos do usuário por temporada (pós-jogo); estimativa. */
  jogosPorTemporada: number
}

export interface Frequencia {
  /** Chance efetiva por avaliação (0-1). */
  porAvaliacao: number
  /** Avaliações do momento por temporada. */
  avaliacoes: number
  /** Ocorrências esperadas por temporada (se as condições valessem sempre). */
  porTemporada: number
  /** Semanas médias entre duas ocorrências (null = nunca acontece). */
  semanasEntre: number | null
}

/** Quantas avaliações o momento tem por temporada. */
export function avaliacoesPorTemporada(momento: Momento, base: BaseFrequencia): number {
  switch (momento) {
    case 'semana':
      return base.semanasPorTemporada
    case 'pos_jogo':
      return base.jogosPorTemporada
    case 'janela_abre':
    case 'janela_fecha':
      return base.janelas
    case 'virada':
      return 1
  }
}

/**
 * Frequência esperada de um evento supondo que as condições valham sempre (teto) e que nenhum
 * outro evento ocupe a vaga da avaliação. Depois de acontecer, o evento fica bloqueado por
 * `intervalo_minimo_semanas`; em média o intervalo entre duas ocorrências é o bloqueio mais a
 * espera geométrica 1/p (em avaliações, convertidas para semanas).
 */
export function frequenciaEsperada(e: Pick<EventoCatalogo, 'chance' | 'intervalo_minimo_semanas' | 'gatilho'>, base: BaseFrequencia): Frequencia {
  const p = Math.min(1, Math.max(0, e.chance * base.fatorChance))
  const avaliacoes = avaliacoesPorTemporada(e.gatilho.momento, base)
  if (p === 0 || avaliacoes === 0) return { porAvaliacao: p, avaliacoes, porTemporada: 0, semanasEntre: null }
  const semanasPorAvaliacao = base.semanasPorTemporada / avaliacoes
  const bloqueio = Math.max(1, e.intervalo_minimo_semanas)
  // Avaliações bloqueadas depois de uma ocorrência (a própria semana conta).
  const bloqueadas = Math.max(0, Math.ceil(bloqueio / semanasPorAvaliacao) - 1)
  const avaliacoesEntre = bloqueadas + 1 / p
  const semanasEntre = avaliacoesEntre * semanasPorAvaliacao
  return { porAvaliacao: p, avaliacoes, porTemporada: avaliacoes / avaliacoesEntre, semanasEntre }
}
