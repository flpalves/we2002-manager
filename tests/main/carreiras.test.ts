import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras, ARQUIVO_BANCO } from '../../src/main/carreira/servico'
import { lerPacote } from '../../src/main/pacote/leitor'
import { escreverPacote } from '../helpers/pacote'
import { lerResumo } from '../../src/main/db/repositorios/carreira'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { pacote as fixture } from '../fixtures/pacote'
import { ErroApp } from '../../src/main/ipc/registrar'

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

  it('times sem finanças usam o padrão do porte', () => {
    const p = fixture()
    p.times[1] = { ...p.times[1]!, financas: undefined, porte: 'grande' }
    escreverPacote(join(pastaPacotes, 'teste'), p)
    const r = carreiras.criar({ ...entrada, time: 'BBB' })
    expect(r.saldo).toBe(5_000_000_000)
  })

  it('recusa pacote com erros e não deixa pasta para trás', () => {
    const p = fixture()
    p.times[0]!.jogadores.pop()
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
