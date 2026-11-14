import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { temErros, validarPacote } from '@core/pacote/validar'
import type { Competicao } from '@shared/esquemas/pacote'
import { exterior, jogador, livre, pacote, time } from '../fixtures/pacote'
import { catalogoPadrao } from '@core/noticias/catalogoPadrao'

const codigos = (p: ReturnType<typeof validarPacote>, nivel?: 'erro' | 'aviso') =>
  p.filter((x) => !nivel || x.nivel === nivel).map((x) => x.codigo)

describe('validarPacote', () => {
  it('pacote válido não tem erros', () => {
    const p = validarPacote(pacote(), PADROES)
    expect(codigos(p, 'erro')).toEqual([])
    expect(temErros(p)).toBe(false)
  })

  it('valida o noticias.json do pacote (erros e avisos apontam o arquivo)', () => {
    const [e] = catalogoPadrao()
    const quebrado = { ...e!, gatilho: { momento: 'semana' as const, condicoes: [{ campo: 'partida.gols_pro' as const, op: '>=' as const, valor: 3 }] } }
    const p = validarPacote(pacote({ noticias: [quebrado] }), PADROES)
    expect(p).toContainEqual(expect.objectContaining({ nivel: 'erro', codigo: 'condicao_partida', arquivo: 'noticias.json' }))
    expect(codigos(validarPacote(pacote({ noticias: catalogoPadrao() }), PADROES), 'erro')).toEqual([])
  })

  it('acusa escudo faltando (aceite da fase 1)', () => {
    const p = validarPacote(pacote({ escudos: ['AAA'] }), PADROES)
    expect(p).toContainEqual(expect.objectContaining({ nivel: 'erro', codigo: 'escudo_faltando', time: 'BBB' }))
  })

  it('acusa time com número errado de jogadores (aceite da fase 1)', () => {
    const curto = time('AAA')
    curto.jogadores = curto.jogadores.slice(0, 22)
    const p = validarPacote(pacote({ times: [curto, time('BBB')] }), PADROES)
    expect(p).toContainEqual(expect.objectContaining({ nivel: 'erro', codigo: 'elenco_incompleto', time: 'AAA' }))
  })

  it('exige 2 goleiros', () => {
    const t = time('AAA')
    t.jogadores[1] = { ...t.jogadores[1]!, posicao: 'CB' }
    expect(codigos(validarPacote(pacote({ times: [t, time('BBB')] }), PADROES), 'erro')).toContain('goleiros_insuficientes')
  })

  it('acusa camisa repetida, nome_we vazio e id repetido', () => {
    const t = time('AAA')
    t.jogadores[5] = { ...t.jogadores[5]!, camisa: 1 }
    t.jogadores[6] = { ...t.jogadores[6]!, nome_we: '  ' }
    const outro = time('BBB')
    outro.jogadores[0] = { ...outro.jogadores[0]!, id: 'aaa-j3' }
    const e = codigos(validarPacote(pacote({ times: [t, outro] }), PADROES), 'erro')
    expect(e).toEqual(expect.arrayContaining(['camisa_repetida', 'nome_we_vazio', 'jogador_id_repetido']))
  })

  it('acusa time referenciado que não existe e tamanho errado da competição', () => {
    const base = pacote()
    const grupos: Competicao = {
      id: 'copa',
      nome: 'Copa',
      tipo: 'nacional',
      participantes: { regra: 'lista', times: ['AAA', 'BBB', 'ZZZ'] },
      fases: [{ id: 'g', nome: 'Grupos', formato: 'grupos', grupos: { quantidade: 1, tamanho: 4, turnos: 1, sorteio: 'livre', classificam: 2 } }],
    }
    const e = validarPacote({ ...base, competicoes: [grupos] }, PADROES).filter((x) => x.nivel === 'erro')
    expect(e).toContainEqual(expect.objectContaining({ codigo: 'time_inexistente', time: 'ZZZ' }))
    expect(e).toContainEqual(expect.objectContaining({ codigo: 'competicao_tamanho', competicao: 'copa' }))
  })

  it('mata-mata na 1ª fase pede potência de 2', () => {
    const base = pacote({ times: [time('AAA'), time('BBB'), time('CCC')] })
    const copa: Competicao = {
      id: 'copa',
      nome: 'Copa',
      tipo: 'nacional',
      participantes: { regra: 'lista', times: ['AAA', 'BBB', 'CCC'] },
      fases: [{ id: 'm', nome: 'Final', formato: 'mata_mata', mata_mata: { jogos: 1, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'sorteio' } }],
    }
    expect(codigos(validarPacote({ ...base, competicoes: [copa] }, PADROES), 'erro')).toContain('competicao_tamanho')
    copa.participantes = { regra: 'lista', times: ['AAA', 'BBB'] }
    expect(codigos(validarPacote({ ...base, competicoes: [copa] }, PADROES), 'erro')).not.toContain('competicao_tamanho')
  })

  it('avisos: nome longo, kit de goleiro, finanças vazias, posição secundária', () => {
    const t = time('AAA', { nome_curto: 'NOME MUITO LONGO', kit_goleiro: undefined, financas: undefined })
    t.jogadores[0] = { ...jogador('AAA', 1), nome_we: 'Ação' , posicao_secundaria: null }
    const a = codigos(validarPacote(pacote({ times: [t, time('BBB')] }), PADROES), 'aviso')
    expect(a).toEqual(expect.arrayContaining(['nome_longo', 'kit_goleiro_faltando', 'financas_vazias', 'sem_posicao_secundaria']))
    expect(a.filter((c) => c === 'nome_longo')).toHaveLength(2)
  })

  it('arquivo inválido e manifesto ausente são erros', () => {
    const e = codigos(validarPacote(pacote({ manifesto: null, invalidos: [{ arquivo: 'times/X.json', mensagem: 'x' }] }), PADROES), 'erro')
    expect(e).toEqual(expect.arrayContaining(['arquivo_invalido', 'manifesto_ausente']))
  })

  it('temporada.json: bloco de competição inexistente ou fora das semanas é erro; competição sem bloco é aviso', () => {
    const base = pacote()
    const p = validarPacote({ ...base, temporada: { blocos: [{ competicao: 'xyz', datas: 'fds', semana_inicio: 1, semana_fim: 60 }] } }, PADROES)
    expect(p.filter((x) => x.codigo === 'bloco_invalido')).toHaveLength(2)
    expect(codigos(p, 'aviso')).toContain('sem_bloco')
  })

  it('fases encadeadas incompatíveis são erro', () => {
    const base = pacote({ times: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'].map((s) => time(s)) })
    const c: Competicao = {
      id: 'liga',
      nome: 'Liga',
      tipo: 'nacional',
      participantes: { regra: 'lista', times: base.times.map((t) => t.sigla) },
      fases: [
        { id: 'a', nome: 'Turno', formato: 'pontos_corridos', pontos_corridos: { turnos: 1, classificam: 3 }, classificam_para: 'b' },
        { id: 'b', nome: 'Final', formato: 'mata_mata', mata_mata: { jogos: 1, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'sorteio' } },
      ],
    }
    expect(codigos(validarPacote({ ...base, competicoes: [c] }, PADROES), 'erro')).toContain('fase_incompativel')
    const ok = { ...c, fases: [{ ...c.fases[0]!, pontos_corridos: { turnos: 1, classificam: 4 } } as Competicao['fases'][number], c.fases[1]!] }
    expect(codigos(validarPacote({ ...base, competicoes: [ok] }, PADROES), 'erro')).not.toContain('fase_incompativel')
  })

  it('o mínimo de convocáveis vem das regras', () => {
    const t = time('AAA')
    t.jogadores = t.jogadores.slice(0, 22)
    const regras = { ...PADROES, elenco: { ...PADROES.elenco, convocaveis_minimo: 22 } }
    expect(codigos(validarPacote(pacote({ times: [t, time('BBB')] }), regras), 'erro')).not.toContain('elenco_incompleto')
  })

  it('virada: classificados_de avisa da 1ª temporada e de origem sem vaga; acesso exige listas', () => {
    const base = pacote()
    const liga = base.competicoes[0]!
    const copa: Competicao = {
      id: 'copa',
      nome: 'Copa',
      tipo: 'continental',
      participantes: { regra: 'classificados_de', origens: ['liga'] },
      fases: [{ id: 'f', nome: 'Liga', formato: 'pontos_corridos', pontos_corridos: { turnos: 1 } }],
    }
    const semVaga = codigos(validarPacote({ ...base, competicoes: [liga, copa] }, PADROES), 'aviso')
    expect(semVaga).toContain('primeira_temporada')
    expect(semVaga).toContain('sem_vagas')
    const comVaga = { ...liga, saidas: [{ posicoes: '1', destino: 'copa' }] }
    expect(codigos(validarPacote({ ...base, competicoes: [comVaga, copa] }, PADROES), 'aviso')).not.toContain('sem_vagas')
    const acessoErrado = { ...liga, saidas: [{ posicoes: '1', destino: 'copa', tipo: 'acesso' }] }
    expect(codigos(validarPacote({ ...base, competicoes: [acessoErrado, copa] }, PADROES), 'aviso')).toContain('saida_invalida')
  })
})

describe('validarPacote / jogadores sem clube (exterior.json, livres.json)', () => {
  it('pacote com exterior e livres válidos não tem erros', () => {
    const p = validarPacote(pacote({ exterior: { temporada: 2026, jogadores: [exterior(1), exterior(2)] }, livres: { jogadores: [livre(1)] } }), PADROES)
    expect(codigos(p, 'erro')).toEqual([])
  })

  it('id repetido entre times, exterior e livres é erro', () => {
    const p = validarPacote(
      pacote({
        exterior: { temporada: 2026, jogadores: [exterior(1, { id: 'aaa-j1' }), exterior(2)] },
        livres: { jogadores: [livre(1, { id: 'ext-j2' })] },
      }),
      PADROES,
    )
    const repetidos = p.filter((x) => x.codigo === 'jogador_id_repetido')
    expect(repetidos.map((x) => [x.jogador, x.nivel])).toEqual([
      ['aaa-j1', 'erro'],
      ['ext-j2', 'erro'],
    ])
  })

  it('taxa <= 0 no exterior é erro', () => {
    const p = validarPacote(pacote({ exterior: { temporada: 2026, jogadores: [exterior(1, { taxa: 0 }), exterior(2, { taxa: -5 })] } }), PADROES)
    expect(p.filter((x) => x.codigo === 'taxa_invalida').map((x) => [x.jogador, x.nivel])).toEqual([
      ['ext-j1', 'erro'],
      ['ext-j2', 'erro'],
    ])
  })

  it('avisos: nome_we repetido entre os sem clube, nome longo, sem posição secundária', () => {
    const p = validarPacote(
      pacote({
        exterior: { temporada: 2026, jogadores: [exterior(1, { nome_we: 'IGUAL' }), exterior(2, { nome_we: 'NOME COMPRIDO' })] },
        livres: { jogadores: [livre(1, { nome_we: 'IGUAL', posicao_secundaria: null })] },
      }),
      PADROES,
    )
    expect(codigos(p, 'erro')).toEqual([])
    expect(p.find((x) => x.codigo === 'nome_we_repetido')).toMatchObject({ nivel: 'aviso', arquivo: 'livres.json', jogador: 'liv-j1' })
    expect(p.find((x) => x.codigo === 'nome_longo' && x.jogador === 'ext-j2')).toMatchObject({ nivel: 'aviso', arquivo: 'exterior.json' })
    expect(p.find((x) => x.codigo === 'sem_posicao_secundaria' && x.jogador === 'liv-j1')).toMatchObject({ nivel: 'aviso' })
  })
})
