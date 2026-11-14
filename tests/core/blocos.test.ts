import { describe, expect, it } from 'vitest'
import { datasDoBloco, SEMANAS_MAXIMO, SEMANAS_MINIMO, validarBlocos } from '@core/competicoes/blocos'
import type { Bloco } from '@core/competicoes/calendario'

const competicoes = [
  { id: 'serie-a', nome: 'Série A' },
  { id: 'serie-b', nome: 'Série B' },
]
const bloco = (competicao: string, semana_inicio = 12, semana_fim = 50, datas: Bloco['datas'] = 'fds'): Bloco => ({ competicao, datas, semana_inicio, semana_fim })
const codigos = (blocos: Bloco[], semanas = 52) => validarBlocos(blocos, competicoes, semanas).map((p) => `${p.nivel}:${p.codigo}`)

describe('blocos do temporada.json', () => {
  it('um bloco válido por competição não gera problema', () => {
    expect(codigos([bloco('serie-a'), bloco('serie-b', 14, 50, 'meio')])).toEqual([])
  })

  it('competição sem bloco é aviso, apontando a competição', () => {
    const p = validarBlocos([bloco('serie-a')], competicoes, 52)
    expect(p).toEqual([expect.objectContaining({ nivel: 'aviso', codigo: 'sem_bloco', competicao: 'serie-b' })])
    expect(p[0]!.mensagem).toContain('Série B')
  })

  it('competição inexistente é erro', () => {
    expect(codigos([bloco('serie-a'), bloco('serie-b'), bloco('xyz')])).toEqual(['erro:bloco_invalido'])
  })

  it('competição repetida é erro (o calendário só usa a primeira)', () => {
    expect(codigos([bloco('serie-a'), bloco('serie-b'), bloco('serie-a', 1, 5)])).toEqual(['erro:bloco_repetido'])
  })

  it('semanas invertidas, fora da temporada ou não inteiras são erro', () => {
    expect(codigos([bloco('serie-a', 30, 20), bloco('serie-b')])).toEqual(['erro:bloco_invalido'])
    expect(codigos([bloco('serie-a', 0, 20), bloco('serie-b')])).toEqual(['erro:bloco_invalido'])
    expect(codigos([bloco('serie-a', 10, 53), bloco('serie-b')])).toEqual(['erro:bloco_invalido'])
    expect(codigos([bloco('serie-a', 10, 40), bloco('serie-b', 12, 30)], 38)).toEqual(['erro:bloco_invalido'])
    expect(codigos([bloco('serie-a', 1.5, 20), bloco('serie-b')])).toEqual(['erro:bloco_invalido'])
  })

  it('duração da temporada fora dos limites é erro', () => {
    expect(codigos([bloco('serie-a', 1, 5), bloco('serie-b', 1, 5)], SEMANAS_MINIMO - 1)).toEqual(['erro:semanas_invalidas'])
    expect(codigos([bloco('serie-a'), bloco('serie-b')], SEMANAS_MAXIMO + 1)).toEqual(['erro:semanas_invalidas'])
    expect(codigos([bloco('serie-a'), bloco('serie-b')], SEMANAS_MAXIMO)).toEqual([])
  })

  it('conta as datas do bloco (ambos vale o dobro; corta no fim da temporada)', () => {
    expect(datasDoBloco(bloco('serie-a', 12, 50), 52)).toBe(39)
    expect(datasDoBloco(bloco('serie-a', 12, 50, 'ambos'), 52)).toBe(78)
    expect(datasDoBloco(bloco('serie-a', 40, 60), 52)).toBe(13)
    expect(datasDoBloco(bloco('serie-a', 30, 20), 52)).toBe(0)
  })
})
