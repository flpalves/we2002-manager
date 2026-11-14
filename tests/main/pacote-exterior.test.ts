import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lerPacote } from '../../src/main/pacote/leitor'
import { PADROES } from '@core/config/padroes'
import { validarPacote } from '@core/pacote/validar'
import { exterior, livre, pacote } from '../fixtures/pacote'
import { escreverPacote } from '../helpers/pacote'

describe('pacote: exterior.json e livres.json', () => {
  it('lê os dois arquivos quando existem e deixa ausentes como null', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-exterior-'))
    const ext = { temporada: 2026, jogadores: [exterior(1), exterior(2)] }
    const liv = { jogadores: [livre(1)] }
    escreverPacote(raiz, pacote({ exterior: ext, livres: liv }))
    const lido = lerPacote(raiz)
    expect(lido.invalidos).toEqual([])
    expect(lido.exterior).toEqual(ext)
    expect(lido.livres).toEqual(liv)

    const vazio = mkdtempSync(join(tmpdir(), 'we-exterior-'))
    escreverPacote(vazio, pacote())
    expect(lerPacote(vazio)).toMatchObject({ exterior: null, livres: null })
  })

  it('jogador sem clube com camisa ou contrato não passa no esquema', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-exterior-'))
    escreverPacote(raiz, pacote({ exterior: { temporada: 2026, jogadores: [{ ...exterior(1), origem: { clube: 'X', pais: 'rus' } }] } }))
    expect(lerPacote(raiz).invalidos.map((i) => i.arquivo)).toEqual(['exterior.json'])
  })

  it('o exterior.json do pacote brasil-2026 traz os 200 sem erro', () => {
    const p = lerPacote(join(__dirname, '../../pacotes/brasil-2026'))
    expect(p.invalidos.filter((i) => i.arquivo === 'exterior.json')).toEqual([])
    expect(p.exterior?.jogadores).toHaveLength(200)
    const erros = validarPacote(p, PADROES).filter((x) => x.nivel === 'erro' && x.arquivo === 'exterior.json')
    expect(erros).toEqual([])
  })
})
