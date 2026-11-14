/**
 * Escolha automática de uniforme (port de `resolverUniformes` / `conflitoKits` de
 * campeonato/times.js e tools/lib/times.mjs): o visitante usa o reserva quando a camisa
 * titular se confunde com a do mandante e o reserva não.
 */

import { PESO_NA_CAMISA } from './estampas'

export type Uniforme ='titular' | 'reserva'
export type PedidoUniforme = Uniforme | 'auto'

type Kit = Record<string, unknown> | null | undefined

function rgb(h: unknown): [number, number, number] | null {
  const m = typeof h === 'string' ? /^#?([0-9a-f]{6})$/i.exec(h) : null
  return m ? ([0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)) as [number, number, number]) : null
}

/**
 * Cor média da camisa: listras (verticais ou horizontais) contam pela média; meio a meio, mangas, faixa diagonal e
 * faixa do peito entram com o peso aproximado da área que ocupam (`PESO_NA_CAMISA`).
 */
export function corCamisa(kit: Kit): [number, number, number] | null {
  const d = (kit?.['design'] ?? {}) as Record<string, unknown>
  const listras = (d['listras_verticais'] ?? d['listras_horizontais']) as { cores?: unknown[] } | undefined
  const cores = (listras?.cores ?? [d['camisa']]).map(rgb).filter((c): c is [number, number, number] => c !== null)
  if (!cores.length) return null
  let media = [0, 1, 2].map((i) => cores.reduce((a, c) => a + c[i]!, 0) / cores.length) as [number, number, number]
  const extras: [unknown, number][] = [
    [d['mangas'], PESO_NA_CAMISA.mangas],
    [(d['faixa_diagonal'] as { cor?: unknown } | undefined)?.cor, PESO_NA_CAMISA.faixa_diagonal],
    [(d['faixa_peito'] as { cor?: unknown } | undefined)?.cor, PESO_NA_CAMISA.faixa_peito],
    [(d['meio_a_meio'] as { cor?: unknown } | undefined)?.cor, PESO_NA_CAMISA.meio_a_meio],
  ]
  for (const [hex, peso] of extras) {
    const c = rgb(hex)
    if (c) media = [0, 1, 2].map((i) => media[i]! * (1 - peso) + c[i]! * peso) as [number, number, number]
  }
  return media
}

export const LIMITE_CONFLITO = 140

export function conflitoKits(a: Kit, b: Kit, limite = LIMITE_CONFLITO): boolean {
  const ca = corCamisa(a)
  const cb = corCamisa(b)
  if (!ca || !cb) return false
  return Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]) < limite
}

export interface KitsTime {
  kit: Kit
  kit_reserva: Kit
}

/** Uniformes pelo MANDO REAL. */
export function resolverUniformes(casa: KitsTime, visitante: KitsTime, pedidoCasa: PedidoUniforme = 'auto', pedidoVisitante: PedidoUniforme = 'auto'): { casa: Uniforme; visitante: Uniforme; conflito: boolean } {
  const usoCasa: Uniforme = pedidoCasa === 'reserva' && casa.kit_reserva ? 'reserva' : 'titular'
  const kitCasa = usoCasa === 'reserva' ? casa.kit_reserva : casa.kit
  let usoVisitante: Uniforme = 'titular'
  if (visitante.kit_reserva) {
    if (pedidoVisitante === 'reserva') usoVisitante = 'reserva'
    else if (pedidoVisitante === 'auto' && conflitoKits(kitCasa, visitante.kit) && !conflitoKits(kitCasa, visitante.kit_reserva)) usoVisitante = 'reserva'
  }
  const kitVisitante = usoVisitante === 'reserva' ? visitante.kit_reserva : visitante.kit
  return { casa: usoCasa, visitante: usoVisitante, conflito: conflitoKits(kitCasa, kitVisitante) }
}
