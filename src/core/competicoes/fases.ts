import type { Rng } from '../rng'
import type { Competicao, Fase, SaidaCompeticao } from '@shared/esquemas/pacote'
import { quantidadeRodadas, todosContraTodos, type Confronto } from './rodadas'
import { decidirConfronto, definirMando, emparelhar, type RegraMataMata } from './mataMata'
import { sortearGrupos } from './sorteio'
import { classificar, DESEMPATE_PADRAO, type LinhaTabela, type Pontuacao } from './tabela'
import type { Partida, Sigla } from './tipos'

/**
 * Motor genérico de fases (03-competicoes): pontos corridos, grupos e mata-mata
 * encadeados. Uma edição é a competição numa temporada.
 *
 * A estrutura de rodadas de todas as fases é conhecida no início (quantidades), mas os
 * confrontos das fases seguintes só existem quando a anterior termina: essas rodadas são
 * "reservadas" no calendário e preenchidas depois.
 */

export interface EstadoFase {
  id: string
  /** Times da fase, em ordem de campanha (melhor → pior); `null` até a fase começar. */
  participantes: Sigla[] | null
  /** Grupos (pontos corridos = um grupo só). */
  grupos: Sigla[][] | null
  /** Ordem de classificação de saída (melhor → pior), quando a fase termina. */
  classificados: Sigla[] | null
  /** Eliminados no mata-mata, na ordem em que caíram (para a classificação final). */
  eliminados: Sigla[][]
  encerrada: boolean
  /** Classificação final de cada grupo (fase de grupos encerrada), para saídas por grupo. */
  ordemGrupos?: Sigla[][]
}

export interface EstadoEdicao {
  id: string
  competicao: string
  temporada: number
  participantes: Sigla[]
  fases: EstadoFase[]
  campeao: Sigla | null
  /** Classificação final da competição (campeão primeiro), quando encerrada. */
  classificacaoFinal: Sigla[] | null
  /**
   * Competição por vagas (`participantes.por_vagas`) esperando as origens acabarem: as rodadas
   * estão reservadas e `participantes` tem só os garantidos.
   */
  aguardandoVagas?: boolean
  /** Não foi disputada: as vagas não fecharam a quantidade (as reservas foram liberadas). */
  cancelada?: boolean
}

/** Uma unidade do calendário: uma rodada (ou um jogo de ida/volta) de uma fase. */
export interface UnidadeRodada {
  edicao: string
  fase: string
  /** Rodada dentro da fase (no mata-mata, a etapa da chave). */
  rodada: number
  jogo: number
  /** Confrontos já conhecidos; `null` = rodada reservada (preenchida quando a fase anterior acabar). */
  confrontos: (Confronto & { grupo: string | null; confronto: string | null })[] | null
  /** Times que podem jogar nessa rodada (para evitar conflito no calendário). */
  possiveis: Sigla[]
}

export const idEdicao = (competicao: string, temporada: number) => `${competicao}-${temporada}`

export function regraMataMata(fase: Extract<Fase, { formato: 'mata_mata' }>): RegraMataMata {
  // Mata-mata sempre tem vencedor: os pênaltis valem mesmo se o pacote desligar.
  return { ...fase.mata_mata, penaltis: true }
}

const nomeGrupo = (i: number) => String.fromCharCode(65 + i)

/** Quantos times entram em cada fase, a partir dos participantes da 1ª. */
export function tamanhosDasFases(c: Competicao, participantes: number): number[] {
  const tamanhos: number[] = []
  let n = participantes
  c.fases.forEach((f, i) => {
    tamanhos.push(n)
    const ultima = i === c.fases.length - 1
    n = saemDaFase(f, n, ultima)
  })
  return tamanhos
}

function saemDaFase(f: Fase, n: number, ultima: boolean): number {
  if (f.formato === 'pontos_corridos') return f.pontos_corridos.classificam ?? (ultima ? 1 : n)
  if (f.formato === 'grupos') return f.grupos.quantidade * f.grupos.classificam
  return f.mata_mata.classificam ?? (ultima ? 1 : n / 2)
}

/** Quantas etapas de chave o mata-mata tem (n → saem). */
function etapasMataMata(n: number, saem: number): number {
  let etapas = 0
  while (n > saem) {
    if (n % 2 !== 0) throw new Error(`Mata-mata com ${n} times (precisa ser par em cada etapa)`)
    n /= 2
    etapas++
  }
  if (n !== saem) throw new Error(`Mata-mata de ${n} não chega a ${saem} classificados`)
  return etapas
}

