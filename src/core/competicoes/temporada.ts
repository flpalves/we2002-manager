import type { Regras } from '../config/padroes'
import type { Rng } from '../rng'
import type { Competicao, Fase } from '@shared/esquemas/pacote'
import { montarCalendario, type Bloco } from './calendario'
import { avancarEdicao, comecarFase, iniciarEdicao, ordenarPorRanking, regraMataMata, reservarEdicao, type EstadoEdicao, type EventoCompeticao, type UnidadeRodada } from './fases'
import { ehPorVagas, origensDasVagas, participantesPorVagas, possiveisPorVagas, tamanhoDaCompeticao } from './vagas'
import { decidirConfronto, type RegraMataMata } from './mataMata'
import type { Partida, Passo, Resultado, Sigla } from './tipos'

/**
 * Estado de uma temporada: calendário, edições, partidas e rodadas reservadas.
 * As funções daqui alteram o estado recebido (o main grava as mudanças devolvidas).
 */
export interface EstadoTemporada {
  temporada: number
  passos: Passo[]
  /** Próximo passo a jogar (= passos.length quando a temporada acabou). */
  passoAtual: number
  edicoes: EstadoEdicao[]
  partidas: Partida[]
  reservadas: (UnidadeRodada & { passo: number })[]
}

export interface ContextoPartida {
  /** Id da competição (suspensões e prioridade da IA). */
  competicao: string
  /** Substituições permitidas (regra da competição ou padrão). */
  substituicoes: number
  /** Final (jogo decisivo da última fase de mata-mata): moral em dobro. Clássicos ainda não são marcados. */
  jogoGrande: boolean
  /** Mata-mata: regra e jogos anteriores do confronto (o simulador decide prorrogação/pênaltis). */
  mataMata: { regra: RegraMataMata; anteriores: Partida[] } | null
}

/** Quem dá o resultado de cada partida (simulador provisório, motor da fase 3, ou o WE). */
export type Simulador = (p: Partida, ctx: ContextoPartida) => Resultado

export interface EntradaTemporada {
  temporada: number
  competicoes: readonly Competicao[]
  /** Participantes de cada competição (id → siglas). */
  participantes: Readonly<Record<string, readonly Sigla[]>>
  blocos: readonly Bloco[]
  regras: Regras
  rng: Rng
  ranking?: readonly Sigla[]
  paisDe?: (t: Sigla) => string
}

export function idPartida(u: Pick<UnidadeRodada, 'edicao' | 'fase' | 'rodada' | 'jogo'>, k: number): string {
  return `${u.edicao}/${u.fase}/${u.rodada}/${u.jogo}/${k}`
}

function partidasDaUnidade(u: UnidadeRodada, passo: number): Partida[] {
  return (u.confrontos ?? []).map((c, k) => ({
    id: idPartida(u, k),
    edicao: u.edicao,
    fase: u.fase,
    grupo: c.grupo,
    rodada: u.rodada,
    confronto: c.confronto,
    jogo: u.jogo,
    casa: c.casa,
    visitante: c.visitante,
    passo,
    resultado: null,
  }))
}

const opcoesDe = (e: EntradaTemporada | { temporada: number; regras: Regras; ranking?: readonly Sigla[]; paisDe?: (t: Sigla) => string }) => ({
  temporada: e.temporada,
  pontos: e.regras.competicao.pontos,
  ...(e.ranking && { ranking: e.ranking }),
  ...(e.paisDe && { paisDe: e.paisDe }),
})

export function gerarTemporada(e: EntradaTemporada): EstadoTemporada {
  const edicoes: EstadoEdicao[] = []
  const planos: { competicao: string; unidades: UnidadeRodada[] }[] = []
  for (const c of e.competicoes) {
    let participantes = e.participantes[c.id]
    if (ehPorVagas(c)) {
      // Por vagas: reserva as rodadas; os participantes saem das origens desta temporada.
      const n = tamanhoDaCompeticao(c) ?? 0
      const garantidos = (participantes ?? []).slice(0, n)
      const deOrigens = possiveisPorVagas(c, e.competicoes, (id) => e.participantes[id] ?? [])
      if (deOrigens.length && n >= 2) {
        const possiveis = [...new Set([...garantidos, ...deOrigens])]
        const r = reservarEdicao(c, n, garantidos, possiveis, opcoesDe(e))
        edicoes.push(r.edicao)
        planos.push({ competicao: c.id, unidades: r.unidades })
        continue
      }
      // Nenhuma origem disputada: só os garantidos, e só se fecharem a quantidade.
      participantes = garantidos.length === n ? garantidos : undefined
    }
    if (!participantes || participantes.length < 2) continue
    const { edicao, unidades } = iniciarEdicao(c, participantes, opcoesDe(e), e.rng.derivar('edicao', c.id, e.temporada))
    edicoes.push(edicao)
    planos.push({ competicao: c.id, unidades })
  }
  const { passos, passoDasUnidades } = montarCalendario(planos, e.blocos, e.regras)
  const partidas: Partida[] = []
  const reservadas: EstadoTemporada['reservadas'] = []
  planos.forEach((p, i) =>
    p.unidades.forEach((u, k) => {
      const passo = passoDasUnidades[i]![k]!
      if (u.confrontos) partidas.push(...partidasDaUnidade(u, passo))
      else reservadas.push({ ...u, passo })
    }),
  )
  return { temporada: e.temporada, passos, passoAtual: 0, edicoes, partidas, reservadas }
}

