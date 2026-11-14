import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { salvarJanelas } from '../../src/main/pacote/leitor'

const ler = (raiz: string) => JSON.parse(readFileSync(join(raiz, 'regras.json'), 'utf8')) as Record<string, unknown>

describe('salvar janelas no regras.json', () => {
  it('grava mercado.janelas mantendo as outras regras', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-janelas-'))
    writeFileSync(join(raiz, 'regras.json'), JSON.stringify({ elenco: { goleiros_minimo: 3 }, mercado: { taxa_emprestimo: 0.2 } }))
    salvarJanelas(raiz, [{ semana_inicio: 2, semana_fim: 8, nome: 'Abertura' }])
    expect(ler(raiz)).toEqual({ elenco: { goleiros_minimo: 3 }, mercado: { taxa_emprestimo: 0.2, janelas: [{ semana_inicio: 2, semana_fim: 8, nome: 'Abertura' }] } })
  })

  it('null volta ao padrão: tira a chave (e o mercado, se ficar vazio)', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-janelas-'))
    salvarJanelas(raiz, [{ semana_inicio: 2, semana_fim: 8 }])
    salvarJanelas(raiz, null)
    expect(ler(raiz)).toEqual({})
  })

  it('recusa janela fora do formato', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-janelas-'))
    expect(() => salvarJanelas(raiz, [{ semana_inicio: 0, semana_fim: 8 }])).toThrow()
  })
})
