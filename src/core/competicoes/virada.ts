import type { Competicao, SaidaCompeticao } from '@shared/esquemas/pacote'
import type { Rng } from '../rng'
import { CRITERIO_PADRAO, saidaDoCriterio } from './divisoes'
import { escolherComPulo, resolverSaidas, type EstadoEdicao } from './fases'
import { ehPorVagas } from './vagas'
import type { Sigla } from './tipos'

/**
 * Virada de temporada (03-competicoes, "Virada de temporada"): participantes da próxima
 * temporada a partir das saídas de cada competição encerrada.
 *
 * - `acesso` e `rebaixamento` MOVEM o time: sai da lista da competição de origem e entra na
 *   do destino (as duas com participantes por `lista`).
 * - Os demais tipos (`vaga`, `libertadores`, ...) são vagas: o time entra no destino que tem
 *   participantes por `classificados_de` (na ordem das saídas, sem repetir, até `quantidade`).
 *   Vagas para competições `por_vagas` (ex.: Série D) valem no MESMO ano (competicoes/vagas.ts):
 *   na virada, a lista delas fica só com quem chegou por acesso/rebaixamento (os garantidos).
 * - Vaga com pulo para `classificados_de` (`pula_quem_joga` do destino ou `exceto_de` da saída):
 *   a vaga desce a classificação pulando quem joga essas competições na próxima temporada ou já
 *   entrou no destino. Resolvida depois de acessos, rebaixamentos, segundas divisões e das vagas
 *   sem pulo, na ordem das edições.
 * - Segunda divisão fantasma (`segunda_divisao` de um estadual/regional): os piores caem e o
 *   mesmo número sobe, sorteado com o `rng` entre os clubes que podem subir.
 * - `por_divisao` ainda não é suportado: a competição fica como está.
 */

export interface Movimento {
  time: Sigla
  de: string
  para: string
  tipo: string
}

export interface ParticipantesSeguintes {
  /** Competição → participantes da próxima temporada (só as que têm participantes conhecidos). */
  participantes: Record<string, Sigla[]>
  /** Acessos e rebaixamentos aplicados. */
  movimentos: Movimento[]
  /** Vagas distribuídas (competição de origem → destino). */
  vagas: Movimento[]
  /** Quem caiu para a segunda divisão fantasma e quem subiu dela (ids de `idSegundaDivisao`). */
  segundaDivisao: Movimento[]
  /**
   * Aptos marcados (`segunda_divisao.times`) da próxima temporada: sem quem subiu, com quem caiu.
   * Só as competições que têm a marcação e tiveram troca.
   */
  aptos: Record<string, Sigla[]>
}

/** Clube do pacote, para o sorteio das segundas divisões. */
export interface ClubeVirada {
  sigla: Sigla
  estado?: string | null
}

export interface OpcoesVirada {
  /** Todos os clubes do pacote (sem eles, nenhuma segunda divisão é aplicada). */
  clubes?: readonly ClubeVirada[]
  /** Sorteio das segundas divisões (derivado por competição). */
  rng?: Rng
}

export const TIPOS_MOVIMENTO = ['acesso', 'rebaixamento'] as const
const ehMovimento = (tipo: string) => (TIPOS_MOVIMENTO as readonly string[]).includes(tipo)
const ehEstadual = (c: Competicao) => c.tipo === 'estadual' || c.tipo === 'regional'

/** Id da segunda divisão fantasma de uma competição (não é competição do pacote). */
export const idSegundaDivisao = (competicao: string) => `${competicao}#2`
export const ehSegundaDivisao = (id: string) => id.endsWith('#2')
export const nomeSegundaDivisao = (c: Pick<Competicao, 'nome' | 'segunda_divisao'>) => c.segunda_divisao?.nome ?? `${c.nome} (2ª divisão)`

/** Estados de onde sobem os clubes: os configurados ou, sem configuração, os dos participantes. */
export function estadosDaSegundaDivisao(c: Competicao, participantes: readonly Sigla[], clubes: readonly ClubeVirada[]): string[] {
  if (c.segunda_divisao?.estados?.length) return [...c.segunda_divisao.estados]
  const estadoDe = new Map(clubes.map((t) => [t.sigla, t.estado ?? null]))
  const r: string[] = []
  for (const s of participantes) {
    const e = estadoDe.get(s)
    if (e && !r.includes(e)) r.push(e)
  }
  return r
}

