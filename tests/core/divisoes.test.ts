import { describe, expect, it } from 'vitest'
import type { Competicao, Divisoes } from '@shared/esquemas/pacote'
import type { EstadoEdicao } from '@core/competicoes/fases'
import { resolverSaidas } from '@core/competicoes/fases'
import { aplicarDivisoes, saidasDaEscada, validarDivisoes } from '@core/competicoes/divisoes'

const times = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${i + 1}`)

const liga = (id: string, n: number, extra: Partial<Competicao> = {}): Competicao => ({
  id,
  nome: `Série ${id.toUpperCase()}`,
  tipo: 'nacional',
  participantes: { regra: 'lista', times: times(id.toUpperCase(), n) },
  fases: [{ id: 'liga', nome: 'Turno e returno', formato: 'pontos_corridos', pontos_corridos: { turnos: 2 } }],
  ...extra,
})

/** Série C: 1ª fase em pontos corridos (20), quadrangular em 2 grupos de 4 (8 classificados). */
const serieC = (): Competicao =>
  liga('c', 20, {
    fases: [
      { id: 'f1', nome: '1ª fase', formato: 'pontos_corridos', pontos_corridos: { turnos: 1, classificam: 8 }, classificam_para: 'quad' },
      { id: 'quad', nome: 'Quadrangular', formato: 'grupos', grupos: { quantidade: 2, tamanho: 4, turnos: 2, sorteio: 'livre', classificam: 1 } },
    ],
  })

describe('escada de divisões → saídas', () => {
  it('troca pareada: a de cima rebaixa os N últimos, a de baixo sobe os N primeiros', () => {
    const escada: Divisoes = { divisoes: [{ competicao: 'a' }, { competicao: 'b', troca: 4 }] }
    const s = saidasDaEscada(escada)
    expect(s.get('a')).toEqual([{ ultimos: 4, destino: 'b', tipo: 'rebaixamento' }])
    expect(s.get('b')).toEqual([{ primeiros: 4, destino: 'a', tipo: 'acesso' }])
  })

  it('critérios por fase e por grupo viram as saídas correspondentes', () => {
    const escada: Divisoes = {
      divisoes: [
        { competicao: 'b' },
        { competicao: 'c', troca: 4, sobem: { criterio: 'fase', fase: 'quad' } },
        { competicao: 'd', troca: 4, descem: { criterio: 'posicao' }, sobem: { criterio: 'grupo', fase: 'g', por_grupo: 1 } },
      ],
    }
    const s = saidasDaEscada(escada)
    expect(s.get('c')).toEqual([
      { primeiros: 4, fase: 'quad', destino: 'b', tipo: 'acesso' },
      { ultimos: 4, destino: 'd', tipo: 'rebaixamento' },
    ])
    expect(s.get('d')).toEqual([{ por_grupo: { fase: 'g', lado: 'primeiros', n: 1 }, destino: 'c', tipo: 'acesso' }])
  })

  it('aplicar: troca as saídas de acesso/rebaixamento e as zonas do pacote, mantém vagas e outras zonas', () => {
    const a = liga('a', 20, {
      saidas: [
        { posicoes: '17-20', destino: 'b', tipo: 'rebaixamento' },
        { posicoes: '1-6', destino: 'liberta', tipo: 'vaga' },
      ],
      fases: [
        {
          id: 'liga',
          nome: 'Turno e returno',
          formato: 'pontos_corridos',
          pontos_corridos: { turnos: 2 },
          zonas: [
            { de: 1, ate: 6, nome: 'Libertadores', cor: 'info' },
            { de: 17, ate: 20, nome: 'Rebaixamento', cor: 'negativo' },
          ],
        },
      ],
    })
    const [a2, b2, x] = aplicarDivisoes([a, liga('b', 20), liga('x', 4)], { divisoes: [{ competicao: 'a' }, { competicao: 'b', troca: 3 }] })
    expect(a2!.saidas).toEqual([
      { posicoes: '1-6', destino: 'liberta', tipo: 'vaga' },
      { ultimos: 3, destino: 'b', tipo: 'rebaixamento' },
    ])
    expect(a2!.fases[0]!.zonas).toEqual([
      { de: 1, ate: 6, nome: 'Libertadores', cor: 'info' },
      { de: 18, ate: 20, nome: 'Rebaixamento', cor: 'negativo' },
    ])
    expect(b2!.fases[0]!.zonas).toEqual([{ de: 1, ate: 3, nome: 'Acesso', cor: 'positivo' }])
    expect(x).toEqual(liga('x', 4))
  })

  it('zona por grupo marca as posições dentro de cada grupo; por fase não tem zona', () => {
    const [b, c] = aplicarDivisoes([liga('b', 20), serieC()], {
      divisoes: [{ competicao: 'b' }, { competicao: 'c', troca: 2, sobem: { criterio: 'grupo', fase: 'quad', por_grupo: 1 } }],
    })
    expect(c!.fases[1]!.zonas).toEqual([{ de: 1, ate: 1, nome: 'Acesso', cor: 'positivo' }])
    expect(b!.fases[0]!.zonas).toEqual([{ de: 19, ate: 20, nome: 'Rebaixamento', cor: 'negativo' }])
    const [, c2] = aplicarDivisoes([liga('b', 20), serieC()], { divisoes: [{ competicao: 'b' }, { competicao: 'c', troca: 4, sobem: { criterio: 'fase', fase: 'quad' } }] })
    expect(c2!.fases.every((f) => !f.zonas)).toBe(true)
  })

  it('sem escada as competições ficam como estão', () => {
    const a = liga('a', 4)
    expect(aplicarDivisoes([a], null)).toEqual([a])
    expect(aplicarDivisoes([a], { divisoes: [] })).toEqual([a])
  })
})

describe('escada de divisões → validação', () => {
  const codigos = (escada: Divisoes, cs: Competicao[]) => validarDivisoes(escada, cs).map((p) => `${p.nivel}:${p.codigo}`)

  it('escada válida não tem problemas', () => {
    expect(codigos({ divisoes: [{ competicao: 'a' }, { competicao: 'b', troca: 4 }] }, [liga('a', 20), liga('b', 20)])).toEqual([])
  })

  it('competição inexistente, repetida, sem lista ou sem troca', () => {
    const copa: Competicao = { ...liga('copa', 4), participantes: { regra: 'classificados_de', origens: ['a'], quantidade: 4 } }
    expect(codigos({ divisoes: [{ competicao: 'a' }, { competicao: 'zz', troca: 2 }] }, [liga('a', 4)])).toEqual(['erro:divisao_inexistente'])
    expect(codigos({ divisoes: [{ competicao: 'a' }, { competicao: 'a', troca: 1 }] }, [liga('a', 4)])).toContain('erro:divisao_repetida')
    expect(codigos({ divisoes: [{ competicao: 'a' }, { competicao: 'copa', troca: 1 }] }, [liga('a', 4), copa])).toContain('erro:divisao_sem_lista')
    expect(codigos({ divisoes: [{ competicao: 'a' }, { competicao: 'b' }] }, [liga('a', 4), liga('b', 4)])).toEqual(['erro:divisao_sem_troca'])
  })

  it('troca do tamanho da série ou maior é erro', () => {
    expect(codigos({ divisoes: [{ competicao: 'a' }, { competicao: 'b', troca: 6 }] }, [liga('a', 20), liga('b', 6)])).toEqual(['erro:divisao_troca_grande'])
  })

  it('critério por fase: a fase precisa existir e ter times suficientes', () => {
    const ok = { divisoes: [{ competicao: 'b' }, { competicao: 'c', troca: 4, sobem: { criterio: 'fase' as const, fase: 'quad' } }] }
    expect(codigos(ok, [liga('b', 20), serieC()])).toEqual([])
    const semFase = { divisoes: [{ competicao: 'b' }, { competicao: 'c', troca: 4, sobem: { criterio: 'fase' as const, fase: 'final' } }] }
    expect(codigos(semFase, [liga('b', 20), serieC()])).toEqual(['erro:divisao_criterio'])
    const poucos = { divisoes: [{ competicao: 'b' }, { competicao: 'c', troca: 10, sobem: { criterio: 'fase' as const, fase: 'quad' } }] }
    expect(codigos(poucos, [liga('b', 20), serieC()])).toEqual(['erro:divisao_criterio'])
  })

  it('critério por grupo: fase de grupos e por_grupo × grupos = troca', () => {
    const grupo = (por_grupo: number, troca: number, fase = 'quad') => ({
      divisoes: [{ competicao: 'b' }, { competicao: 'c', troca, sobem: { criterio: 'grupo' as const, fase, por_grupo } }],
    })
    expect(codigos(grupo(2, 4), [liga('b', 20), serieC()])).toEqual([])
    expect(codigos(grupo(1, 4), [liga('b', 20), serieC()])).toEqual(['erro:divisao_criterio'])
    expect(codigos(grupo(5, 10), [liga('b', 20), serieC()])).toEqual(['erro:divisao_criterio'])
    expect(codigos(grupo(1, 2, 'f1'), [liga('b', 20), serieC()])).toEqual(['erro:divisao_criterio'])
  })

  it('avisa quando a 1ª divisão tem troca e quando a escada substitui saídas manuais', () => {
    const a = liga('a', 4, { saidas: [{ posicoes: '3-4', destino: 'b', tipo: 'rebaixamento' }] })
    expect(codigos({ divisoes: [{ competicao: 'a', troca: 2 }, { competicao: 'b', troca: 1 }] }, [a, liga('b', 4)])).toEqual([
      'aviso:divisao_topo',
      'aviso:saida_substituida',
    ])
  })
})

describe('saídas: critérios por fase e por grupo', () => {
  const c = serieC()
  const final = times('C', 20)
  // Quadrangular: grupos [C1, C4, C5, C8] e [C2, C3, C6, C7]; 1ª fase com todos.
  const edicao = (ordemGrupos?: string[][]): EstadoEdicao => ({
    id: 'c-2026',
    competicao: 'c',
    temporada: 2026,
    participantes: final,
    fases: [
      { id: 'f1', participantes: final, grupos: [final], classificados: final, eliminados: [], encerrada: true },
      {
        id: 'quad',
        participantes: final.slice(0, 8),
        grupos: [
          ['C8', 'C1', 'C5', 'C4'],
          ['C2', 'C7', 'C3', 'C6'],
        ],
        classificados: ['C1', 'C2'],
        eliminados: [],
        encerrada: true,
        ...(ordemGrupos ? { ordemGrupos } : {}),
      },
    ],
    campeao: 'C1',
    classificacaoFinal: final,
  })
  const quem = (saidas: Competicao['saidas'], e = edicao()) => resolverSaidas(e, { ...c, saidas }).map((s) => s.time)

  it('primeiros/ultimos na classificação final', () => {
    expect(quem([{ primeiros: 2, destino: 'b', tipo: 'acesso' }])).toEqual(['C1', 'C2'])
    expect(quem([{ ultimos: 3, destino: 'd', tipo: 'rebaixamento' }])).toEqual(['C18', 'C19', 'C20'])
  })

  it('por fase: só entre quem jogou a fase', () => {
    expect(quem([{ fase: 'quad', primeiros: 4, destino: 'b', tipo: 'acesso' }])).toEqual(['C1', 'C2', 'C3', 'C4'])
    expect(quem([{ fase: 'quad', ultimos: 2, destino: 'x' }])).toEqual(['C7', 'C8'])
  })

  it('por grupo: usa a ordem final gravada de cada grupo', () => {
    const e = edicao([
      ['C4', 'C1', 'C5', 'C8'],
      ['C3', 'C2', 'C7', 'C6'],
    ])
    expect(quem([{ por_grupo: { fase: 'quad', lado: 'primeiros', n: 1 }, destino: 'b', tipo: 'acesso' }], e)).toEqual(['C4', 'C3'])
    expect(quem([{ por_grupo: { fase: 'quad', lado: 'ultimos', n: 2 }, destino: 'd', tipo: 'rebaixamento' }], e)).toEqual(['C5', 'C8', 'C7', 'C6'])
  })

  it('por grupo sem ordem gravada (edição antiga): ordem da classificação final', () => {
    expect(quem([{ por_grupo: { fase: 'quad', lado: 'primeiros', n: 2 }, destino: 'b', tipo: 'acesso' }])).toEqual(['C1', 'C4', 'C2', 'C3'])
  })
})
