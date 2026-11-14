import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { calendario } from '../../src/main/carreira/temporada'
import { COPIAS_AUTOSAVE } from '../../src/main/carreira/autosave'
import { avancar } from '../helpers/avancar'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { pacote as fixture, time } from '../fixtures/pacote'
import { escreverPacote } from '../helpers/pacote'

describe('autosave da carreira', () => {
  let base: string
  let carreiras: Carreiras
  let id: string
  let relogio: number

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'we-autosave-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    relogio = 0
    carreiras = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 5,
      agora: () => `2026-11-13T00:00:0${relogio++}Z`,
      sufixoId: () => 'a1',
    })
    id = carreiras.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'T', dificuldade: 'normal' }).id
  })

  const pasta = () => join(base, 'carreiras', id, 'autosave')

  it('carreira nova não tem autosave', () => {
    expect(carreiras.resumoAtual()?.ultimoAutosave).toBeNull()
    expect(carreiras.autosaves(id)).toEqual([])
  })

  it(`guarda só as ${COPIAS_AUTOSAVE} últimas, da mais nova para a mais antiga`, () => {
    for (let i = 0; i < COPIAS_AUTOSAVE + 2; i++) {
      avancar(carreiras.sql())
      carreiras.autosave(`jogo ${i}`)
    }
    const lista = carreiras.autosaves(id)
    expect(lista.map((a) => a.numero)).toEqual([1, 2, 3])
    expect(lista.map((a) => a.motivo)).toEqual(['jogo 4', 'jogo 3', 'jogo 2'])
    expect(existsSync(join(pasta(), 'autosave-4.sqlite'))).toBe(false)
    expect(existsSync(join(pasta(), 'autosave-novo.sqlite'))).toBe(false)
    expect(carreiras.resumoAtual()?.ultimoAutosave).toMatchObject({ numero: 1, motivo: 'jogo 4', temporada: 2026 })
  })

  it('restaurar volta a carreira para a cópia e guarda o estado de antes', () => {
    avancar(carreiras.sql())
    carreiras.autosave('primeiro')
    const passoSalvo = calendario(carreiras.sql()).passoAtual
    avancar(carreiras.sql())
    avancar(carreiras.sql())
    expect(calendario(carreiras.sql()).passoAtual).toBeGreaterThan(passoSalvo)

    const r = carreiras.restaurar(id, 1)
    expect(r.id).toBe(id)
    expect(calendario(carreiras.sql()).passoAtual).toBe(passoSalvo)
    expect(existsSync(join(pasta(), 'antes-de-restaurar.sqlite'))).toBe(true)
    // A carreira continua jogável depois de restaurar.
    avancar(carreiras.sql())
    expect(calendario(carreiras.sql()).passoAtual).toBeGreaterThan(passoSalvo)
  })

  it('restaurar um autosave que não existe dá erro e não mexe na carreira', () => {
    expect(() => carreiras.restaurar(id, 2)).toThrow(/não existe/)
    expect(carreiras.resumoAtual()?.id).toBe(id)
  })
})
