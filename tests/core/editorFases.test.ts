import { describe, expect, it } from 'vitest'
import {
  descreverSaida,
  encadear,
  etapasDoMataMata,
  faseNova,
  lerPosicoes,
  moverFase,
  removerFase,
  renomearFase,
  resumirFases,
  trocarFormato,
  trocarModoSaida,
  vagasDaOrigem,
  definirVagasDaOrigem,
  excetoPadrao,
  puloDaOrigem,
  tirarPuloDaOrigem,
} from '@core/pacote/editorFases'
import { problemaDasFases } from '@core/pacote/validar'
import { tamanhoDaCompeticao } from '@core/competicoes/vagas'
import { CompeticaoSchema, type Competicao, type Fase } from '@shared/esquemas/pacote'

const serieC = (): Competicao => ({
  id: 'serie-c',
  nome: 'Série C',
  tipo: 'nacional',
  participantes: { regra: 'lista', times: [] },
  fases: [
    { id: 'f1', nome: '1ª fase', formato: 'pontos_corridos', pontos_corridos: { turnos: 1, classificam: 8 }, classificam_para: 'quad' },
    { id: 'quad', nome: 'Quadrangular', formato: 'grupos', grupos: { quantidade: 2, tamanho: 4, turnos: 2, sorteio: 'potes', classificam: 1 }, classificam_para: 'final' },
    { id: 'final', nome: 'Final', formato: 'mata_mata', mata_mata: { jogos: 2, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'melhor_campanha' } },
  ],
  saidas: [
    { por_grupo: { fase: 'quad', lado: 'primeiros', n: 1 }, destino: 'serie-b', tipo: 'acesso' },
    { primeiros: 4, fase: 'quad', destino: 'copa', tipo: 'vaga' },
  ],
  suspensao: { amarelos: 3, jogos: 1, vermelho_jogos: 1, zera_na_fase: 'quad' },
})

describe('resumirFases', () => {
  it('Série C: 20 → 8 → 2 → campeão, com as rodadas de cada fase', () => {
    expect(resumirFases(serieC(), 20)).toEqual([
      { entram: 20, saem: 8, rodadas: 19, problema: null },
      { entram: 8, saem: 2, rodadas: 6, problema: null },
      { entram: 2, saem: 1, rodadas: 2, problema: null },
    ])
  })

  it('acusa a fase que não fecha, com a mesma mensagem da validação, e para de contar depois', () => {
    const c = serieC()
    c.fases[0] = { ...c.fases[0]!, pontos_corridos: { turnos: 1, classificam: 6 } } as Fase
    const r = resumirFases(c, 20)
    expect(r[1]!.problema).toBe(problemaDasFases(c, 20))
    expect(r[2]).toEqual({ entram: null, saem: 1, rodadas: null, problema: null })
  })

  it('mata-mata que não chega aos classificados', () => {
    const c: Pick<Competicao, 'fases'> = { fases: [faseNova({ fases: [] }, 'mata_mata', 12)] }
    expect(resumirFases(c, 12)[0]!.problema).toContain('não chega a 1')
  })

  it('sem número de participantes não inventa contas', () => {
    expect(resumirFases(serieC(), null)[0]).toEqual({ entram: null, saem: 8, rodadas: null, problema: null })
  })
})

describe('fase nova e troca de formato', () => {
  it('fase nova fecha a conta com o que a anterior entrega e passa no esquema', () => {
    const c = serieC()
    c.fases = c.fases.slice(0, 2)
    const nova = faseNova(c, 'mata_mata', 20)
    expect(nova).toMatchObject({ id: 'f3', nome: 'Final', formato: 'mata_mata' })
    c.fases = encadear([...c.fases, nova], 20)
    expect(problemaDasFases(c, 20)).toBeNull()
    expect(CompeticaoSchema.safeParse(c).success).toBe(true)
  })

  it('grupos padrão com 16 times: 4 grupos de 4', () => {
    const f = faseNova({ fases: [] }, 'grupos', 16)
    expect(f.formato === 'grupos' && f.grupos).toMatchObject({ quantidade: 4, tamanho: 4 })
  })

  it('troca de formato mantém id, nome e encadeamento', () => {
    const f = serieC().fases[1]!
    const t = trocarFormato(f, 'mata_mata', 8, false)
    expect(t).toMatchObject({ id: 'quad', nome: 'Quadrangular', classificam_para: 'final', formato: 'mata_mata' })
    expect(t.formato === 'mata_mata' && t.mata_mata.classificam).toBe(4)
    expect(CompeticaoSchema.shape.fases.element.safeParse(t).success).toBe(true)
  })
})