export interface OpcoesEdicao {
  temporada: number
  pontos: Pontuacao
  /** Ranking para potes e mando (melhor → pior). Sem ele, a ordem dos participantes. */
  ranking?: readonly Sigla[]
  paisDe?: (t: Sigla) => string
}

/**
 * Cria a edição e o plano de rodadas de todas as fases. A 1ª fase já sai com os confrontos
 * (sorteio dos grupos e da tabela); as outras ficam reservadas.
 */
export function iniciarEdicao(c: Competicao, participantes: readonly Sigla[], op: OpcoesEdicao, rng: Rng): { edicao: EstadoEdicao; unidades: UnidadeRodada[] } {
  const id = idEdicao(c.id, op.temporada)
  const tamanhos = tamanhosDasFases(c, participantes.length)
  const ranking = ordenarPorRanking(participantes, op.ranking)
  const edicao: EstadoEdicao = {
    id,
    competicao: c.id,
    temporada: op.temporada,
    participantes: [...participantes],
    fases: c.fases.map((f) => ({ id: f.id, participantes: null, grupos: null, classificados: null, eliminados: [], encerrada: false })),
    campeao: null,
    classificacaoFinal: null,
  }
  // Todas as rodadas de todas as fases reservadas; a 1ª fase já preenche as que conhece.
  const unidades: UnidadeRodada[] = c.fases.flatMap((f, i) =>
    planoReservado(f, tamanhos[i] as number, i === c.fases.length - 1).map((u) => ({ ...u, edicao: id, possiveis: [...participantes] })),
  )
  for (const u of comecarFase(edicao, c, 0, ranking, op, rng)) {
    const k = unidades.findIndex((x) => x.fase === u.fase && x.rodada === u.rodada && x.jogo === u.jogo)
    if (k === -1) throw new Error(`${id}: rodada ${u.fase}/${u.rodada} fora do plano`)
    unidades[k] = u
  }
  return { edicao, unidades }
}

/**
 * Edição de uma competição por vagas, ainda sem os participantes: reserva no calendário todas
 * as rodadas para `n` times (com `possiveis` = quem pode entrar) e guarda os garantidos.
 */
export function reservarEdicao(c: Competicao, n: number, garantidos: readonly Sigla[], possiveis: readonly Sigla[], op: OpcoesEdicao): { edicao: EstadoEdicao; unidades: UnidadeRodada[] } {
  const id = idEdicao(c.id, op.temporada)
  const tamanhos = tamanhosDasFases(c, n)
  const edicao: EstadoEdicao = {
    id,
    competicao: c.id,
    temporada: op.temporada,
    participantes: [...garantidos],
    fases: c.fases.map((f) => ({ id: f.id, participantes: null, grupos: null, classificados: null, eliminados: [], encerrada: false })),
    campeao: null,
    classificacaoFinal: null,
    aguardandoVagas: true,
  }
  const unidades: UnidadeRodada[] = c.fases.flatMap((f, i) =>
    planoReservado(f, tamanhos[i] as number, i === c.fases.length - 1).map((u) => ({ ...u, edicao: id, possiveis: [...possiveis] })),
  )
  return { edicao, unidades }
}

export function ordenarPorRanking(times: readonly Sigla[], ranking?: readonly Sigla[]): Sigla[] {
  if (!ranking) return [...times]
  const pos = (t: Sigla) => {
    const i = ranking.indexOf(t)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...times].sort((a, b) => pos(a) - pos(b))
}

/** Rodadas de uma fase cujos confrontos ainda não se conhecem. */
function planoReservado(f: Fase, n: number, ultima: boolean): Omit<UnidadeRodada, 'edicao' | 'possiveis'>[] {
  const lista: Omit<UnidadeRodada, 'edicao' | 'possiveis'>[] = []
  if (f.formato === 'pontos_corridos') {
    for (let r = 0; r < quantidadeRodadas(n, f.pontos_corridos.turnos); r++) lista.push({ fase: f.id, rodada: r, jogo: 1, confrontos: null })
  } else if (f.formato === 'grupos') {
    for (let r = 0; r < quantidadeRodadas(f.grupos.tamanho, f.grupos.turnos); r++) lista.push({ fase: f.id, rodada: r, jogo: 1, confrontos: null })
  } else {
    const etapas = etapasMataMata(n, saemDaFase(f, n, ultima))
    for (let e = 0; e < etapas; e++) for (let j = 1; j <= f.mata_mata.jogos; j++) lista.push({ fase: f.id, rodada: e, jogo: j, confrontos: null })
  }
  return lista
}

