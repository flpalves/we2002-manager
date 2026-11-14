import { describe, expect, it } from 'vitest'
import { rodarLote } from '../helpers/lote'

// Aceite da fase 3: faixas de calibração de docs/spec/04-motor-partida.md.
describe('calibração do motor (lote)', () => {
  it('10.000 jogos entre times equilibrados ficam nas faixas da spec', () => {
    const m = rodarLote(10_000, 0)
    expect(m.golsPorJogo).toBeGreaterThanOrEqual(2.4)
    expect(m.golsPorJogo).toBeLessThanOrEqual(2.7)
    expect(m.empates).toBeGreaterThanOrEqual(0.24)
    expect(m.empates).toBeLessThanOrEqual(0.28)
    expect(m.vantagemMandante).toBeGreaterThanOrEqual(0.25)
    expect(m.vantagemMandante).toBeLessThanOrEqual(0.35)
    expect(m.amarelosPorJogo).toBeGreaterThanOrEqual(4)
    expect(m.amarelosPorJogo).toBeLessThanOrEqual(5)
    expect(m.vermelhosPorJogo).toBeGreaterThanOrEqual(0.1)
    expect(m.vermelhosPorJogo).toBeLessThanOrEqual(0.2)
    expect(m.lesoesPorJogo).toBeGreaterThanOrEqual(0.15)
    expect(m.lesoesPorJogo).toBeLessThanOrEqual(0.35)
  }, 120_000)

  it('time 2 níveis de geral acima vence entre 55% e 65% (mando alternado)', () => {
    const m = rodarLote(4_000, 2)
    expect(m.vitoriasDoMaisForte).toBeGreaterThanOrEqual(0.55)
    expect(m.vitoriasDoMaisForte).toBeLessThanOrEqual(0.65)
  }, 120_000)
})
