import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PADROES } from '@core/config/padroes'
import { converterTimeLegado, potencialProvisorio } from '@core/pacote/legado'
import { paraExibicaoWe } from '@core/jogadores/conversao'
import { TimeSchema } from '@shared/esquemas/pacote'

const opcoes = {
  pais: 'BRA',
  estado: 'RJ',
  porte: 'grande' as const,
  temporada_inicial: 2026,
  regras: PADROES,
  caminhoKit: (a: string) => a.replace(/^kits\/desenhos\//, 'kits/desenhos/novo_'),
  caminhoBandeira: (a: string) => a.replace(/^bandeiras\//, 'bandeiras/'),
}

const legado = {
  nome: 'São Paulo',
  sigla: 'spfc',
  formacao: '5-3-2',
  bandeira: 'bandeiras/spfc_teste.png',
  kit: { arte: 'kits/desenhos/spfc_4x.png', design: { camisa: '#ffffff', detalhe: '#ff0000', calcao: '#ffffff' } },
  jogadores: [
    {
      vaga: 1,
      nome: 'Léo',
      posicao: 'LB',
      camisa: 6,
      altura: 180,
      idade: 20,
      pe: 'canhoto',
      atributos: { OFF: 15, HEAD: 19, PASS: 12, SHPW: 16, SHAC: 13, CRV: 17 },
      aparencia: { pele: 3, fisico: 'F', cabelo: 'i1', cor_cabelo: 'A', barba: 'A', cor_barba: 'A', chuteira: 'A' },
    },
    { vaga: 0, nome: 'Rafael', posicao: 'GK', camisa: 23, altura: 191, idade: 35, atributos: {} },
  ],
}

describe('converterTimeLegado', () => {
  const t = converterTimeLegado(legado, opcoes)

  it('produz um time válido pelo esquema do pacote', () => {
    expect(TimeSchema.safeParse(t).success).toBe(true)
  })

  it('converte cabeçalho: sigla, nome curto ASCII, cores do kit, kit e bandeira', () => {
    expect(t.sigla).toBe('SPFC')
    expect(t.nome_curto).toBe('SAO PAULO')
    expect(t.cores).toEqual(['#FFFFFF', '#FF0000'])
    expect(t.kit?.['arte']).toBe('kits/desenhos/novo_spfc_4x.png')
    expect(t.bandeira).toEqual({ arquivo: 'bandeiras/spfc_teste.png', ajuste: 'esticar' })
  })

  it('ordena pela vaga, converte posições com lado e chaves antigas dos atributos', () => {
    const [gk, lb] = t.jogadores
    expect(gk!.posicao).toBe('GK')
    expect(lb!.posicao).toBe('SB')
    expect(lb!.atributos.HEA).toBe(19)
    expect(lb!.atributos.PAS).toBe(3)
    expect(lb!.atributos.SHP).toBe(13)
    expect(lb!.atributos.SHA).toBe(7)
    expect(lb!.atributos.CUR).toBe(15)
    expect(lb!.atributos.OFF).toBe(11)
    // atributo ausente vira o mínimo do WE
    expect(gk!.atributos.DEF).toBe(3)
  })

  it('preserva o número exibido no WE na ida e volta', () => {
    const lb = t.jogadores[1]!
    for (const [antigo, novo] of [['OFF', 'OFF'], ['HEAD', 'HEA'], ['CRV', 'CUR']] as const) {
      const original = (legado.jogadores[0]!.atributos as Record<string, number>)[antigo]
      expect(paraExibicaoWe(lb.atributos[novo], PADROES.jogadores.conversao_we)).toBe(original)
    }
  })

  it('nome_we sem acento, id estável e aparência mantida', () => {
    const lb = t.jogadores[1]!
    expect(lb.nome_we).toBe('Leo')
    expect(lb.id).toBe('spfc-leo')
    expect(lb.aparencia?.cabelo).toBe('i1')
    expect(t.jogadores[0]!.aparencia).toBeUndefined()
  })

  it('rejeita posição desconhecida', () => {
    const ruim = { ...legado, jogadores: [{ ...legado.jogadores[1]!, posicao: 'XX' }] }
    expect(() => converterTimeLegado(ruim, opcoes)).toThrow(/posição desconhecida/)
  })

  it('potencial provisório dá folga aos jovens e não passa de 20', () => {
    expect(potencialProvisorio(12, 18)).toBe(15)
    expect(potencialProvisorio(12, 30)).toBe(12)
    expect(potencialProvisorio(19, 18)).toBe(20)
  })

  it('converte todos os times reais de data/times', () => {
    const pasta = join(__dirname, '../../data/times')
    for (const arq of readdirSync(pasta).filter((f) => f.endsWith('.json'))) {
      const convertido = converterTimeLegado(JSON.parse(readFileSync(join(pasta, arq), 'utf8')), opcoes)
      const r = TimeSchema.safeParse(convertido)
      expect(r.success, `${arq}: ${r.success ? '' : r.error.message}`).toBe(true)
    }
  })
})
