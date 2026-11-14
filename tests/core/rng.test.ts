import { describe, expect, it } from 'vitest'
import { criarRng, hash32, normalizarSemente, restaurarRng } from '@core/rng'

const amostra = (semente: number | string, n = 5) => {
  const r = criarRng(semente)
  return Array.from({ length: n }, () => r.proximo())
}

describe('rng', () => {
  it('mesma semente gera a mesma sequência', () => {
    expect(amostra(42, 100)).toEqual(amostra(42, 100))
    expect(amostra('carreira-x', 100)).toEqual(amostra('carreira-x', 100))
  })

  it('sementes diferentes geram sequências diferentes', () => {
    expect(amostra(1)).not.toEqual(amostra(2))
  })

  it('trava o algoritmo (golden): mudar isso quebra carreiras salvas', () => {
    const r = criarRng(20260101)
    const valores = Array.from({ length: 4 }, () => r.inteiro(0, 1_000_000))
    expect(valores).toMatchSnapshot()
    expect(hash32('partida')).toMatchSnapshot()
  })

  it('proximo() fica em [0, 1)', () => {
    const r = criarRng(7)
    for (let i = 0; i < 10_000; i++) {
      const x = r.proximo()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('inteiro() cobre o intervalo inteiro, inclusive as pontas, sem viés grosseiro', () => {
    const r = criarRng(99)
    const contagem = new Array(6).fill(0)
    const n = 60_000
    for (let i = 0; i < n; i++) contagem[r.inteiro(1, 6) - 1]++
    for (const c of contagem) {
      expect(c / n).toBeGreaterThan(1 / 6 - 0.01)
      expect(c / n).toBeLessThan(1 / 6 + 0.01)
    }
  })

  it('inteiro() rejeita intervalo inválido', () => {
    const r = criarRng(1)
    expect(() => r.inteiro(5, 1)).toThrow()
    expect(() => r.inteiro(0.5, 2)).toThrow()
  })

  it('chance() respeita a probabilidade e os extremos', () => {
    const r = criarRng(3)
    let sim = 0
    for (let i = 0; i < 20_000; i++) if (r.chance(0.3)) sim++
    expect(sim / 20_000).toBeGreaterThan(0.28)
    expect(sim / 20_000).toBeLessThan(0.32)
    expect(r.chance(0)).toBe(false)
    expect(r.chance(1)).toBe(true)
  })

  it('escolherPeso() segue os pesos e nunca escolhe peso zero', () => {
    const r = criarRng(11)
    const contagem = [0, 0, 0]
    for (let i = 0; i < 30_000; i++) contagem[r.escolherPeso([1, 0, 3])]!++
    expect(contagem[1]).toBe(0)
    expect(contagem[2]! / contagem[0]!).toBeGreaterThan(2.7)
    expect(contagem[2]! / contagem[0]!).toBeLessThan(3.3)
    expect(() => r.escolherPeso([0, 0])).toThrow()
  })

  it('embaralhar() é uma permutação e não altera a lista original', () => {
    const r = criarRng(5)
    const lista = [1, 2, 3, 4, 5, 6, 7, 8]
    const e = r.embaralhar(lista)
    expect(lista).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...e].sort((a, b) => a - b)).toEqual(lista)
  })

  it('normal() tem média e desvio próximos do pedido', () => {
    const r = criarRng(13)
    const n = 20_000
    const xs = Array.from({ length: n }, () => r.normal(10, 2))
    const media = xs.reduce((a, b) => a + b, 0) / n
    const dp = Math.sqrt(xs.reduce((a, b) => a + (b - media) ** 2, 0) / n)
    expect(media).toBeGreaterThan(9.95)
    expect(media).toBeLessThan(10.05)
    expect(dp).toBeGreaterThan(1.95)
    expect(dp).toBeLessThan(2.05)
  })

  describe('derivar', () => {
    it('não depende de quanto o gerador pai já sorteou', () => {
      const a = criarRng(42)
      const b = criarRng(42)
      for (let i = 0; i < 37; i++) b.proximo()
      expect(a.derivar('partida', 10).proximo()).toBe(b.derivar('partida', 10).proximo())
    })

    it('não consome números do gerador pai', () => {
      const a = criarRng(42)
      const b = criarRng(42)
      a.derivar('mercado', 3).proximo()
      expect(a.proximo()).toBe(b.proximo())
    })

    it('contextos diferentes dão sequências diferentes', () => {
      const r = criarRng(42)
      const x = r.derivar('partida', 1).proximo()
      expect(r.derivar('partida', 2).proximo()).not.toBe(x)
      expect(r.derivar('mercado', 1).proximo()).not.toBe(x)
      // número e texto não se confundem
      expect(r.derivar('partida', '1').proximo()).not.toBe(x)
    })

    it('a ordem das partes importa e derivações encadeadas equivalem às diretas', () => {
      const r = criarRng(42)
      expect(r.derivar('a', 'b').proximo()).not.toBe(r.derivar('b', 'a').proximo())
      expect(r.derivar('a').derivar('b').proximo()).toBe(r.derivar('a', 'b').proximo())
    })

    it('exige ao menos um contexto', () => {
      expect(() => criarRng(1).derivar()).toThrow()
    })
  })

  it('estado()/restaurarRng() continuam a sequência do ponto salvo', () => {
    const r = criarRng(8)
    r.proximo()
    r.proximo()
    const salvo = r.estado()
    const esperado = [r.proximo(), r.proximo()]
    const r2 = restaurarRng(salvo)
    expect([r2.proximo(), r2.proximo()]).toEqual(esperado)
    expect(r2.raiz).toBe(r.raiz)
  })

  it('normalizarSemente aceita números grandes e textos', () => {
    expect(normalizarSemente(2 ** 40 + 5)).not.toBe(normalizarSemente(5))
    expect(normalizarSemente('abc')).toBe(normalizarSemente('abc'))
    expect(() => normalizarSemente(Number.NaN)).toThrow()
  })
})
