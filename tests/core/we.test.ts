import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PADROES } from '@core/config/padroes'
import { escolherControle, vagasDoJogo, type Controle } from '@core/we/controle'
import { conflitoKits, resolverUniformes } from '@core/we/uniformes'
import { atributosParaWe, camisasParaWe, CONDICAO_PONTE, nomeParaWe, timeParaPonte, type JogadorExportar } from '@core/we/exportar'
import { aceitarParcial, conferir, desinverter, normalizarResultado, paraResultado, type LadoEscalado } from '@core/we/resultado'
import { atributos } from '../fixtures/pacote'

const fixture = (n: string) => JSON.parse(readFileSync(join(__dirname, '../fixtures/we', n), 'utf8'))
const kitsDe = (arq: string) => {
  const t = JSON.parse(readFileSync(join(__dirname, '../../data/times', arq), 'utf8'))
  return { kit: t.kit, kit_reserva: t.kit_reserva }
}

describe('escolha do controle (port do app antigo)', () => {
  const todos = new Set<Controle>(['p1_cpu', 'cpu_p1', 'p1_p2', 'cpu_cpu'])
  it('usuário em casa → P1 x CPU, sem inverter', () => {
    expect(escolherControle(false, todos, 'jogar')).toEqual({ controle: 'p1_cpu', invertido: false })
  })
  it('usuário visitante com CPU x P1 → mantém o mando real', () => {
    expect(escolherControle(true, todos, 'jogar')).toEqual({ controle: 'cpu_p1', invertido: false })
  })
  it('usuário visitante sem CPU x P1 → vai para a casa com mando invertido', () => {
    expect(escolherControle(true, new Set<Controle>(['p1_cpu']), 'jogar')).toEqual({ controle: 'p1_cpu', invertido: true })
  })
  it('assistir → CPU x CPU (se existir)', () => {
    expect(escolherControle(true, todos, 'assistir')).toEqual({ controle: 'cpu_cpu', invertido: false })
    expect(escolherControle(false, new Set<Controle>(['p1_cpu']), 'assistir')).toEqual({ controle: 'p1_cpu', invertido: false })
  })
  it('vagas do emulador seguem a inversão', () => {
    expect(vagasDoJogo('A', 'B', false)).toEqual({ vagaCasa: 'A', vagaVisitante: 'B' })
    expect(vagasDoJogo('A', 'B', true)).toEqual({ vagaCasa: 'B', vagaVisitante: 'A' })
  })
})

describe('uniformes (port de resolverUniformes)', () => {
  const kit = (camisa: string) => ({ design: { camisa } })
  it('visitante troca para o reserva quando as camisas se confundem', () => {
    const casa = { kit: kit('#C8102E'), kit_reserva: kit('#FFFFFF') }
    const fora = { kit: kit('#B0102E'), kit_reserva: kit('#FFFFFF') }
    expect(resolverUniformes(casa, fora)).toEqual({ casa: 'titular', visitante: 'reserva', conflito: false })
  })
  it('sem conflito, todos de titular; pedido explícito vale', () => {
    const casa = { kit: kit('#C8102E'), kit_reserva: kit('#FFFFFF') }
    const fora = { kit: kit('#006437'), kit_reserva: kit('#FFFFFF') }
    expect(resolverUniformes(casa, fora)).toMatchObject({ casa: 'titular', visitante: 'titular' })
    expect(resolverUniformes(casa, fora, 'reserva', 'reserva')).toMatchObject({ casa: 'reserva', visitante: 'reserva' })
  })
  it('listras contam pela média', () => {
    expect(conflitoKits({ design: { listras_verticais: { cores: ['#000000', '#FFFFFF'] } } }, kit('#808080'))).toBe(true)
  })
  it('com os kits reais: Flamengo x Internacional (dois vermelhos) → o Inter vai de reserva', () => {
    expect(resolverUniformes(kitsDe('flamengo.json'), kitsDe('internacional.json')).visitante).toBe('reserva')
  })
})

