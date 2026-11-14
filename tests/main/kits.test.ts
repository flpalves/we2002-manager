import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { desenharKit } from '@core/we/desenharKit'
import { TimeSchema } from '@shared/esquemas/pacote'
import { codificarPng, decodificarPng } from '../../src/main/png'
import { caminhoArte, gerarKit, lerBaseKit } from '../../src/main/pacote/kits'
import { gravarJson } from '../../src/main/pacote/leitor'
import { time } from '../fixtures/pacote'

const KITS = resolve('kits')
const pastas: string[] = []
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true })
})

describe('png do main', () => {
  it('codifica e decodifica de volta (e o pngjs lê igual)', () => {
    const dados = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) % 256)
    const arq = codificarPng({ largura: 3, altura: 2, dados })
    expect(decodificarPng(arq)).toEqual({ largura: 3, altura: 2, dados })
    expect(new Uint8Array(PNG.sync.read(arq).data)).toEqual(dados)
  })

  it('lê o kit base real igual ao pngjs (filtros do PNG)', () => {
    const arq = readFileSync(join(KITS, 'brasil_original.png'))
    expect(decodificarPng(arq).dados).toEqual(new Uint8Array(PNG.sync.read(arq).data))
  })

  it('recusa o que não é PNG', () => {
    expect(() => decodificarPng(Buffer.from('nada'))).toThrow(/PNG/)
  })
})

describe('gerarKit', () => {
  it('grava a arte 4x no pacote e atualiza o time sem mexer no resto', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-kit-'))
    pastas.push(raiz)
    const t = time('VAS', { kit_reserva: { arte: 'kits/desenhos/manual.png', cor_numero: '#000000' } })
    gravarJson(join(raiz, 'times', 'VAS.json'), t)
    const base = lerBaseKit(KITS)!
    const design = { camisa: '#F2F2F2', detalhe: '#151515', calcao: '#151515', meiao: '#F2F2F2', faixa_diagonal: { cor: '#151515' } }

    const arte = gerarKit(raiz, base, 'VAS', 'kit', design, '#151515')
    expect(arte).toBe('kits/desenhos/vas_4x.png')
    const png = PNG.sync.read(readFileSync(join(raiz, arte)))
    expect([png.width, png.height]).toEqual([512, 1024])
    expect(new Uint8Array(png.data)).toEqual(new Uint8Array(desenharKit(base, design, 4)))

    const salvo = TimeSchema.parse(JSON.parse(readFileSync(join(raiz, 'times', 'VAS.json'), 'utf8')))
    expect(salvo.kit).toEqual({ arte, cor_numero: '#151515', design })
    expect(salvo.kit_reserva).toEqual(t.kit_reserva)
    expect(salvo.jogadores).toEqual(t.jogadores)
  })

  it('recusa design inválido e time inexistente', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'we-kit-'))
    pastas.push(raiz)
    const base = lerBaseKit(KITS)!
    expect(() => gerarKit(raiz, base, 'XXX', 'kit', { camisa: '#000000' }, '#FFFFFF')).toThrow(/não existe/)
    expect(() => gerarKit(raiz, base, 'XXX', 'kit', { camisa: 'preto' }, '#FFFFFF')).toThrow(/inválido/)
  })

  it('caminho da arte segue o padrão dos kits gerados', () => {
    expect(caminhoArte('FLA', 'kit_reserva')).toBe('kits/desenhos/fla_reserva_4x.png')
    expect(caminhoArte('FLA', 'kit_goleiro')).toBe('kits/desenhos/fla_goleiro_4x.png')
  })
})
