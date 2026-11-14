import { describe, expect, it } from 'vitest'
import { Disciplinas, SUSPENSAO_PADRAO } from '@core/competicoes/suspensoes'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import type { Competicao } from '@shared/esquemas/pacote'
import { gerarTemporada, jogarPasso, temporadaEncerrada } from '@core/competicoes/temporada'
import { criarSimuladorProvisorio } from '@core/partida/provisorio'

const elenco = ['j1', 'j2', 'j3']

describe('suspensões por competição', () => {
  it('3 amarelos = 1 jogo de suspensão, cumprido no jogo seguinte do time', () => {
    const d = new Disciplinas()
    d.registrarPartida('liga', elenco, [{ jogador: 'j1', tipo: 'amarelo' }], SUSPENSAO_PADRAO)
    d.registrarPartida('liga', elenco, [{ jogador: 'j1', tipo: 'amarelo' }], SUSPENSAO_PADRAO)
    expect(d.estaSuspenso('j1', 'liga')).toBe(false)
    d.registrarPartida('liga', elenco, [{ jogador: 'j1', tipo: 'amarelo' }], SUSPENSAO_PADRAO)
    expect(d.get('j1', 'liga')).toMatchObject({ amarelos: 0, suspenso: 1 })
    d.registrarPartida('liga', elenco, [], SUSPENSAO_PADRAO)
    expect(d.estaSuspenso('j1', 'liga')).toBe(false)
  })

  it('vermelho suspende pelos jogos da regra', () => {
    const d = new Disciplinas()
    d.registrarPartida('liga', elenco, [{ jogador: 'j2', tipo: 'vermelho' }], { ...SUSPENSAO_PADRAO, vermelho_jogos: 2 })
    d.registrarPartida('liga', elenco, [], SUSPENSAO_PADRAO)
    expect(d.estaSuspenso('j2', 'liga')).toBe(true)
    d.registrarPartida('liga', elenco, [], SUSPENSAO_PADRAO)
    expect(d.estaSuspenso('j2', 'liga')).toBe(false)
  })

  it('a contagem é separada por competição', () => {
    const d = new Disciplinas()
    d.registrarPartida('liga', elenco, [{ jogador: 'j1', tipo: 'vermelho' }], SUSPENSAO_PADRAO)
    expect(d.estaSuspenso('j1', 'liga')).toBe(true)
    expect(d.estaSuspenso('j1', 'copa')).toBe(false)
    // jogo da copa não cumpre a suspensão da liga
    d.registrarPartida('copa', elenco, [], SUSPENSAO_PADRAO)
    expect(d.estaSuspenso('j1', 'liga')).toBe(true)
  })

  it('zera os amarelos ao começar a fase configurada', () => {
    const d = new Disciplinas()
    d.registrarPartida('copa', elenco, [{ jogador: 'j3', tipo: 'amarelo' }, { jogador: 'j1', tipo: 'amarelo' }], SUSPENSAO_PADRAO)
    const regra = { ...SUSPENSAO_PADRAO, zera_na_fase: 'mm' }
    d.iniciarFase('copa', 'grupos', regra)
    expect(d.get('j3', 'copa').amarelos).toBe(1)
    d.iniciarFase('copa', 'mm', regra)
    expect(d.get('j3', 'copa').amarelos).toBe(0)
    expect(d.todas()).toEqual([])
  })

  it('restaura do que foi gravado', () => {
    const d = new Disciplinas([{ jogador: 'j1', competicao: 'liga', amarelos: 2, suspenso: 0 }])
    d.registrarPartida('liga', elenco, [{ jogador: 'j1', tipo: 'amarelo' }], SUSPENSAO_PADRAO)
    expect(d.estaSuspenso('j1', 'liga')).toBe(true)
  })
})

describe('pontos corridos com classificação para o mata-mata', () => {
  it('os 4 primeiros vão às semifinais (1º x 4º, 2º x 3º) e sai um campeão', () => {
    const times = ['A', 'B', 'C', 'D', 'E', 'F']
    const c: Competicao = {
      id: 'est',
      nome: 'Estadual',
      tipo: 'estadual',
      participantes: { regra: 'lista', times },
      fases: [
        { id: 'liga', nome: 'Turno', formato: 'pontos_corridos', pontos_corridos: { turnos: 1, classificam: 4 }, classificam_para: 'semi' },
        { id: 'semi', nome: 'Finais', formato: 'mata_mata', mata_mata: { jogos: 2, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'pior_campanha' } },
      ],
    }
    const estado = gerarTemporada({ temporada: 2026, competicoes: [c], participantes: { est: times }, blocos: [], regras: PADROES, rng: criarRng(3) })
    expect(estado.reservadas).toHaveLength(4) // semi ida/volta + final ida/volta
    const ctx = { competicoes: new Map([[c.id, c]]), regras: PADROES, rng: criarRng(3) }
    const simular = criarSimuladorProvisorio(() => 10, 3)
    while (!temporadaEncerrada(estado)) jogarPasso(estado, simular, ctx)
    const e = estado.edicoes[0]!
    const [liga, mm] = e.fases
    const top4 = liga!.classificados!.slice(0, 4)
    expect(mm!.participantes).toEqual(top4)
    const semis = estado.partidas.filter((p) => p.fase === 'semi' && p.rodada === 0 && p.jogo === 1)
    // pior campanha manda o 1º jogo
    expect(semis.map((p) => [p.casa, p.visitante])).toEqual([
      [top4[3], top4[0]],
      [top4[2], top4[1]],
    ])
    expect(e.campeao).not.toBeNull()
    expect(e.classificacaoFinal).toHaveLength(6)
  })
})
