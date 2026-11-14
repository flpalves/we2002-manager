import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { salvarTemporada } from '../../src/main/pacote/leitor'

const ler = (raiz: string, arquivo: string) => JSON.parse(readFileSync(join(raiz, arquivo), 'utf8')) as Record<string, unknown>
const blocos = [
  { competicao: 'serie-a', datas: 'fds' as const, semana_inicio: 12, semana_fim: 50 },
  { competicao: 'serie-b', datas: 'meio' as const, semana_inicio: 14, semana_fim: 48 },
]

describe('salvar temporada.json', () => {
  it('grava os blocos e a duração no regras.json mantendo as outras regras', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-temporada-'))
    writeFileSync(join(raiz, 'regras.json'), JSON.stringify({ mercado: { taxa_emprestimo: 0.2 }, temporada: { outra: 1 } }))
    salvarTemporada(raiz, { blocos }, 48)
    expect(ler(raiz, 'temporada.json')).toEqual({ blocos })
    expect(ler(raiz, 'regras.json')).toEqual({ mercado: { taxa_emprestimo: 0.2 }, temporada: { outra: 1, semanas_por_temporada: 48 } })
  })

  it('duração null volta ao padrão: tira a chave (e a seção, se ficar vazia)', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-temporada-'))
    salvarTemporada(raiz, { blocos }, 40)
    salvarTemporada(raiz, { blocos: [] }, null)
    expect(ler(raiz, 'regras.json')).toEqual({})
    expect(ler(raiz, 'temporada.json')).toEqual({ blocos: [] })
  })

  it('recusa bloco fora do formato sem gravar nada', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-temporada-'))
    expect(() => salvarTemporada(raiz, { blocos: [{ ...blocos[0]!, semana_inicio: 0 }] }, null)).toThrow()
    expect(existsSync(join(raiz, 'temporada.json'))).toBe(false)
  })
})