/**
 * Começa a fase `i` com os times já em ordem de campanha: sorteia grupos/tabela e devolve
 * as unidades com confrontos (todas, no pontos corridos e nos grupos; só a 1ª etapa, no
 * mata-mata, que avança etapa a etapa).
 */
export function comecarFase(edicao: EstadoEdicao, c: Competicao, i: number, porCampanha: readonly Sigla[], op: OpcoesEdicao, rng: Rng): UnidadeRodada[] {
  const f = c.fases[i] as Fase
  const estado = edicao.fases[i] as EstadoFase
  estado.participantes = [...porCampanha]
  const base = { edicao: edicao.id, fase: f.id, possiveis: [...porCampanha] }
  const ultima = i === c.fases.length - 1

  if (f.formato === 'pontos_corridos' || f.formato === 'grupos') {
    const grupos =
      f.formato === 'grupos'
        ? sortearGrupos(porCampanha, f.grupos.quantidade, f.grupos.tamanho, f.grupos.sorteio, rng, op.paisDe)
        : [[...porCampanha]]
    estado.grupos = grupos
    const turnos = f.formato === 'grupos' ? f.grupos.turnos : f.pontos_corridos.turnos
    const tabelas = grupos.map((g) => todosContraTodos(g, turnos, rng))
    const total = Math.max(...tabelas.map((t) => t.length))
    const unidades: UnidadeRodada[] = []
    for (let r = 0; r < total; r++) {
      const confrontos = tabelas.flatMap((t, gi) =>
        (t[r] ?? []).map((cf) => ({ ...cf, grupo: f.formato === 'grupos' ? nomeGrupo(gi) : null, confronto: null })),
      )
      unidades.push({ ...base, rodada: r, jogo: 1, confrontos })
    }
    return unidades
  }

  const regra = regraMataMata(f)
  etapasMataMata(porCampanha.length, saemDaFase(f, porCampanha.length, ultima))
  const chaves = emparelhar(porCampanha, regra, rng)
  return unidadesDaEtapa(edicao.id, f.id, 0, chaves, regra, base.possiveis)
}

function unidadesDaEtapa(edicao: string, fase: string, etapa: number, chaves: Confronto[], regra: RegraMataMata, possiveis: Sigla[]): UnidadeRodada[] {
  const unidades: UnidadeRodada[] = []
  for (let j = 1; j <= regra.jogos; j++) {
    const confrontos = chaves.map((ch, k) => {
      const id = `${fase}-${etapa}-${k}`
      return j === 1 ? { ...ch, grupo: null, confronto: id } : { casa: ch.visitante, visitante: ch.casa, grupo: null, confronto: id }
    })
    unidades.push({ edicao, fase, rodada: etapa, jogo: j, confrontos, possiveis })
  }
  return unidades
}

// ------------------------------------------------------------------ avanço

export interface ContextoAvanco {
  competicao: Competicao
  partidas: readonly Partida[]
  /** Unidades ainda reservadas desta edição (sem confrontos). */
  reservadas: readonly UnidadeRodada[]
  op: OpcoesEdicao
  rng: Rng
}

export type EventoCompeticao =
  | { tipo: 'fase_encerrada'; edicao: string; fase: string; classificados: Sigla[] }
  /** Competição por vagas: participantes definidos (ou cancelada, se não fechou a quantidade). */
  | { tipo: 'vagas_definidas'; edicao: string; times: Sigla[]; cancelada: boolean }
  | { tipo: 'campeao'; edicao: string; time: Sigla }

/**
 * Depois de um passo: encerra fases completas, avança etapas do mata-mata e começa a
 * próxima fase. Devolve as unidades reservadas que agora têm confrontos.
 */
