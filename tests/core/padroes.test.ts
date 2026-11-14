import { describe, expect, it } from 'vitest'
import { PADROES, mesclarRegras } from '@core/config/padroes'

describe('padroes / mesclarRegras', () => {
  it('sem sobrescrita devolve uma cópia igual aos padrões', () => {
    const r = mesclarRegras(PADROES, undefined)
    expect(r).toEqual(PADROES)
    expect(r).not.toBe(PADROES)
    expect(r.competicao.pontos).not.toBe(PADROES.competicao.pontos)
  })

  it('sobrescreve só o que veio, mantendo o resto', () => {
    const r = mesclarRegras(PADROES, { competicao: { pontos: { vitoria: 2 } } })
    expect(r.competicao.pontos).toEqual({ vitoria: 2, empate: 1, derrota: 0 })
    expect(r.competicao.substituicoes).toBe(3)
    expect(r.temporada.semanas_por_temporada).toBe(52)
  })

  it('listas são substituídas inteiras', () => {
    const r = mesclarRegras(PADROES, { jogadores: { conversao_we: { limites: [3, 6, 9, 12, 14, 16, 18, 20] } } })
    expect(r.jogadores.conversao_we.limites).toEqual([3, 6, 9, 12, 14, 16, 18, 20])
  })

  it('não altera os padrões nem a sobrescrita', () => {
    const antes = structuredClone(PADROES)
    const sobre = { temporada: { semanas_por_temporada: 50 } }
    const r = mesclarRegras(PADROES, sobre)
    r.competicao.pontos.vitoria = 99
    expect(PADROES).toEqual(antes)
    expect(sobre).toEqual({ temporada: { semanas_por_temporada: 50 } })
  })

  it('ignora chaves desconhecidas', () => {
    const r = mesclarRegras(PADROES, { inexistente: 1 } as never)
    expect(r).toEqual(PADROES)
  })

  it('padrões coerentes: conversão cobre 1-20 em 8 níveis crescentes', () => {
    const { limites } = PADROES.jogadores.conversao_we
    expect(limites).toHaveLength(8)
    expect(limites.at(-1)).toBe(20)
    for (let i = 1; i < limites.length; i++) expect(limites[i]!).toBeGreaterThan(limites[i - 1]!)
  })
})

describe('mesclarRegras com mapas e tipos errados', () => {
  it('pesos_geral aceita posições vindas do pacote', () => {
    const r = mesclarRegras(PADROES, { jogadores: { pesos_geral: { GK: { DEF: 2 } } } })
    // A posição do pacote substitui a do padrão inteira; as outras ficam com o padrão.
    expect(r.jogadores.pesos_geral.GK).toEqual({ DEF: 2 })
    expect(r.jogadores.pesos_geral.CF).toEqual(PADROES.jogadores.pesos_geral.CF)
    expect(mesclarRegras(PADROES, { jogadores: { pesos_geral: { XX: { OFF: 1 } } } }).jogadores.pesos_geral.XX).toEqual({ OFF: 1 })
  })

  it('valor de tipo errado no regras.json mantém o padrão', () => {
    const r = mesclarRegras(PADROES, { temporada: { semanas_por_temporada: 'muitas' } } as never)
    expect(r.temporada.semanas_por_temporada).toBe(52)
  })
})