export interface ResultadoPasso {
  passo: Passo
  jogadas: Partida[]
  criadas: Partida[]
  eventos: EventoCompeticao[]
}

export interface ContextoTemporada {
  competicoes: ReadonlyMap<string, Competicao>
  regras: Regras
  rng: Rng
  ranking?: readonly Sigla[]
  paisDe?: (t: Sigla) => string
}

function faseDe(c: Competicao, id: string): Fase {
  const f = c.fases.find((x) => x.id === id)
  if (!f) throw new Error(`${c.id}: fase ${id} não existe`)
  return f
}

/** Contexto que o simulador precisa para uma partida (mata-mata ou não). */
export function contextoDaPartida(estado: EstadoTemporada, p: Partida, ctx: ContextoTemporada): ContextoPartida {
  const edicao = estado.edicoes.find((e) => e.id === p.edicao)!
  const c = ctx.competicoes.get(edicao.competicao)!
  const base = { competicao: c.id, substituicoes: c.substituicoes ?? ctx.regras.competicao.substituicoes, jogoGrande: false }
  if (!p.confronto) return { ...base, mataMata: null }
  const fase = faseDe(c, p.fase)
  if (fase.formato !== 'mata_mata') return { ...base, mataMata: null }
  const ultimaFase = c.fases[c.fases.length - 1]?.id === fase.id
  const naEtapa = estado.partidas.filter((x) => x.edicao === p.edicao && x.fase === p.fase && x.rodada === p.rodada && x.jogo === p.jogo).length
  base.jogoGrande = ultimaFase && naEtapa === 1 && !estado.reservadas.some((r) => r.edicao === p.edicao && r.fase === p.fase && r.rodada > p.rodada)
  const anteriores = estado.partidas.filter((x) => x.edicao === p.edicao && x.confronto === p.confronto && x.fase === p.fase && x.jogo < p.jogo)
  return { ...base, mataMata: { regra: regraMataMata(fase), anteriores } }
}

/** Joga todas as partidas do passo atual e avança as competições. */
export function jogarPasso(estado: EstadoTemporada, simular: Simulador, ctx: ContextoTemporada): ResultadoPasso {
  const passo = estado.passos[estado.passoAtual]
  if (!passo) throw new Error('A temporada já acabou')
  const jogadas: Partida[] = []
  for (const p of estado.partidas) {
    if (p.passo !== passo.indice || p.resultado) continue
    const c = contextoDaPartida(estado, p, ctx)
    p.resultado = simular(p, c)
    if (c.mataMata && p.jogo === c.mataMata.regra.jogos) decidirConfronto([...c.mataMata.anteriores, p], c.mataMata.regra)
    jogadas.push(p)
  }
  return { passo, jogadas, ...concluirPasso(estado, ctx) }
}

/**
 * Depois que todas as partidas do passo têm resultado (simuladas ou vindas do WE):
 * avança as competições e o calendário.
 */
