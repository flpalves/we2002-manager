import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lerPacote, salvarNoticias } from '../../src/main/pacote/leitor'
import { catalogoPadrao } from '@core/noticias/catalogoPadrao'

const lerRegras = (raiz: string) => JSON.parse(readFileSync(join(raiz, 'regras.json'), 'utf8')) as Record<string, unknown>
const nova = () => mkdtempSync(join(tmpdir(), 'we-noticias-'))

describe('salvar notícias no pacote', () => {
  it('grava o noticias.json e as regras dos eventos, mantendo o resto do regras.json', () => {
    const raiz = nova()
    writeFileSync(join(raiz, 'regras.json'), JSON.stringify({ noticias: { semana_aviso_contratos: 20 }, elenco: { goleiros_minimo: 3 } }))
    const catalogo = catalogoPadrao().slice(0, 3)
    salvarNoticias(raiz, catalogo, { fator_chance: 1.5, maximo_por_avaliacao: 2 })
    expect(lerPacote(raiz).noticias).toEqual(catalogo)
    expect(lerRegras(raiz)).toEqual({ noticias: { semana_aviso_contratos: 20, fator_chance: 1.5, maximo_por_avaliacao: 2 }, elenco: { goleiros_minimo: 3 } })
  })

  it('null apaga o noticias.json e tira as regras (volta ao padrão)', () => {
    const raiz = nova()
    salvarNoticias(raiz, catalogoPadrao(), { fator_chance: 2, maximo_por_avaliacao: null })
    salvarNoticias(raiz, null, { fator_chance: null, maximo_por_avaliacao: null })
    expect(existsSync(join(raiz, 'noticias.json'))).toBe(false)
    expect(lerRegras(raiz)).toEqual({})
  })

  it('recusa catálogo com id repetido e regras fora da faixa', () => {
    const raiz = nova()
    const [e] = catalogoPadrao()
    expect(() => salvarNoticias(raiz, [e!, e!], { fator_chance: null, maximo_por_avaliacao: null })).toThrow()
    expect(() => salvarNoticias(raiz, null, { fator_chance: -1, maximo_por_avaliacao: null })).toThrow()
    expect(() => salvarNoticias(raiz, null, { fator_chance: null, maximo_por_avaliacao: 0 })).toThrow()
  })
})
