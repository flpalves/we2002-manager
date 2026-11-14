import { hash32 } from '../rng'
import type { Partida, Sigla } from './tipos'

/**
 * Classificação de pontos corridos / grupos e desempates configuráveis. Cada critério é
 * um comparador; os critérios são aplicados em ordem aos grupos de times ainda empatados
 * (o confronto direto olha só os jogos entre os empatados daquele grupo).
 */

export type CriterioDesempate =
  | 'pontos'
  | 'vitorias'
  | 'saldo'
  | 'gols_pro'
  | 'confronto_direto'
  | 'menos_vermelhos'
  | 'menos_amarelos'
  | 'sorteio'

export const DESEMPATE_PADRAO: CriterioDesempate[] = [
  'pontos',
  'vitorias',
  'saldo',
  'gols_pro',
  'confronto_direto',
  'menos_vermelhos',
  'menos_amarelos',
  'sorteio',
]

export interface Pontuacao {
  vitoria: number
  empate: number
  derrota: number
}

export interface LinhaTabela {
  time: Sigla
  posicao: number
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  golsPro: number
  golsContra: number
  saldo: number
  pontos: number
  amarelos: number
  vermelhos: number
  /** Últimos resultados, do mais antigo ao mais recente: V, E ou D. */
  ultimos: ('V' | 'E' | 'D')[]
}

function linhaVazia(time: Sigla): LinhaTabela {
  return { time, posicao: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldo: 0, pontos: 0, amarelos: 0, vermelhos: 0, ultimos: [] }
}

/**
 * Soma as partidas jogadas. A prorrogação não muda o resultado de tabela (pontos corridos
 * não têm prorrogação); os gols contam como vieram.
 */
export function somarPartidas(times: readonly Sigla[], partidas: readonly Partida[], pontos: Pontuacao): Map<Sigla, LinhaTabela> {
  const linhas = new Map(times.map((t) => [t, linhaVazia(t)]))
  const ordenadas = [...partidas].filter((p) => p.resultado).sort((a, b) => a.passo - b.passo || a.id.localeCompare(b.id))
  for (const p of ordenadas) {
    const r = p.resultado!
    // Cada lado conta para o seu time, se ele estiver na tabela.
    const lados: [LinhaTabela | undefined, number, number, typeof r.cartoesCasa][] = [
      [linhas.get(p.casa), r.golsCasa, r.golsVisitante, r.cartoesCasa],
      [linhas.get(p.visitante), r.golsVisitante, r.golsCasa, r.cartoesVisitante],
    ]
    for (const [l, gp, gc, cartoes] of lados) {
      if (!l) continue
      l.jogos++
      l.golsPro += gp
      l.golsContra += gc
      l.saldo = l.golsPro - l.golsContra
      l.amarelos += cartoes?.amarelos ?? 0
      l.vermelhos += cartoes?.vermelhos ?? 0
      if (gp > gc) {
        l.vitorias++
        l.pontos += pontos.vitoria
        l.ultimos.push('V')
      } else if (gp === gc) {
        l.empates++
        l.pontos += pontos.empate
        l.ultimos.push('E')
      } else {
        l.derrotas++
        l.pontos += pontos.derrota
        l.ultimos.push('D')
      }
    }
  }
  return linhas
}

type Comparador = (a: LinhaTabela, b: LinhaTabela) => number

/** Maior primeiro. */
const desc = (f: (l: LinhaTabela) => number): Comparador => (a, b) => f(b) - f(a)
/** Menor primeiro. */
const asc = (f: (l: LinhaTabela) => number): Comparador => (a, b) => f(a) - f(b)

const COMPARADORES: Record<Exclude<CriterioDesempate, 'confronto_direto' | 'sorteio'>, Comparador> = {
  pontos: desc((l) => l.pontos),
  vitorias: desc((l) => l.vitorias),
  saldo: desc((l) => l.saldo),
  gols_pro: desc((l) => l.golsPro),
  menos_vermelhos: asc((l) => l.vermelhos),
  menos_amarelos: asc((l) => l.amarelos),
}

export interface OpcoesTabela {
  pontos: Pontuacao
  criterios: readonly CriterioDesempate[]
  /** Semente do sorteio (estável: o mesmo empate sempre dá a mesma ordem). */
  sementeSorteio: number
}

/** Ordena um grupo de empatados pelos critérios a partir de `i`. */
function desempatar(
  grupo: LinhaTabela[],
  i: number,
  criterios: readonly CriterioDesempate[],
  partidas: readonly Partida[],
  op: OpcoesTabela,
): LinhaTabela[] {
  if (grupo.length <= 1 || i >= criterios.length) {
    // Sem critério que resolva: ordem estável pelo nome (só acontece sem 'sorteio' na lista).
    return [...grupo].sort((a, b) => a.time.localeCompare(b.time))
  }
  const criterio = criterios[i] as CriterioDesempate
  let comparar: Comparador
  if (criterio === 'sorteio') {
    const chave = (t: Sigla) => hash32(t, op.sementeSorteio)
    comparar = (a, b) => chave(a.time) - chave(b.time)
  } else if (criterio === 'confronto_direto') {
    const nomes = new Set(grupo.map((l) => l.time))
    const entre = partidas.filter((p) => nomes.has(p.casa) && nomes.has(p.visitante))
    const mini = somarPartidas([...nomes], entre, op.pontos)
    comparar = (a, b) => mini.get(b.time)!.pontos - mini.get(a.time)!.pontos
  } else {
    comparar = COMPARADORES[criterio]
  }
  const ordenado = [...grupo].sort(comparar)
  const saida: LinhaTabela[] = []
  let k = 0
  while (k < ordenado.length) {
    let fim = k + 1
    while (fim < ordenado.length && comparar(ordenado[k]!, ordenado[fim]!) === 0) fim++
    saida.push(...desempatar(ordenado.slice(k, fim), i + 1, criterios, partidas, op))
    k = fim
  }
  return saida
}

export function classificar(times: readonly Sigla[], partidas: readonly Partida[], op: OpcoesTabela): LinhaTabela[] {
  const linhas = [...somarPartidas(times, partidas, op.pontos).values()]
  // 'pontos' é sempre o primeiro critério, mesmo que o pacote esqueça.
  const criterios = op.criterios[0] === 'pontos' ? op.criterios : ['pontos' as const, ...op.criterios]
  const jogadas = partidas.filter((p) => p.resultado)
  return desempatar(linhas, 0, criterios, jogadas, op).map((l, i) => ({ ...l, posicao: i + 1 }))
}
