import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { virarTemporada } from '../../src/main/carreira/virada'
import type { Sql } from '../../src/main/db/sql'
import { escreverPacote } from '../helpers/pacote'
import { jogarTemporada, novaCarreira, pacoteDuasDivisoes } from '../helpers/duasDivisoes'

/**
 * Golden file (01-arquitetura, "Determinismo"; aceite da fase 9): duas temporadas seguidas
 * com a semente de teste, resumidas num JSON versionado. Mudança de regra ou de motor que
 * altere o resultado faz o teste falhar; se a mudança for intencional, regrave com
 * `npx vitest run tests/main/golden.test.ts -u` e confira o diff do arquivo.
 */

const SEMENTE_DE_TESTE = 20260101

function fotografia(sql: Sql) {
  return {
    saldos: Object.fromEntries(sql.all<{ sigla: string; saldo: number }>('SELECT sigla, saldo FROM time ORDER BY sigla').map((t) => [t.sigla, t.saldo])),
    elencos: Object.fromEntries(
      sql
        .all<{ sigla: string; n: number }>("SELECT t.sigla, COUNT(j.id) n FROM time t LEFT JOIN jogador j ON j.time_id = t.id AND j.status = 'ativo' GROUP BY t.sigla ORDER BY t.sigla")
        .map((t) => [t.sigla, t.n]),
    ),
    livres: sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador WHERE status = 'livre'")!.n,
    transferencias: sql.get<{ n: number }>('SELECT COUNT(*) n FROM transferencia')!.n,
    gols: sql.get<{ n: number }>("SELECT COUNT(*) n FROM evento_partida WHERE tipo = 'gol'")!.n,
  }
}

describe('golden file: duas temporadas com a semente de teste', () => {
  it('o resumo bate com o arquivo gravado', async () => {
    const base = mkdtempSync(join(tmpdir(), 'we-golden-'))
    escreverPacote(join(base, 'pacotes', 'teste'), pacoteDuasDivisoes())
    const sql = novaCarreira(base, SEMENTE_DE_TESTE).sql()
    const temporadas = []
    for (let i = 0; i < 2; i++) {
      jogarTemporada(sql)
      const r = virarTemporada(sql)
      temporadas.push({
        temporada: r.temporada,
        campeoes: r.campeoes,
        movimentos: r.movimentos,
        artilheiros: r.artilheiros,
        usuario: { campanhas: r.campanhas, metas: r.metas, confianca: r.confianca, demitido: r.demitido, saldo: r.saldo, saidas: r.saidas.length, renovadosPelaDiretoria: r.renovadosPelaDiretoria.length },
        depois: fotografia(sql),
      })
    }
    await expect(`${JSON.stringify({ semente: SEMENTE_DE_TESTE, temporadas }, null, 2)}\n`).toMatchFileSnapshot('./__golden__/duas-temporadas.json')
  })
})
