import type { Rng } from '@core/rng'
import { ATRIBUTOS, type Atributos, type Posicao } from '@shared/esquemas/pacote'
import type { JogadorPartida } from '@core/partida/tipos'

/** Elencos sintéticos para os testes do motor e da IA. */

export const POSICOES_23: Posicao[] = ['GK', 'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'SB', 'SB', 'SB', 'DH', 'DH', 'DH', 'SH', 'SH', 'OH', 'OH', 'OH', 'CF', 'CF', 'CF', 'WG', 'WG']

const SECUNDARIA: Partial<Record<Posicao, Posicao>> = { CB: 'SB', SB: 'SH', DH: 'CB', SH: 'WG', OH: 'SH', CF: 'WG', WG: 'SH' }

export function atributosAleatorios(rng: Rng, media: number, desvio = 1.5): Atributos {
  return Object.fromEntries(ATRIBUTOS.map((a) => [a, Math.max(1, Math.min(20, Math.round(rng.normal(media, desvio))))])) as Atributos
}

export function elencoSintetico(prefixo: string, rng: Rng, media: number, extra: Partial<JogadorPartida> = {}): JogadorPartida[] {
  return POSICOES_23.map((posicao, i) => ({
    id: `${prefixo}${i}`,
    nome: `${prefixo} ${i}`,
    posicao,
    posicaoSecundaria: SECUNDARIA[posicao] ?? null,
    atributos: atributosAleatorios(rng, media),
    condicao: 100,
    moral: 50,
    resistencia: 10,
    idade: 26,
    camisa: i + 1,
    ...extra,
  }))
}