describe('encadear, mover, renomear, remover', () => {
  it('encadear liga à seguinte, tira da última e exige classificam em pontos corridos', () => {
    const fases: Fase[] = [
      { id: 'a', nome: 'A', formato: 'pontos_corridos', pontos_corridos: { turnos: 1 } },
      { id: 'b', nome: 'B', formato: 'mata_mata', mata_mata: { jogos: 1, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'sorteio' }, classificam_para: 'x' },
    ]
    const r = encadear(fases, 16)
    expect(r[0]).toMatchObject({ classificam_para: 'b', pontos_corridos: { classificam: 8 } })
    expect(r[1]!.classificam_para).toBeUndefined()
  })

  it('mover religa as fases', () => {
    const r = moverFase(serieC().fases, 2, -1)
    expect(r.map((f) => [f.id, f.classificam_para])).toEqual([
      ['f1', 'final'],
      ['final', 'quad'],
      ['quad', undefined],
    ])
  })

  it('renomear troca o id em encadeamento, saídas e suspensão', () => {
    const r = renomearFase(serieC(), 'quad', 'quadrangular')
    expect(r.fases[0]!.classificam_para).toBe('quadrangular')
    expect(r.saidas![0]!.por_grupo!.fase).toBe('quadrangular')
    expect(r.saidas![1]!.fase).toBe('quadrangular')
    expect(r.suspensao!.zera_na_fase).toBe('quadrangular')
  })

  it('remover tira a saída por grupo da fase e a referência das outras', () => {
    const r = removerFase(serieC(), 1, 20)
    expect(r.fases.map((f) => f.id)).toEqual(['f1', 'final'])
    expect(r.fases[0]!.classificam_para).toBe('final')
    expect(r.saidas).toEqual([{ primeiros: 4, destino: 'copa', tipo: 'vaga' }])
    expect(r.suspensao!.zera_na_fase).toBeNull()
  })

  it('não remove a única fase', () => {
    const c = serieC()
    c.fases = c.fases.slice(0, 1)
    expect(removerFase(c, 0).fases).toHaveLength(1)
  })
})

describe('saídas', () => {
  const c = serieC()
  it('descreve cada jeito de escolher os times', () => {
    const nome = (id: string) => ({ 'serie-b': 'Série B', copa: 'Copa' })[id] ?? id
    expect(descreverSaida(c.saidas![0]!, c, nome)).toBe('O primeiro de cada grupo de "Quadrangular" sobe para Série B.')
    expect(descreverSaida(c.saidas![1]!, c, nome)).toBe('Entre quem jogou "Quadrangular", os 4 melhores vão para Copa (vaga).')
    expect(descreverSaida({ campeao: true, destino: 'copa' }, c, nome)).toBe('O campeão vai para Copa (vaga).')
    expect(descreverSaida({ posicoes: '17-20', destino: 'serie-d', tipo: 'rebaixamento' }, c)).toBe('Do 17º ao 20º caem para serie-d.')
    expect(descreverSaida({ ultimos: 1, destino: 'x', tipo: 'rebaixamento' }, c)).toBe('O último da classificação final cai para x.')
  })

  it('trocar o modo mantém destino e tipo', () => {
    const s = trocarModoSaida({ campeao: true, destino: 'copa', tipo: 'vaga' }, 'por_grupo', c)
    expect(s).toEqual({ por_grupo: { fase: 'quad', lado: 'primeiros', n: 1 }, destino: 'copa', tipo: 'vaga' })
    expect(trocarModoSaida(s, 'posicoes', c)).toEqual({ posicoes: '1-4', destino: 'copa', tipo: 'vaga' })
  })

  it('vaga pulando: frase e o modo "primeiros" guarda as competições puladas', () => {
    const nome = (id: string) => ({ 'serie-c': 'Série C', 'serie-d': 'Série D' })[id] ?? id
    const s = { primeiros: 2, destino: 'serie-d', exceto_de: ['serie-c'] }
    expect(descreverSaida(s, c, nome)).toBe('Os 2 melhores na classificação final, pulando quem joga Série C na próxima temporada ou já está em Série D, vão para Série D (vaga).')
    expect(trocarModoSaida({ ...s, primeiros: 3 }, 'primeiros', c)).toEqual({ primeiros: 3, exceto_de: ['serie-c'], destino: 'serie-d' })
    expect(trocarModoSaida(s, 'ultimos', c)).toEqual({ ultimos: 2, destino: 'serie-d' })
  })

  it('lê posições', () => {
    expect(lerPosicoes('1-4')).toEqual([1, 4])
    expect(lerPosicoes(' 3 ')).toEqual([3, 3])
    expect(lerPosicoes('4-1')).toBeNull()
    expect(lerPosicoes('a')).toBeNull()
  })

  it('etapas do mata-mata', () => {
    expect(etapasDoMataMata(16, 1)).toEqual(['Oitavas', 'Quartas', 'Semifinal', 'Final'])
  })
})