describe('saída para o WE', () => {
  it('nome ASCII de até 10 caracteres', () => {
    expect(nomeParaWe('João Gonçalves Neto')).toBe('Joao Gonca')
  })
  it('camisas 1-32 sem repetir; fora da faixa vira o maior número livre', () => {
    expect(camisasParaWe([1, 10, 99, 32, 10])).toEqual([1, 10, 31, 32, 30])
  })
  it('atributos 1-20 → 12-19 com a redução por condição e chaves da ponte', () => {
    const a = { ...atributos(20), PAS: 11, HEA: 7 }
    expect(atributosParaWe(a, 100, PADROES)).toMatchObject({ OFF: 19, PASS: 15, HEAD: 13, SHPW: 19, SHAC: 19, CRV: 19 })
    expect(atributosParaWe(a, 40, PADROES)).toMatchObject({ OFF: 18, PASS: 14 })
    expect(atributosParaWe(a, 20, PADROES)).toMatchObject({ OFF: 17, HEAD: 12 })
  })
  it('seta → condicao da ponte (5 = ótima ... 1 = péssima)', () => {
    expect(CONDICAO_PONTE).toEqual({ otima: 5, boa: 4, normal: 3, ruim: 2, pessima: 1 })
  })
  it('monta o time no formato que a ponte lê, com 23 vagas', () => {
    const jogadores: JogadorExportar[] = Array.from({ length: 23 }, (_, i) => ({
      id: String(i),
      nomeWe: `Jogador ${i}`,
      posicao: i === 0 ? 'GK' : 'CF',
      camisa: i + 1,
      altura: i === 0 ? 300 : 180,
      idade: i === 1 ? 50 : 25,
      pe: 'destro',
      outside: true,
      aparencia: i === 2 ? { pele: 3, fisico: 'G', cabelo: 'k1', cor_cabelo: 'A', barba: 'A', cor_barba: 'A', chuteira: 'A' } : null,
      atributos: atributos(10),
      condicao: i === 3 ? 25 : 100,
      moral: 60,
    }))
    const t = timeParaPonte(
      { sigla: 'FLA', nome: 'Flamengo', nomeCurto: 'Flamengo', formacao: '4-4-2A', kit: { arte: 'x.png' }, kitReserva: null, bandeira: { arquivo: 'C:/b.png', ajuste: 'esticar' }, jogadores },
      PADROES,
    )
    expect(t).toMatchObject({ nome: 'Flamengo', nome_tela: 'FLAMENGO', formacao: '4-4-2A', bandeira: 'C:/b.png', kit: { arte: 'x.png' } })
    expect(t.kit_reserva).toBeUndefined()
    expect(t.jogadores).toHaveLength(23)
    expect(t.jogadores.map((j) => j.vaga)).toEqual(Array.from({ length: 23 }, (_, i) => i))
    expect(t.jogadores[0]!.altura).toBe(211)
    expect(t.jogadores[1]!.idade).toBe(46)
    expect(t.jogadores[2]!.aparencia?.cabelo).toBe('k1')
    expect(t.jogadores[3]!.aparencia).toBeUndefined()
    expect(t.jogadores[0]!.condicao).toBe(5)
    expect(t.jogadores[3]!.condicao).toBe(1)
    expect(t.jogadores[3]!.atributos.OFF).toBe(12) // 10 → nível 2 (14) − 2 pela condição < 30
  })
  it('mais de 23 é erro', () => {
    expect(() =>
      timeParaPonte({ sigla: 'X', nome: 'X', nomeCurto: 'X', formacao: '4-4-2A', kit: null, kitReserva: null, bandeira: null, jogadores: Array(24).fill(null) }, PADROES),
    ).toThrow()
  })
})