export function avancarEdicao(edicao: EstadoEdicao, ctx: ContextoAvanco): { preenchidas: UnidadeRodada[]; eventos: EventoCompeticao[] } {
  const preenchidas: UnidadeRodada[] = []
  const eventos: EventoCompeticao[] = []
  if (edicao.campeao || edicao.aguardandoVagas || edicao.cancelada) return { preenchidas, eventos }
  const c = ctx.competicao
  let reservadas = [...ctx.reservadas]
  const preencher = (novas: UnidadeRodada[]) => {
    for (const u of novas) {
      const r = reservadas.find((x) => x.fase === u.fase && x.rodada === u.rodada && x.jogo === u.jogo)
      if (!r) throw new Error(`${edicao.id}: sem rodada reservada para ${u.fase}/${u.rodada}/${u.jogo}`)
      reservadas = reservadas.filter((x) => x !== r)
      preenchidas.push(u)
    }
  }

  for (let i = 0; i < c.fases.length; i++) {
    const f = c.fases[i] as Fase
    const estado = edicao.fases[i] as EstadoFase
    if (estado.encerrada) continue
    if (!estado.participantes) break
    const daFase = [...ctx.partidas, ...preenchidas.flatMap(unidadeParaPartidasFicticias)].filter((p) => p.edicao === edicao.id && p.fase === f.id)
    const pendentesNaFase = reservadas.some((u) => u.fase === f.id)

    if (f.formato === 'mata_mata') {
      const regra = regraMataMata(f)
      const etapa = Math.max(-1, ...daFase.map((p) => p.rodada))
      const daEtapa = daFase.filter((p) => p.rodada === etapa)
      if (etapa < 0 || daEtapa.some((p) => !p.resultado)) break
      const decisoes = agruparConfrontos(daEtapa).map((jogos) => decidirConfronto(jogos, regra)!)
      const vencedores = decisoes.map((d) => d.vencedor)
      estado.eliminados.push(decisoes.map((d) => d.perdedor))
      if (pendentesNaFase) {
        // Próxima etapa: vencedor da chave 2k x vencedor da chave 2k+1; mando pela campanha.
        const campanha = estado.participantes
        const chaves: Confronto[] = []
        for (let k = 0; k < vencedores.length; k += 2) {
          const [a, b] = [vencedores[k]!, vencedores[k + 1]!]
          const [melhor, pior] = campanha.indexOf(a) <= campanha.indexOf(b) ? [a, b] : [b, a]
          chaves.push(definirMando(melhor, pior, regra, ctx.rng))
        }
        preencher(unidadesDaEtapa(edicao.id, f.id, etapa + 1, chaves, regra, [...vencedores]))
        break
      }
      estado.classificados = ordenarPorCampanha(vencedores, estado.participantes)
    } else {
      if (pendentesNaFase || daFase.some((p) => !p.resultado)) break
      estado.classificados = classificadosDaTabela(f, estado, daFase, ctx.op, edicao.id)
      if (f.formato === 'grupos') estado.ordemGrupos = tabelasDaFase(f, estado, daFase, ctx.op, edicao.id).map((t) => t.linhas.map((l) => l.time))
    }

    estado.encerrada = true
    const proxima = c.fases[i + 1]
    eventos.push({ tipo: 'fase_encerrada', edicao: edicao.id, fase: f.id, classificados: [...estado.classificados] })
    if (!proxima) {
      edicao.campeao = estado.classificados[0] ?? null
      edicao.classificacaoFinal = classificacaoFinal(edicao, c, ctx.partidas, ctx.op)
      if (edicao.campeao) eventos.push({ tipo: 'campeao', edicao: edicao.id, time: edicao.campeao })
      break
    }
    const sobem = estado.classificados.slice(0, saemDaFase(f, estado.participantes.length, false))
    preencher(comecarFase(edicao, c, i + 1, sobem, ctx.op, ctx.rng))
  }
  return { preenchidas, eventos }
}

/** Partidas sem resultado só para o laço enxergar a etapa recém-criada. */
function unidadeParaPartidasFicticias(u: UnidadeRodada): Partida[] {
  return (u.confrontos ?? []).map((cf, k) => ({
    id: `novo-${u.fase}-${u.rodada}-${u.jogo}-${k}`,
    edicao: u.edicao,
    fase: u.fase,
    grupo: cf.grupo,
    rodada: u.rodada,
    confronto: cf.confronto,
    jogo: u.jogo,
    casa: cf.casa,
    visitante: cf.visitante,
    passo: -1,
    resultado: null,
  }))
}

