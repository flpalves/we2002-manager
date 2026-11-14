import { expect } from 'vitest'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { calendario } from '../../src/main/carreira/temporada'
import type { Sql } from '../../src/main/db/sql'
import { avancar } from './avancar'
import { abrirNodeSqlite } from './sqlite'
import { jogador, pacote as fixture, time } from '../fixtures/pacote'
import type { Competicao } from '@shared/esquemas/pacote'

/** Pacote e carreira de duas divisões, usados pelos testes da virada e pelo golden file. */

const FASE: Competicao['fases'] = [{ id: 'f1', nome: 'Turno e returno', formato: 'pontos_corridos', pontos_corridos: { turnos: 2 } }]

/** Duas divisões de 4: os 2 últimos da A caem, os 2 primeiros da B sobem. O usuário (AAA) tem 25 jogadores. */
export function pacoteDuasDivisoes() {
  const a = ['AAA', 'BBB', 'CCC', 'DDD']
  const b = ['EEE', 'FFF', 'GGG', 'HHH']
  const times = [...a, ...b].map((s) => (s === 'AAA' ? time(s, { jogadores: Array.from({ length: 25 }, (_, i) => jogador(s, i + 1)) }) : time(s)))
  return fixture({
    times,
    temporada: {
      blocos: [
        { competicao: 'a', datas: 'fds', semana_inicio: 10, semana_fim: 40 },
        { competicao: 'b', datas: 'fds', semana_inicio: 10, semana_fim: 40 },
      ],
    },
    competicoes: [
      { id: 'a', nome: 'Série A', tipo: 'nacional', participantes: { regra: 'lista', times: a }, fases: FASE, saidas: [{ posicoes: '3-4', destino: 'b', tipo: 'rebaixamento' }] },
      { id: 'b', nome: 'Série B', tipo: 'nacional', participantes: { regra: 'lista', times: b }, fases: FASE, saidas: [{ posicoes: '1-2', destino: 'a', tipo: 'acesso' }] },
    ],
  })
}

export function jogarTemporada(sql: Sql): void {
  for (let i = 0; i < 50 && !calendario(sql).encerrada; i++) avancar(sql)
  expect(calendario(sql).encerrada).toBe(true)
}

export function novaCarreira(base: string, semente = 99): Carreiras {
  let n = 0
  const c = new Carreiras({
    pastaCarreiras: () => join(base, 'carreiras'),
    pastaPacotes: () => join(base, 'pacotes'),
    abrirBanco: abrirNodeSqlite,
    lerResumoArquivo: () => null,
    sementeNova: () => semente,
    agora: () => '2026-11-12T00:00:00Z',
    sufixoId: () => `t${++n}`,
  })
  c.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'T', dificuldade: 'facil' })
  return c
}

