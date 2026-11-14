import { describe, expect, it } from 'vitest'
import { contraste, corSobreClube, hexParaRgb } from '@renderer/cores'

describe('cores', () => {
  it('lê hex curto e longo', () => {
    expect(hexParaRgb('#fff')).toEqual([255, 255, 255])
    expect(hexParaRgb('C8102E')).toEqual([200, 16, 46])
    expect(() => hexParaRgb('vermelho')).toThrow()
  })

  it('contraste branco x preto é 21:1', () => {
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 5)
  })

  it('texto branco em cor escura, quase preto em cor clara', () => {
    expect(corSobreClube('#C8102E')).toBe('#ffffff') // Flamengo
    expect(corSobreClube('#006437')).toBe('#ffffff') // Palmeiras
    expect(corSobreClube('#F5C400')).toBe('#111111') // Mirassol
    expect(corSobreClube('#ffffff')).toBe('#111111')
  })
})