function agruparConfrontos(partidas: readonly Partida[]): Partida[][] {
  const mapa = new Map<string, Partida[]>()
  for (const p of partidas) {
    const k = p.confronto ?? p.id
    mapa.set(k, [...(mapa.get(k) ?? []), p])
  }
  return [...mapa.entries()].sort(([a], [b]) => ordemConfronto(a) - ordemConfronto(b)).map(([, js]) => js.sort((x, y) => x.jogo - y.jogo))
}

const ordemConfronto = (id: string) => Number(id.split('-').pop())

function ordenarPorCampanha(times: readonly Sigla[], campanha: readonly Sigla[]): Sigla[] {
  return [...times].sort((a, b) => campanha.indexOf(a) - campanha.indexOf(b))
}

export function tabelasDaFase(f: Fase, estado: EstadoFase, partidas: readonly Partida[], op: OpcoesEdicao, edicao: string): { grupo: string | null; linhas: LinhaTabela[] }[] {
  const criterios = f.desempate ?? DESEMPATE_PADRAO
  return (estado.grupos ?? []).map((g, gi) => {
    const grupo = f.formato === 'grupos' ? nomeGrupo(gi) : null
    const jogos = partidas.filter((p) => p.grupo === grupo)
    const semente = hashSimples(`${edicao}/${f.id}/${grupo ?? ''}`)
    return { grupo, linhas: classificar(g, jogos, { pontos: op.pontos, criterios, sementeSorteio: semente }) }
  })
}