/**
 * Clubes que podem subir da segunda divisão, em ordem de sigla: os marcados como aptos (`times`)
 * ou, sem marcação, os dos estados; menos `fora` (quem jogou o estadual e quem está em outro
 * estadual/regional).
 */
export function candidatosSegundaDivisao(
  c: Competicao,
  participantes: readonly Sigla[],
  clubes: readonly ClubeVirada[],
  fora: ReadonlySet<Sigla>,
): Sigla[] {
  const aptos = new Set(c.segunda_divisao?.times ?? [])
  const estados = new Set(aptos.size ? [] : estadosDaSegundaDivisao(c, participantes, clubes))
  const pode = (t: ClubeVirada) => (aptos.size ? aptos.has(t.sigla) : !!t.estado && estados.has(t.estado))
  return clubes
    .filter((t) => !fora.has(t.sigla) && !participantes.includes(t.sigla) && pode(t))
    .map((t) => t.sigla)
    .sort()
}

/**
 * @param atuais participantes desta temporada (id da competição → siglas)
 * @param edicoes edições encerradas desta temporada (com a classificação final)
 */
export function participantesSeguintes(
  competicoes: readonly Competicao[],
  atuais: Readonly<Record<string, readonly Sigla[]>>,
  edicoes: readonly EstadoEdicao[],
  op: OpcoesVirada = {},
): ParticipantesSeguintes {
  const porId = new Map(competicoes.map((c) => [c.id, c]))
  const listas = new Map<string, Sigla[]>()
  for (const c of competicoes) if (c.participantes.regra === 'lista') listas.set(c.id, [...(atuais[c.id] ?? c.participantes.times)])
  const recebeVaga = (destino: Competicao, origem: string) =>
    destino.participantes.regra === 'classificados_de' && destino.participantes.origens.includes(origem)
  // Vaga com pulo (do destino ou da saída): resolvida depois, quando se sabe quem joga o quê.
  const comPulo = (s: SaidaCompeticao, destino: Competicao) => !s.ultimos && !s.por_grupo && !!(s.exceto_de?.length || destino.pula_quem_joga?.length)

  const movimentos: Movimento[] = []
  const vagas: Movimento[] = []
  const pulando: { e: EstadoEdicao; c: Competicao; s: SaidaCompeticao }[] = []
  // Primeiro decide tudo pela temporada que acabou; depois aplica (a ordem das competições não importa).
  for (const e of edicoes) {
    const c = porId.get(e.competicao)
    if (!c) continue
    for (const s of resolverSaidas(e, c)) {
      const destino = porId.get(s.destino)
      if (!destino || s.destino === c.id) continue
      const m = { time: s.time, de: c.id, para: s.destino, tipo: s.tipo }
      if (ehMovimento(s.tipo)) {
        if (listas.has(c.id) && listas.has(s.destino) && !movimentos.some((x) => x.time === s.time)) movimentos.push(m)
      } else if (recebeVaga(destino, c.id) && !destino.pula_quem_joga?.length) {
        vagas.push(m)
      }
    }
    if (!e.classificacaoFinal) continue
    for (const s of c.saidas ?? []) {
      const destino = porId.get(s.destino)
      if (destino && s.destino !== c.id && !ehMovimento(s.tipo ?? 'vaga') && recebeVaga(destino, c.id) && comPulo(s, destino)) pulando.push({ e, c, s })
    }
  }

  const entrou = new Map<string, Sigla[]>()
  for (const m of movimentos) {
    const origem = listas.get(m.de)!
    const i = origem.indexOf(m.time)
    if (i >= 0) origem.splice(i, 1)
    const destino = listas.get(m.para)!
    if (!destino.includes(m.time)) destino.push(m.time)
    entrou.set(m.para, [...(entrou.get(m.para) ?? []), m.time])
  }

  const segundaDivisao = aplicarSegundasDivisoes(competicoes, atuais, edicoes, listas, op)
  const aptos: Record<string, Sigla[]> = {}
  for (const c of competicoes) {
    const marcados = c.segunda_divisao?.times
    const trocas = segundaDivisao.filter((m) => m.de === c.id || m.para === c.id)
    if (!marcados?.length || !trocas.length) continue
    const subiram = new Set(trocas.filter((m) => m.para === c.id).map((m) => m.time))
    const cairam = trocas.filter((m) => m.de === c.id).map((m) => m.time)
    aptos[c.id] = [...marcados.filter((t) => !subiram.has(t)), ...cairam.filter((t) => !marcados.includes(t))]
  }

  // Entradas de quem recebe vagas na virada (classificados_de): as vagas na ordem, depois as pulando.
  const entradas = new Map<string, Sigla[]>()
  for (const c of competicoes) if (c.participantes.regra === 'classificados_de') entradas.set(c.id, [])
  const entrar = (destino: string, time: Sigla) => {
    const l = entradas.get(destino)
    if (l && !l.includes(time)) l.push(time)
  }
  for (const v of vagas) entrar(v.para, v.time)
  for (const { e, c, s } of pulando) {
    const ja = new Set(entradas.get(s.destino) ?? [])
    const fora = new Set<Sigla>()
    for (const id of [...(s.exceto_de ?? []), ...(porId.get(s.destino)?.pula_quem_joga ?? [])]) {
      for (const t of listas.get(id) ?? entradas.get(id) ?? []) fora.add(t)
    }
    for (const time of escolherComPulo(e, c, s, fora, ja)) {
      vagas.push({ time, de: c.id, para: s.destino, tipo: s.tipo ?? 'vaga' })
      entrar(s.destino, time)
    }
  }

  const participantes: Record<string, Sigla[]> = Object.fromEntries(listas)
  for (const c of competicoes) {
    const times = entradas.get(c.id)
    if (times && c.participantes.regra === 'classificados_de') {
      const q = c.participantes.quantidade
      participantes[c.id] = q ? times.slice(0, q) : times
    }
    // Por vagas: só os garantidos da próxima temporada (o resto vem das vagas do ano).
    if (ehPorVagas(c)) participantes[c.id] = [...new Set(entrou.get(c.id) ?? [])]
  }
  return { participantes, movimentos, vagas, segundaDivisao, aptos }
}

