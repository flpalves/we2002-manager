import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { chanceDeSaida, taxaNaVirada, viradaExterior } from '@core/mercado/exterior'

describe('exterior na virada (06, "Jogadores sem clube")', () => {
  it('taxa recalculada pela idade nova e arredondada para R$ 50 mil', () => {
    // 27 → 28: f_idade 1 → 0,85.
    expect(taxaNaVirada(3_470_000_000, 27, 28, PADROES)).toBe(2_950_000_000)
    // Mesma faixa: não muda.
    expect(taxaNaVirada(3_470_000_000, 25, 26, PADROES)).toBe(3_470_000_000)
    // Nunca abaixo do passo de arredondamento.
    expect(taxaNaVirada(1_000_000, 33, 34, PADROES)).toBe(5_000_000)
  })

  it('chance de saída dobra a partir dos 35', () => {
    expect(chanceDeSaida(34, PADROES)).toBe(0.15)
    expect(chanceDeSaida(35, PADROES)).toBe(0.3)
  })

  it('em lote: sai perto de 15% (30% dos veteranos), reproduzível pela semente', () => {
    const pool = Array.from({ length: 2000 }, (_, i) => ({ id: `ext-${i}`, idade: i % 2 ? 36 : 26, idadeAnterior: i % 2 ? 35 : 25, taxa: 100_000_000 }))
    const r = viradaExterior(pool, PADROES, criarRng(7))
    const fracao = (veterano: boolean) => {
      const grupo = r.filter((x) => (Number(x.id.slice(4)) % 2 === 1) === veterano)
      return grupo.filter((x) => x.sai).length / grupo.length
    }
    expect(fracao(false)).toBeGreaterThan(0.12)
    expect(fracao(false)).toBeLessThan(0.18)
    expect(fracao(true)).toBeGreaterThan(0.26)
    expect(fracao(true)).toBeLessThan(0.34)
    expect(viradaExterior(pool, PADROES, criarRng(7))).toEqual(r)
  })
})