function hashSimples(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Ordem de saída de uma fase de tabela: posição no grupo, depois campanha entre grupos. */
function classificadosDaTabela(f: Fase, estado: EstadoFase, partidas: readonly Partida[], op: OpcoesEdicao, edicao: string): Sigla[] {
  const tabelas = tabelasDaFase(f, estado, partidas, op, edicao)
  if (tabelas.length === 1) return tabelas[0]!.linhas.map((l) => l.time)
  const porPosicao = new Map<number, LinhaTabela[]>()
  for (const t of tabelas) for (const l of t.linhas) porPosicao.set(l.posicao, [...(porPosicao.get(l.posicao) ?? []), l])
  const saida: Sigla[] = []
  for (const pos of [...porPosicao.keys()].sort((a, b) => a - b)) {
    const linhas = porPosicao.get(pos)!.sort((a, b) => b.pontos - a.pontos || b.saldo - a.saldo || b.golsPro - a.golsPro || a.time.localeCompare(b.time))
    saida.push(...linhas.map((l) => l.time))
  }
  return saida
}

/**
 * Classificação final: a última fase decide o topo (tabela ou chave); quem caiu antes
 * vem depois, fase a fase, de trás para frente, pela campanha na fase em que saiu.
 */
export function classificacaoFinal(edicao: EstadoEdicao, c: Competicao, partidas: readonly Partida[], op: OpcoesEdicao): Sigla[] {
  const saida: Sigla[] = []
  const ja = new Set<Sigla>()
  const add = (ts: readonly Sigla[]) => {
    for (const t of ts) {
      if (ja.has(t)) continue
      ja.add(t)
      saida.push(t)
    }
  }
  for (let i = c.fases.length - 1; i >= 0; i--) {
    const f = c.fases[i] as Fase
    const estado = edicao.fases[i] as EstadoFase
    if (!estado.participantes) continue
    if (f.formato === 'mata_mata') {
      add(estado.classificados ?? [])
      // Perdedores da etapa mais avançada primeiro (o vice antes dos semifinalistas).
      for (const elim of [...estado.eliminados].reverse()) add(ordenarPorCampanha(elim, estado.participantes))
    } else {
      const daFase = partidas.filter((p) => p.edicao === edicao.id && p.fase === f.id)
      add(classificadosDaTabela(f, estado, daFase, op, edicao.id))
    }
  }
  add(edicao.participantes)
  return saida
}

export interface Saida {
  time: Sigla
  destino: string
  tipo: string
}

/**
 * Resolve as saídas da competição (acesso, rebaixamento, vagas) pela classificação final:
 * `campeao`, `posicoes` ("1-4"), `primeiros`/`ultimos` N (só entre quem jogou `fase`, se
 * houver) e `por_grupo` (os N primeiros ou últimos de cada grupo de uma fase).
 */
export function resolverSaidas(edicao: EstadoEdicao, c: Competicao): Saida[] {
  const final = edicao.classificacaoFinal
  if (!final) return []
  const saidas: Saida[] = []
  for (const s of c.saidas ?? []) {
    // Vaga pulando depende da próxima temporada: resolvida na virada (competicoes/virada.ts).
    if (s.exceto_de?.length) continue
    const tipo = s.tipo ?? 'vaga'
    const add = (times: readonly Sigla[]) => {
      for (const time of times) saidas.push({ time, destino: s.destino, tipo })
    }
    if (s.campeao && edicao.campeao) add([edicao.campeao])
    if (s.posicoes) {
      const [de, ate] = s.posicoes.split('-').map((x) => Number(x.trim())) as [number, number | undefined]
      add(final.slice(de - 1, ate ?? de))
    }
    if (s.primeiros || s.ultimos) {
      const base = ordemDaSaida(edicao, c, s.fase)
      if (s.primeiros) add(base.slice(0, s.primeiros))
      if (s.ultimos) add(base.slice(Math.max(0, base.length - s.ultimos)))
    }
    if (s.por_grupo) {
      const { lado, n } = s.por_grupo
      for (const g of gruposEmOrdem(edicao, c, s.por_grupo.fase)) add(lado === 'primeiros' ? g.slice(0, n) : g.slice(Math.max(0, g.length - n)))
    }
  }
  return saidas
}

/**
 * Vaga com pulo (`exceto_de` da saída e `pula_quem_joga` do destino): os times da saída, mas
 * quem está em `fora` ou `ja` é pulado e a vaga desce para o próximo colocado. Campeão começa
 * no 1º, posições "a-b" no a-ésimo (b-a+1 vagas), primeiros no 1º (só entre quem jogou `fase`).
 * Últimos e por grupo não pulam (são de rebaixamento).
 */
export function escolherComPulo(edicao: EstadoEdicao, c: Competicao, s: SaidaCompeticao, fora: ReadonlySet<Sigla>, ja: ReadonlySet<Sigla> = new Set()): Sigla[] {
  const final = edicao.classificacaoFinal
  if (!final) return []
  const trechos: { base: Sigla[]; de: number; n: number }[] = []
  if (s.campeao) trechos.push({ base: final, de: 0, n: 1 })
  if (s.posicoes) {
    const [de, ate] = s.posicoes.split('-').map((x) => Number(x.trim())) as [number, number | undefined]
    if (de >= 1) trechos.push({ base: final, de: de - 1, n: (ate ?? de) - de + 1 })
  }
  if (s.primeiros) trechos.push({ base: ordemDaSaida(edicao, c, s.fase), de: 0, n: s.primeiros })
  const escolhidos: Sigla[] = []
  for (const t of trechos) {
    let pegou = 0
    for (let i = t.de; i < t.base.length && pegou < t.n; i++) {
      const time = t.base[i]!
      if (fora.has(time) || ja.has(time) || escolhidos.includes(time)) continue
      escolhidos.push(time)
      pegou++
    }
  }
  return escolhidos
}

/** Classificação final (só entre quem jogou `fase`, se houver): a ordem de `primeiros`/`ultimos`. */
export function ordemDaSaida(edicao: EstadoEdicao, c: Competicao, fase?: string): Sigla[] {
  const final = edicao.classificacaoFinal ?? []
  const jogaram = fase ? participantesDaFase(edicao, c, fase) : null
  return jogaram ? final.filter((t) => jogaram.has(t)) : [...final]
}

function estadoDaFase(edicao: EstadoEdicao, c: Competicao, fase: string): EstadoFase | null {
  const i = c.fases.findIndex((f) => f.id === fase)
  return i >= 0 ? (edicao.fases[i] ?? null) : null
}

function participantesDaFase(edicao: EstadoEdicao, c: Competicao, fase: string): Set<Sigla> {
  return new Set(estadoDaFase(edicao, c, fase)?.participantes ?? [])
}

/** Grupos da fase na ordem final de cada um (sem a ordem gravada, a da classificação final). */
function gruposEmOrdem(edicao: EstadoEdicao, c: Competicao, fase: string): Sigla[][] {
  const estado = estadoDaFase(edicao, c, fase)
  if (!estado) return []
  if (estado.ordemGrupos) return estado.ordemGrupos
  const final = edicao.classificacaoFinal ?? []
  return (estado.grupos ?? []).map((g) => ordenarPorCampanha(g, final))
}
