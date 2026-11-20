import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras, ARQUIVO_BANCO } from '../../src/main/carreira/servico'
import { lerPacote } from '../../src/main/pacote/leitor'
import { escreverPacote } from '../helpers/pacote'
import { lerResumo } from '../../src/main/db/repositorios/carreira'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { exterior, livre, pacote as fixture } from '../fixtures/pacote'
import { ErroApp } from '../../src/main/ipc/registrar'
import { PADROES } from '../../src/core/config/padroes'

describe('Carreiras (serviço)', () => {
  let pastaCarreiras: string
  let pastaPacotes: string
  let carreiras: Carreiras
  let n = 0

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'we-carreiras-'))
    pastaCarreiras = join(base, 'carreiras')
    pastaPacotes = join(base, 'pacotes')
    escreverPacote(join(pastaPacotes, 'teste'), fixture())
    carreiras = new Carreiras({
      pastaCarreiras: () => pastaCarreiras,
      pastaPacotes: () => pastaPacotes,
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: (arq) => {
        const c = abrirNodeSqlite(arq)
        try {
          return lerResumo(c.sql) ?? null
        } finally {
          c.fechar()
        }
      },
      sementeNova: () => 1234,
      agora: () => `2026-11-12T22:00:0${n}Z`,
      sufixoId: () => `x${++n}`,
    })
  })

  const entrada = { pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'Minha carreira', dificuldade: 'normal' as const }

  it('importa os sem clube do pacote: 2 do exterior e 1 livre, com time_id nulo e sem contrato', () => {
    escreverPacote(
      join(pastaPacotes, 'teste-ext'),
      fixture({ exterior: { temporada: 2026, jogadores: [exterior(1), exterior(2, { taxa: 80_000_000 })] }, livres: { jogadores: [livre(1)] } }),
    )
    const r = carreiras.criar({ ...entrada, pacote: 'teste-ext' })
    carreiras.fechar()
    const c = abrirNodeSqlite(join(pastaCarreiras, r.id, ARQUIVO_BANCO))
    try {
      const semClube = c.sql.all<{ chave: string; time_id: number | null; status: string; camisa: number; taxa_fixa: number | null; origem_clube: string | null; origem_pais: string | null }>(
        'SELECT chave, time_id, status, camisa, taxa_fixa, origem_clube, origem_pais FROM jogador WHERE time_id IS NULL ORDER BY chave',
      )
      expect(semClube).toEqual([
        { chave: 'ext-j1', time_id: null, status: 'exterior', camisa: 0, taxa_fixa: 50_000_000, origem_clube: 'Zenit', origem_pais: 'RUS' },
        { chave: 'ext-j2', time_id: null, status: 'exterior', camisa: 0, taxa_fixa: 80_000_000, origem_clube: 'Zenit', origem_pais: 'RUS' },
        { chave: 'liv-j1', time_id: null, status: 'livre', camisa: 0, taxa_fixa: null, origem_clube: null, origem_pais: null },
      ])
      expect(c.sql.get<{ n: number }>('SELECT COUNT(*) n FROM contrato c JOIN jogador j ON j.id = c.jogador_id WHERE j.time_id IS NULL')?.n).toBe(0)
      expect(c.sql.get<{ n: number }>('SELECT COUNT(*) n FROM jogador')?.n).toBe(49)
    } finally {
      c.fechar()
    }
  })

  it('carreira nova no pacote brasil-2026 importa os 200 do exterior com time_id nulo', () => {
    const real = new Carreiras({
      pastaCarreiras: () => pastaCarreiras,
      pastaPacotes: () => join(__dirname, '../../pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 1234,
      agora: () => '2026-11-14T10:00:00Z',
      sufixoId: () => 'real',
    })
    const r = real.criar({ ...entrada, pacote: 'brasil-2026', time: 'BAH' })
    real.fechar()
    const c = abrirNodeSqlite(join(pastaCarreiras, r.id, ARQUIVO_BANCO))
    try {
      expect(c.sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador WHERE status = 'exterior' AND time_id IS NULL AND taxa_fixa > 0")?.n).toBe(200)
    } finally {
      c.fechar()
    }
  }, 60_000)

  it('o pacote do fixture é lido sem arquivos inválidos', () => {
    expect(lerPacote(join(pastaPacotes, 'teste')).invalidos).toEqual([])
  })

  it('cria a carreira: importa tudo, copia escudos e deixa aberta (aceite da fase 1)', () => {
    const r = carreiras.criar(entrada)
    expect(r).toMatchObject({ nome: 'Minha carreira', tecnico: 'Felipe', temporada: 2026, semana: 1, time: { sigla: 'AAA', cores: ['#C8102E', '#111111'] } })
    expect(r.saldo).toBe(100_000_000)
    expect(carreiras.resumoAtual()?.id).toBe(r.id)

    const pasta = join(pastaCarreiras, r.id)
    expect(existsSync(join(pasta, ARQUIVO_BANCO))).toBe(true)
    expect(readdirSync(join(pasta, 'pacote', 'escudos')).sort()).toEqual(['AAA.png', 'BBB.png'])

    carreiras.fechar()
    const c = abrirNodeSqlite(join(pasta, ARQUIVO_BANCO))
    expect(c.sql.get<{ n: number }>('SELECT COUNT(*) n FROM jogador')?.n).toBe(46)
    expect(c.sql.get<{ n: number }>('SELECT COUNT(*) n FROM contrato')?.n).toBe(46)
    expect(c.sql.get<{ n: number }>('SELECT COUNT(*) n FROM time')?.n).toBe(2)
    expect(c.sql.get<{ semente: number }>('SELECT semente FROM carreira')?.semente).toBe(1234)
    const regras = JSON.parse(c.sql.get<{ dados: string }>('SELECT dados FROM regras')!.dados)
    expect(regras.temporada.semanas_por_temporada).toBe(52)
    c.fechar()
  })

  it('times sem finanças usam o padrão do porte × o fator da divisão (BBB não joga liga nacional)', () => {
    const p = fixture()
    p.times[1] = { ...p.times[1]!, financas: undefined, porte: 'grande' }
    escreverPacote(join(pastaPacotes, 'teste'), p)
    const r = carreiras.criar({ ...entrada, time: 'BBB' })
    expect(r.saldo).toBe(5_000_000_000 * PADROES.financas.orcamento_divisao.sem_liga)
  })

  it('recusa pacote com erros e não deixa pasta para trás', () => {
    const p = fixture()
    const elenco = p.times[0]!.jogadores
    elenco[1] = { ...elenco[1]!, camisa: elenco[0]!.camisa } // camisa repetida segue sendo erro
    escreverPacote(join(pastaPacotes, 'teste'), p)
    expect(() => carreiras.criar(entrada)).toThrow(ErroApp)
    try {
      carreiras.criar(entrada)
    } catch (e) {
      expect((e as ErroApp).codigo).toBe('pacote_com_erros')
    }
    expect(existsSync(pastaCarreiras) ? readdirSync(pastaCarreiras) : []).toEqual([])
  })

  it('recusa time inexistente e técnico vazio', () => {
    expect(() => carreiras.criar({ ...entrada, time: 'ZZZ' })).toThrow(/não existe/)
    expect(() => carreiras.criar({ ...entrada, tecnico: '  ' })).toThrow(/técnico/)
  })

  it('lista, abre, fecha e apaga', () => {
    const a = carreiras.criar(entrada)
    const b = carreiras.criar({ ...entrada, nome: '', time: 'BBB' })
    expect(b.nome).toBe('Time BBB 2026')
    expect(carreiras.listar().map((c) => c.id)).toEqual([b.id, a.id])
    expect(carreiras.abrir(a.id).time.sigla).toBe('AAA')
    expect(carreiras.temAberta()).toBe(true)
    carreiras.apagar(a.id)
    expect(carreiras.resumoAtual()).toBeNull()
    expect(carreiras.temAberta()).toBe(false)
    carreiras.abrir(b.id)
    carreiras.fechar()
    expect(carreiras.temAberta()).toBe(false)
    expect(carreiras.listar().map((c) => c.id)).toEqual([b.id])
  })

  it('recusa ids com caminho (../)', () => {
    expect(() => carreiras.abrir('../fora')).toThrow(/inválida/)
    expect(() => carreiras.criar({ ...entrada, pacote: '..' })).toThrow()
  })
})