/**
 * Segundas divisões fantasmas (mexe em `listas`): em cada estadual/regional por lista com
 * `segunda_divisao` e edição encerrada, os piores caem e sobem clubes sorteados. Se houver menos
 * candidatos que a troca, só caem tantos quantos sobem (o estadual mantém o tamanho).
 */
function aplicarSegundasDivisoes(
  competicoes: readonly Competicao[],
  atuais: Readonly<Record<string, readonly Sigla[]>>,
  edicoes: readonly EstadoEdicao[],
  listas: Map<string, Sigla[]>,
  op: OpcoesVirada,
): Movimento[] {
  const { clubes, rng } = op
  if (!clubes || !rng) return []
  const r: Movimento[] = []
  // Quem já está (nesta ou na próxima temporada) em algum estadual/regional não sobe de outro.
  const ocupados = new Set<Sigla>()
  for (const c of competicoes) {
    if (!ehEstadual(c)) continue
    for (const t of [...(atuais[c.id] ?? []), ...(listas.get(c.id) ?? [])]) ocupados.add(t)
  }
  for (const c of competicoes) {
    const sd = c.segunda_divisao
    const lista = listas.get(c.id)
    const e = edicoes.find((x) => x.competicao === c.id)
    if (!sd || !lista || !ehEstadual(c) || !e?.classificacaoFinal) continue
    const ghost = idSegundaDivisao(c.id)
    const saida: SaidaCompeticao = { ...saidaDoCriterio(sd.descem ?? CRITERIO_PADRAO, 'ultimos', sd.troca), destino: ghost, tipo: 'rebaixamento' }
    const caem = resolverSaidas(e, { ...c, saidas: [saida] })
      .map((s) => s.time)
      .filter((t, i, a) => lista.includes(t) && a.indexOf(t) === i)
    const jogaram = [...new Set([...e.participantes, ...(atuais[c.id] ?? [])])]
    const candidatos = candidatosSegundaDivisao(c, jogaram, clubes, ocupados)
    const k = Math.min(sd.troca, caem.length, candidatos.length)
    if (!k) continue
    const sobem = rng.derivar('segunda_divisao', c.id).embaralhar(candidatos).slice(0, k)
    for (const t of caem.slice(caem.length - k)) {
      lista.splice(lista.indexOf(t), 1)
      r.push({ time: t, de: c.id, para: ghost, tipo: 'rebaixamento' })
    }
    for (const t of sobem) {
      lista.push(t)
      ocupados.add(t)
      r.push({ time: t, de: ghost, para: c.id, tipo: 'acesso' })
    }
  }
  return r
}
