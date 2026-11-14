import { beforeEach, describe, expect, it } from 'vitest'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { continuarAtePreJogo as continuar, jogarUsuario as jogarDataDoUsuario } from '../helpers/avancar'
import { ambiente, confirmar, preJogo, preparar, resultadoManual, status, type ConfigPonte } from '../../src/main/we/ponte'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { escreverPacote } from '../helpers/pacote'
import { pacote as fixture, time } from '../fixtures/pacote'

const RAIZ_REAL = join(__dirname, '../..')

describe('ponte com o WE (sem emulador)', () => {
  let carreiras: Carreiras
  let cfg: ConfigPonte
  let raiz: string

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'we-ponte-'))
    raiz = join(base, 'projeto')
    mkdirSync(join(raiz, 'data'), { recursive: true })
    mkdirSync(join(raiz, 'states'), { recursive: true })
    copyFileSync(join(RAIZ_REAL, 'data', 'partida.modelo.json'), join(raiz, 'data', 'partida.modelo.json'))
    writeFileSync(join(raiz, 'run-pcsx.bat'), '@echo off\n')
    for (const s of ['amistoso.sstate', 'base_cpu_p1.sstate', 'base_cpu_cpu.sstate']) writeFileSync(join(raiz, 'states', s), '')
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    carreiras = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 31,
      agora: () => '2026-11-13T00:00:00Z',
      sufixoId: () => 'w1',
    })
    const r = carreiras.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'W', dificuldade: 'normal' })
    cfg = {
      raiz,
      caminhos: { emulador: join(raiz, 'nao-existe.exe'), imagem: join(raiz, 'we2002.cue'), estados: join(raiz, 'states') },
      pastaCarreira: join(base, 'carreiras', r.id),
      carreiraId: r.id,
    }
  })

  /** Avança até um jogo do AAA como visitante (ou mandante). */
  function irAteJogo(comoVisitante: boolean) {
    for (let i = 0; i < 20; i++) {
      const r = continuar(carreiras.sql())
      if (r.preJogo && (r.preJogo.visitante === 'AAA') === comoVisitante) return r.preJogo
      jogarDataDoUsuario(carreiras.sql())
    }
    throw new Error('não achei o jogo')
  }

  const escreverResultado = (r: unknown) => writeFileSync(join(raiz, 'data', 'resultado.json'), JSON.stringify(r))

  it('ambiente: acha a ponte e os estados base', () => {
    const a = ambiente(cfg)
    expect(a).toMatchObject({ bat: true, emulador: false })
    expect(a.estados.sort()).toEqual(['cpu_cpu', 'cpu_p1', 'p1_cpu'])
  })

  it('pré-jogo: dois times escalados, controle e decisão', () => {
    const jogo = irAteJogo(true)
    const p = preJogo(carreiras.sql(), cfg)
    expect(p.jogo.id).toBe(jogo.id)
    expect(p.casa.titulares).toHaveLength(11)
    expect(p.visitante.reservas).toHaveLength(12)
    expect(p.controle).toBe('cpu_p1')
    expect(p.invertido).toBe(false)
    expect(p.decisao).toMatch(/Empate vale/)
  })

  it('gera os arquivos que a ponte lê (partida.json v2 + times no formato antigo)', () => {
    irAteJogo(false)
    writeFileSync(join(raiz, 'data', 'resultado.json'), '{"velho": true}')
    const pend = preparar(carreiras.sql(), cfg, 'jogar')
    const partida = JSON.parse(readFileSync(join(raiz, 'data', 'partida.json'), 'utf8'))
    expect(partida).toMatchObject({ versao: 2, partida_id: pend.partidaWe, modo: 'pontos_corridos', controle: 'p1_cpu', edicoes: [] })
    expect(partida.casa).toMatchObject({ id_we: 41, time: 'data/gerado/casa.json', nome: 'Time AAA' })
    expect(partida.visitante).toMatchObject({ id_we: 8, time: 'data/gerado/visitante.json' })
    expect(partida.kits.casa.pagina).toBe('kits/brasil_pagina.bin')
    expect(pend.partidaWe).toMatch(/^[\w-]+$/)
    const casa = JSON.parse(readFileSync(join(raiz, 'data', 'gerado', 'casa.json'), 'utf8'))
    expect(casa.jogadores).toHaveLength(23)
    expect(casa.jogadores[0]).toMatchObject({ vaga: 0, posicao: 'GK', condicao: 5 })
    expect(Object.keys(casa.jogadores[0].atributos).sort()).toEqual(
      ['ACC', 'AGR', 'BAL', 'CRV', 'DEF', 'DRI', 'HEAD', 'JMP', 'OFF', 'PASS', 'RES', 'SHAC', 'SHPW', 'SPD', 'STA', 'TEC'].sort(),
    )
    expect(casa.jogadores[0].atributos.OFF).toBe(14) // 10 → nível 2 → 14
    // resultado.json da partida anterior sai do caminho
    expect(existsSync(join(raiz, 'data', 'resultado.json'))).toBe(false)
    expect(status(carreiras.sql(), cfg).estado).toBe('aguardando')
  })

  it('usuário visitante sem o estado CPU x P1: vai para a vaga da casa e o resultado é desinvertido', () => {
    rmSync(join(raiz, 'states', 'base_cpu_p1.sstate'))
    const jogo = irAteJogo(true)
    const pend = preparar(carreiras.sql(), cfg, 'jogar')
    expect(pend).toMatchObject({ controle: 'p1_cpu', invertido: true })
    const partida = JSON.parse(readFileSync(join(raiz, 'data', 'partida.json'), 'utf8'))
    expect(partida.casa.nome).toBe('Time AAA')
    expect(partida.visitante.nome).toBe(`Time ${jogo.casa}`)

    // Na vaga da casa (AAA) dois gols do jogador da vaga 9; na do visitante, um da vaga 10.
    const base = { partida_id: pend.partidaWe, modo: 'pontos_corridos', casa: { nome: 'Time AAA', gols: 2 }, visitante: { nome: `Time ${jogo.casa}`, gols: 1 } }
    const gols = [
      { lado: 'casa', minuto: 10, vaga: 9, assist_vaga: 7 },
      { lado: 'visitante', minuto: 50, vaga: 10, assist_vaga: null },
      { lado: 'casa', minuto: 80, vaga: 9, assist_vaga: null },
    ]
    escreverResultado({ ...base, final: false, fase: '2T', gols: gols.slice(0, 2), casa: { nome: 'Time AAA', gols: 1 } })
    const parcial = status(carreiras.sql(), cfg)
    expect(parcial.estado).toBe('parcial')
    // mando real: o AAA é o visitante
    expect(parcial.placar).toMatchObject({ golsCasa: 1, golsVisitante: 1 })

    escreverResultado({ ...base, final: true, gols })
    const fim = status(carreiras.sql(), cfg)
    expect(fim.estado).toBe('final')
    expect(fim.placar).toMatchObject({ golsCasa: 1, golsVisitante: 2 })
    expect(fim.gols.filter((g) => g.lado === 'visitante')).toHaveLength(2)

    const r = confirmar(carreiras.sql(), cfg)
    expect(r.jogoDoUsuario?.placar).toMatchObject({ golsCasa: 1, golsVisitante: 2 })
    const sql = carreiras.sql()
    expect(sql.get<{ modo: string; origem: string }>('SELECT modo, origem FROM partida WHERE id = ?', jogo.id)).toEqual({ modo: 'we', origem: 'resultado.json' })
    const autores = sql.all<{ time: string; n: number }>("SELECT time, COUNT(*) n FROM evento_partida WHERE partida_id = ? AND tipo = 'gol' GROUP BY time ORDER BY time", jogo.id)
    expect(autores).toEqual(expect.arrayContaining([{ time: 'AAA', n: 2 }]))
    expect(sql.get<{ n: number }>("SELECT COUNT(DISTINCT jogador_id) n FROM evento_partida WHERE partida_id = ? AND tipo = 'gol' AND time = 'AAA'", jogo.id)!.n).toBe(1)
    expect(existsSync(join(cfg.pastaCarreira, 'resultados', `${pend.partidaWe}.json`))).toBe(true)
    expect(status(carreiras.sql(), cfg).estado).toBe('sem_partida')
  })

  it('resultado de outra partida ou com nomes trocados não vale', () => {
    irAteJogo(false)
    const pend = preparar(carreiras.sql(), cfg, 'jogar')
    escreverResultado({ partida_id: 'outra', final: true, casa: { gols: 1 }, visitante: { gols: 0 } })
    expect(status(carreiras.sql(), cfg)).toMatchObject({ estado: 'aguardando', motivo: expect.stringMatching(/outra partida/) })
    escreverResultado({ partida_id: pend.partidaWe, final: true, casa: { nome: 'Fulano', gols: 1 }, visitante: { nome: 'Beltrano', gols: 0 } })
    expect(status(carreiras.sql(), cfg).estado).toBe('invalido')
    expect(() => confirmar(carreiras.sql(), cfg)).toThrow()
  })

  it('placar digitado entra como manual', () => {
    const jogo = irAteJogo(false)
    preparar(carreiras.sql(), cfg, 'jogar')
    const r = resultadoManual(carreiras.sql(), cfg, { golsCasa: 2, golsVisitante: 2, penaltisCasa: null, penaltisVisitante: null })
    expect(r.jogoDoUsuario?.placar).toMatchObject({ golsCasa: 2, golsVisitante: 2 })
    expect(carreiras.sql().get<{ modo: string }>('SELECT modo FROM partida WHERE id = ?', jogo.id)!.modo).toBe('manual')
    expect(status(carreiras.sql(), cfg).estado).toBe('sem_partida')
  })
})

describe('pré-jogo usa a condição do dia do jogo', () => {
  it('quem jogou na data anterior aparece recuperado (como vai estar no jogo)', async () => {
    const { mkdtempSync: tmp } = await import('node:fs')
    const base = tmp(join(tmpdir(), 'we-ponte2-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    const c = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 5,
      agora: () => '2026-11-13T00:00:00Z',
      sufixoId: () => 'c1',
    })
    const r = c.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'C', dificuldade: 'normal' })
    const cfg2: ConfigPonte = { raiz: base, caminhos: { emulador: 'x', imagem: 'y', estados: 'z' }, pastaCarreira: join(base, 'carreiras', r.id), carreiraId: r.id }
    continuar(c.sql())
    jogarDataDoUsuario(c.sql())
    continuar(c.sql())
    // Entre as datas da liga (fins de semana) passam 7 dias: 7 × 7 = 49 de recuperação.
    const p = preJogo(c.sql(), cfg2)
    expect(Math.min(...p.casa.titulares.map((j) => j.condicao))).toBeGreaterThan(95)
  })
})
