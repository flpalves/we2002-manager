import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BANDEIRAS, bandeira, estrela, nomePais } from '../../src/renderer/bandeiras'

describe('bandeiras', () => {
  it('tem bandeira para toda nacionalidade e país do pacote brasil-2026', () => {
    const raiz = join(__dirname, '../../pacotes/brasil-2026')
    const codigos = new Set<string>()
    for (const p of JSON.parse(readFileSync(join(raiz, 'paises.json'), 'utf8')) as { codigo: string }[]) codigos.add(p.codigo)
    for (const arq of readdirSync(join(raiz, 'times'))) {
      for (const m of readFileSync(join(raiz, 'times', arq), 'utf8').matchAll(/"nacionalidade":\s*"([A-Z]{3})"/g)) codigos.add(m[1]!)
    }
    expect([...codigos].filter((c) => !bandeira(c))).toEqual([])
  })

  it('cada SVG só usa elementos simples, sem script nem atributos de evento', () => {
    for (const [codigo, b] of Object.entries(BANDEIRAS)) {
      expect(codigo).toMatch(/^[A-Z]{3}$/)
      expect(b.svg.length).toBeGreaterThan(0)
      expect(b.svg).not.toMatch(/<script|\son\w+=|href/i)
      const tags = [...b.svg.matchAll(/<(\w+)/g)].map((m) => m[1])
      expect(tags.every((t) => ['rect', 'circle', 'polygon', 'path', 'ellipse'].includes(t!))).toBe(true)
    }
  })

  it('código desconhecido não tem desenho e o nome cai na sigla', () => {
    expect(bandeira('XYZ')).toBeNull()
    expect(nomePais('XYZ')).toBe('XYZ')
    expect(nomePais('bra')).toBe('Brasil')
  })

  it('estrela tem 10 vértices', () => {
    expect(estrela(5, 5, 2, '#fff').match(/\d+\.\d+,\d+\.\d+/g)).toHaveLength(10)
  })
})