export function concluirPasso(estado: EstadoTemporada, ctx: ContextoTemporada): { criadas: Partida[]; eventos: EventoCompeticao[] } {
  const passo = estado.passos[estado.passoAtual]!
  const pendente = estado.partidas.find((p) => p.passo === passo.indice && !p.resultado)
  if (pendente) throw new Error(`Partida ${pendente.id} do passo ${passo.indice} sem resultado`)
  const criadas: Partida[] = []
  const eventos: EventoCompeticao[] = []
  for (const edicao of estado.edicoes) {
    const c = ctx.competicoes.get(edicao.competicao)!
    const reservadas = estado.reservadas.filter((u) => u.edicao === edicao.id)
    const r = avancarEdicao(edicao, {
      competicao: c,
      partidas: estado.partidas,
      reservadas,
      op: opcoesDe({ temporada: estado.temporada, regras: ctx.regras, ...(ctx.ranking && { ranking: ctx.ranking }), ...(ctx.paisDe && { paisDe: ctx.paisDe }) }),
      rng: ctx.rng.derivar('fases', edicao.id, passo.indice),
    })
    for (const u of r.preenchidas) {
      const reserva = estado.reservadas.find((x) => x.edicao === u.edicao && x.fase === u.fase && x.rodada === u.rodada && x.jogo === u.jogo)!
      if (reserva.passo <= passo.indice) throw new Error(`${u.edicao}: rodada ${u.fase}/${u.rodada} reservada para um passo que já passou`)
      estado.reservadas = estado.reservadas.filter((x) => x !== reserva)
      const novas = partidasDaUnidade(u, reserva.passo)
      estado.partidas.push(...novas)
      criadas.push(...novas)
    }
    eventos.push(...r.eventos)
  }
  const v = definirVagas(estado, ctx, passo.indice)
  criadas.push(...v.criadas)
  eventos.push(...v.eventos)
  estado.passoAtual++
  return { criadas, eventos }
}

/**
 * Competições por vagas cujas origens já acabaram: define os participantes, sorteia a 1ª fase
 * nas rodadas reservadas (que precisam ser depois deste passo) ou cancela a edição se as
 * vagas não fecharem a quantidade.
 */
function definirVagas(estado: EstadoTemporada, ctx: ContextoTemporada, passoAtual: number): { criadas: Partida[]; eventos: EventoCompeticao[] } {
  const criadas: Partida[] = []
  const eventos: EventoCompeticao[] = []
  const todas = [...ctx.competicoes.values()]
  const edicaoDe = (competicao: string) => estado.edicoes.find((x) => x.competicao === competicao && !x.cancelada)
  for (const edicao of estado.edicoes) {
    if (!edicao.aguardandoVagas) continue
    const c = ctx.competicoes.get(edicao.competicao)!
    const origens = origensDasVagas(c, todas)
      .map((o) => ({ competicao: o, edicao: edicaoDe(o.id) }))
      .filter((o): o is { competicao: Competicao; edicao: EstadoEdicao } => !!o.edicao)
    if (origens.some((o) => !o.edicao.classificacaoFinal || o.edicao.aguardandoVagas)) continue
    const times = participantesPorVagas(c, edicao.participantes, origens, (id) => edicaoDe(id)?.participantes ?? [])
    edicao.aguardandoVagas = false
    edicao.participantes = times
    if (times.length < (tamanhoDaCompeticao(c) ?? 0)) {
      edicao.cancelada = true
      estado.reservadas = estado.reservadas.filter((u) => u.edicao !== edicao.id)
      eventos.push({ tipo: 'vagas_definidas', edicao: edicao.id, times, cancelada: true })
      continue
    }
    const op = opcoesDe({ temporada: estado.temporada, regras: ctx.regras, ...(ctx.ranking && { ranking: ctx.ranking }), ...(ctx.paisDe && { paisDe: ctx.paisDe }) })
    for (const u of comecarFase(edicao, c, 0, ordenarPorRanking(times, ctx.ranking), op, ctx.rng.derivar('vagas', edicao.id))) {
      const reserva = estado.reservadas.find((x) => x.edicao === u.edicao && x.fase === u.fase && x.rodada === u.rodada && x.jogo === u.jogo)
      if (!reserva) throw new Error(`${edicao.id}: sem rodada reservada para ${u.fase}/${u.rodada}/${u.jogo}`)
      if (reserva.passo <= passoAtual) {
        throw new Error(`${edicao.id}: as vagas saíram depois da 1ª rodada reservada (a janela da competição precisa começar depois das origens)`)
      }
      estado.reservadas = estado.reservadas.filter((x) => x !== reserva)
      const novas = partidasDaUnidade(u, reserva.passo)
      estado.partidas.push(...novas)
      criadas.push(...novas)
    }
    eventos.push({ tipo: 'vagas_definidas', edicao: edicao.id, times, cancelada: false })
  }
  return { criadas, eventos }
}

export function temporadaEncerrada(estado: EstadoTemporada): boolean {
  return estado.passoAtual >= estado.passos.length
}

/** Índice do próximo passo (a partir do atual) com jogo já definido do time; `null` se não houver. */
export function proximoPassoDoTime(estado: EstadoTemporada, time: Sigla): number | null {
  let menor: number | null = null
  for (const p of estado.partidas) {
    if (p.resultado || p.passo < estado.passoAtual) continue
    if ((p.casa === time || p.visitante === time) && (menor === null || p.passo < menor)) menor = p.passo
  }
  return menor
}