describe('leitura do resultado.json (fixtures reais da ponte)', () => {
  it('normaliza um parcial e um final', () => {
    const p = normalizarResultado(fixture('resultado-parcial.json'))!
    expect(p).toMatchObject({ partidaId: 'cmw8g8qw0-r5j1-mwcwm02t', casaNome: 'Fluminense', visitanteNome: 'Flamengo', golsCasa: 1, golsVisitante: 5, final: false, fase: '2T' })
    expect(p.gols).toHaveLength(6)
    expect(p.gols[1]).toEqual({ lado: 'visitante', minuto: 11, vaga: 10, nome: 'Carrascal', assistVaga: 8, assistNome: 'Pedro' })
    expect(p.amarelos).toEqual({ casa: 0, visitante: 1 })
    const f = normalizarResultado(fixture('resultado-final.json'))!
    expect(f).toMatchObject({ final: true, golsCasa: 0, golsVisitante: 1, penaltis: null })
  })

  it('lixo vira null; campos ausentes não quebram', () => {
    expect(normalizarResultado('x')).toBeNull()
    expect(normalizarResultado({ partida_id: 'a', gols: [{ lado: 'casa' }] })).toMatchObject({ golsCasa: 1, golsVisitante: 0 })
  })

  it('desinverte o mando (o usuário visitante jogou na vaga da casa)', () => {
    const r = normalizarResultado(fixture('resultado-parcial.json'))!
    const d = desinverter(r, true)
    expect([d.casaNome, d.visitanteNome, d.golsCasa, d.golsVisitante]).toEqual(['Flamengo', 'Fluminense', 5, 1])
    expect(d.gols.filter((g) => g.lado === 'casa')).toHaveLength(5)
    expect(desinverter(r, false)).toBe(r)
  })

  it('confere partida_id e nomes; mata-mata empatado sem pênaltis não vale', () => {
    const r = normalizarResultado(fixture('resultado-final.json'))!
    const esperado = { partidaId: 'cmw84jj8o-r6j2-mw8fi25l', vagaCasa: 'Flamengo', vagaVisitante: 'Corinthians', precisaVencedor: false }
    expect(conferir(r, esperado)).toEqual({ ok: true })
    expect(conferir(r, { ...esperado, partidaId: 'outra' })).toMatchObject({ ok: false })
    expect(conferir(r, { ...esperado, vagaCasa: 'Palmeiras' })).toMatchObject({ ok: false })
    const empate = { ...r, golsVisitante: 0 }
    expect(conferir(empate, { ...esperado, precisaVencedor: true })).toMatchObject({ ok: false })
    expect(conferir({ ...empate, penaltis: { casa: 4, visitante: 3 } }, { ...esperado, precisaVencedor: true })).toEqual({ ok: true })
  })

  it('parcial do 2º tempo pode encerrar a partida; 1º tempo e mata-mata empatado não', () => {
    const r = normalizarResultado(fixture('resultado-parcial.json'))!
    expect(aceitarParcial(r, false)).toEqual({ ok: true })
    expect(aceitarParcial(r, true)).toEqual({ ok: true }) // 1 x 5, tem vencedor
    expect(aceitarParcial({ ...r, fase: '1T' }, false)).toMatchObject({ ok: false })
    expect(aceitarParcial({ ...r, fase: null }, false)).toMatchObject({ ok: false })
    const empate = { ...r, golsCasa: 2, golsVisitante: 2 }
    expect(aceitarParcial(empate, false)).toEqual({ ok: true })
    expect(aceitarParcial(empate, true)).toMatchObject({ ok: false })
    expect(aceitarParcial({ ...empate, fase: '1T', final: true }, true)).toEqual({ ok: true }) // já final: a conferência normal decide
  })

  it('vira um Resultado da carreira: autores pela vaga, titulares 90 minutos', () => {
    const r = normalizarResultado(fixture('resultado-parcial.json'))!
    const lado = (p: string): LadoEscalado => ({
      ids: Array.from({ length: 23 }, (_, i) => `${p}${i}`),
      posicoes: Array(23).fill('CF'),
      camisas: Array.from({ length: 23 }, (_, i) => i + 1),
      perfis: Array(23).fill({ idade: 26, resistencia: 10, fole: 10, condicao: 100 }),
    })
    const res = paraResultado(r, { casa: lado('c'), visitante: lado('v') }, PADROES)
    expect(res).toMatchObject({ golsCasa: 1, golsVisitante: 5 })
    const gols = res.detalhe!.eventos.filter((e) => e.tipo === 'gol')
    expect(gols).toHaveLength(6)
    expect(gols[0]).toMatchObject({ lado: 'casa', jogador: 'c8', assistencia: null, minuto: 5 })
    expect(gols[1]).toMatchObject({ lado: 'visitante', jogador: 'v10', assistencia: 'v8' })
    expect(res.detalhe!.participacoes).toHaveLength(22)
    expect(res.detalhe!.participacoes.every((p) => p.minutos === 90 && p.condicaoFinal < 100)).toBe(true)
    expect(res.detalhe!.naoUtilizados).toHaveLength(24)
    expect(res.cartoesVisitante).toEqual({ amarelos: 1, vermelhos: 0 })
  })
})