describe('pacote brasil-2026', () => {
  it('encadear não muda as fases das competições reais (salvar sem mexer não altera o arquivo)', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const pasta = 'pacotes/brasil-2026/competicoes'
    for (const arq of readdirSync(pasta)) {
      const c = CompeticaoSchema.parse(JSON.parse(readFileSync(`${pasta}/${arq}`, 'utf-8')))
      const n = tamanhoDaCompeticao(c)
      expect(encadear(c.fases, n), arq).toEqual(c.fases)
      expect(resumirFases(c, n).every((r) => !r.problema), arq).toBe(true)
    }
  })
})

describe('vagas de uma competição por vagas', () => {
  const est: Competicao = {
    id: 'carioca',
    nome: 'Cariocão',
    tipo: 'estadual',
    participantes: { regra: 'lista', times: [] },
    fases: [{ id: 'liga', nome: 'Liga', formato: 'pontos_corridos', pontos_corridos: { turnos: 1 } }],
    saidas: [
      { campeao: true, destino: 'copa' },
      { posicoes: '1-2', destino: 'serie-d' },
    ],
  }

  it('conta as vagas e troca pelas "primeiros N pulando", sem mexer nas outras saídas', () => {
    expect(vagasDaOrigem(est, 'serie-d')).toBe(2)
    const r = definirVagasDaOrigem(est, 'serie-d', 3)
    expect(r.saidas).toEqual([{ campeao: true, destino: 'copa' }, { primeiros: 3, destino: 'serie-d' }])
    expect(vagasDaOrigem(r, 'serie-d')).toBe(3)
    // Mantém o exceto_de de uma vaga "primeiros" que já existia; 0 tira a vaga.
    const comPulo = { ...est, saidas: [{ primeiros: 2, destino: 'serie-d', exceto_de: ['serie-a'] }] }
    expect(definirVagasDaOrigem(comPulo, 'serie-d', 4).saidas).toEqual([{ primeiros: 4, destino: 'serie-d', exceto_de: ['serie-a'] }])
    expect(definirVagasDaOrigem(r, 'serie-d', 0).saidas).toEqual([{ campeao: true, destino: 'copa' }])
    expect(definirVagasDaOrigem({ ...est, saidas: [{ primeiros: 1, destino: 'serie-d' }] }, 'serie-d', 0).saidas).toBeUndefined()
  })

  it('o pulo da origem pode passar para o destino', () => {
    const o = { ...est, saidas: [{ campeao: true, destino: 'copa', exceto_de: ['x'] }, { primeiros: 2, destino: 'serie-d', exceto_de: ['serie-a', 'serie-b'] }] }
    expect(puloDaOrigem(o, 'serie-d')).toEqual(['serie-a', 'serie-b'])
    expect(tirarPuloDaOrigem(o, 'serie-d').saidas).toEqual([{ campeao: true, destino: 'copa', exceto_de: ['x'] }, { primeiros: 2, destino: 'serie-d' }])
  })

  it('descreve o pulo em campeão e posições', () => {
    const s = { posicoes: '7-12', destino: 'sula', exceto_de: ['liberta'] }
    expect(descreverSaida(s, est, (id) => ({ sula: 'Sul-Americana', liberta: 'Libertadores' })[id] ?? id)).toBe(
      'Do 7º ao 12º vão para Sul-Americana (vaga) (pulando quem joga Libertadores; a vaga desce).',
    )
    expect(trocarModoSaida(s, 'campeao', est)).toEqual({ campeao: true, exceto_de: ['liberta'], destino: 'sula' })
  })

  it('pula por padrão as nacionais por lista que não são por vagas', () => {
    const nac = (id: string, por_vagas = false): Competicao => ({ ...est, id, tipo: 'nacional', participantes: { regra: 'lista', times: [], ...(por_vagas && { por_vagas }) } })
    expect(excetoPadrao([nac('serie-a'), nac('serie-c'), nac('serie-d', true), est], 'serie-d')).toEqual(['serie-a', 'serie-c'])
  })
})
