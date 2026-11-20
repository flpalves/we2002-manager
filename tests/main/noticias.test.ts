import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { calendario, continuar, jogarDataDoUsuario, responderEvento } from '../../src/main/carreira/temporada'
import { caixa, destaquesDoJogo, marcarLidas } from '../../src/main/carreira/noticias'
import type { Sql } from '../../src/main/db/sql'
import { avancar, continuarAtePreJogo, responderPendentes } from '../helpers/avancar'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { pacote as fixture, time } from '../fixtures/pacote'
import { escreverPacote } from '../helpers/pacote'
import { ErroApp } from '../../src/main/ipc/registrar'
import type { EfeitoAplicado } from '@core/noticias/motor'
import type { EventoCatalogoEntrada } from '@shared/esquemas/noticias'
import { CatalogoSchema } from '@shared/esquemas/noticias'

/** Aceite da fase 7: eventos com escolha interrompem o Continuar; efeitos auditáveis. */

function criar(opcoes: { semente?: number; fator?: number; catalogo?: EventoCatalogoEntrada[] } = {}): Sql {
  const base = mkdtempSync(join(tmpdir(), 'we-noticias-'))
  const p = fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'].map((s) => time(s)) })
  if (opcoes.fator) p.regras = { noticias: { fator_chance: opcoes.fator, maximo_por_avaliacao: 2 } }
  if (opcoes.catalogo) p.noticias = CatalogoSchema.parse(opcoes.catalogo)
  escreverPacote(join(base, 'pacotes', 'teste'), p)
  const c = new Carreiras({
    pastaCarreiras: () => join(base, 'carreiras'),
    pastaPacotes: () => join(base, 'pacotes'),
    abrirBanco: abrirNodeSqlite,
    lerResumoArquivo: () => null,
    sementeNova: () => opcoes.semente ?? 11,
    agora: () => '2026-11-13T00:00:00Z',
    sufixoId: () => 'n1',
  })
  c.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'N', dificuldade: 'normal' })
  return c.sql()
}

function temporadaInteira(sql: Sql): void {
  for (let i = 0; i < 200 && !calendario(sql).encerrada; i++) avancar(sql)
  expect(calendario(sql).encerrada).toBe(true)
}

const codigo = (f: () => unknown) => {
  try {
    f()
    return null
  } catch (e) {
    return e instanceof ErroApp ? e.codigo : (e as Error).message
  }
}

const escolhaSempre: EventoCatalogoEntrada = {
  id: 'dilema',
  tipo: 'elenco',
  gatilho: { momento: 'semana', condicoes: [] },
  alvo: 'jogador_aleatorio_do_usuario',
  chance: 1,
  intervalo_minimo_semanas: 100,
  texto: '{jogador} pede para sair. E agora?',
  escolhas: [
    { id: 'segurar', texto: 'Segurar', resultado: 'Ele fica, chateado.', efeitos: [{ campo: 'moral', delta: -20 }] },
    { id: 'liberar', texto: 'Liberar', efeitos: [{ campo: 'confianca', delta: -5 }] },
  ],
}

describe('notícias na carreira', () => {
  it('carreira nova já traz as metas da diretoria na caixa', () => {
    const sql = criar()
    const c = caixa(sql)
    expect(c.noticias).toHaveLength(1)
    expect(c.noticias[0]).toMatchObject({ tipo: 'diretoria', origem: 'info', lida: false, pendente: false })
    expect(c.noticias[0]!.texto).toMatch(/^Metas da diretoria para 2026/)
    marcarLidas(sql, null)
    expect(caixa(sql).naoLidas).toBe(0)
  })

  it('evento com escolha interrompe o Continuar; a resposta aplica os efeitos e fica auditável', () => {
    const sql = criar({ catalogo: [escolhaSempre] })
    // A semana 1 passa (sem jogo) e o evento semanal surge: o Continuar para nele.
    const r = continuar(sql)
    expect(r).toMatchObject({ eventoPendente: true, passosJogados: 0, semana: 1 })
    expect(codigo(() => continuar(sql))).toBe('evento_pendente')

    const [n] = caixa(sql).noticias.filter((x) => x.pendente)
    expect(n).toMatchObject({ evento: 'dilema', origem: 'evento', escolhas: [{ id: 'segurar', texto: 'Segurar' }, { id: 'liberar', texto: 'Liberar' }] })
    const moralAntes = sql.get<{ moral: number }>('SELECT moral FROM jogador WHERE id = ?', Number(n!.jogadorId))!.moral

    expect(codigo(() => responderEvento(sql, n!.id, 'fugir'))).toBe('escolha_invalida')
    responderEvento(sql, n!.id, 'segurar')
    const linha = sql.get<{ efeitos_aplicados: string; escolha_feita: string; pendente: number }>('SELECT efeitos_aplicados, escolha_feita, pendente FROM noticia WHERE id = ?', n!.id)!
    const efeitos = JSON.parse(linha.efeitos_aplicados) as EfeitoAplicado[]
    expect(efeitos).toEqual([{ efeito: { campo: 'moral', jogador: n!.jogadorId, delta: -20 }, antes: moralAntes, depois: moralAntes - 20 }])
    expect(sql.get<{ moral: number }>('SELECT moral FROM jogador WHERE id = ?', Number(n!.jogadorId))!.moral).toBe(moralAntes - 20)
    expect(linha).toMatchObject({ escolha_feita: 'segurar', pendente: 0 })
    const depois = caixa(sql).noticias.find((x) => x.id === n!.id)!
    expect(depois.texto).toMatch(/Ele fica, chateado\.$/)
    expect(depois.efeitos[0]).toMatch(/^Moral de .*: \d+ → \d+$/)
    expect(codigo(() => responderEvento(sql, n!.id, 'liberar'))).toBe('noticia_sem_escolha')

    // Respondido, o Continuar volta a andar (intervalo mínimo de 100 semanas: não repete).
    expect(continuar(sql)).toMatchObject({ eventoPendente: false, semana: 2 })
    expect(continuarAtePreJogo(sql).preJogo).not.toBeNull()
  })

  it('temporada inteira com chance alta: informativas e eventos de todos os momentos, efeitos gravados', () => {
    const sql = criar({ fator: 20 })
    temporadaInteira(sql)
    responderPendentes(sql) // um evento pode surgir na última data
    const porOrigem = sql.all<{ origem: string; n: number }>('SELECT origem, COUNT(*) n FROM noticia GROUP BY origem')
    expect(porOrigem.find((x) => x.origem === 'info')!.n).toBeGreaterThanOrEqual(10)
    expect(porOrigem.find((x) => x.origem === 'evento')!.n).toBeGreaterThan(5)
    const textos = sql.all<{ texto: string }>("SELECT texto FROM noticia WHERE origem = 'info'").map((x) => x.texto)
    expect(textos.some((t) => /^(Vitória|Empate|Derrota) pela Liga/.test(t))).toBe(true)
    expect(textos.some((t) => /^A janela de transferências \(.+\) está aberta/.test(t))).toBe(true)
    expect(textos.some((t) => /^A janela de transferências \(.+\) fechou/.test(t))).toBe(true)
    expect(textos.some((t) => / é campeão da Liga\.|conquista a Liga/.test(t))).toBe(true)
    // Nenhum marcador sem preencher; nenhum evento ficou pendente (o helper respondeu).
    expect(sql.all<{ texto: string }>('SELECT texto FROM noticia').every((x) => !/\{\w+\}/.test(x.texto))).toBe(true)
    expect(sql.get<{ n: number }>('SELECT COUNT(*) n FROM noticia WHERE pendente = 1')!.n).toBe(0)
    // Todo evento sem escolha (ou respondido) tem o registro dos efeitos.
    const semRegistro = sql.get<{ n: number }>("SELECT COUNT(*) n FROM noticia WHERE origem = 'evento' AND efeitos_aplicados IS NULL")!.n
    expect(semRegistro).toBe(0)
    // Atributo mexido por notícia entra no histórico de evolução.
    const atributos = sql.all<{ e: string }>("SELECT efeitos_aplicados e FROM noticia WHERE efeitos_aplicados LIKE '%\"atributo\"%'")
    const evolucoes = sql.get<{ n: number }>("SELECT COUNT(*) n FROM evolucao WHERE motivo = 'noticia'")!.n
    if (atributos.length) expect(evolucoes).toBeGreaterThan(0)
  }, 120_000)

  it('mesma semente, mesmas notícias (reproduzível)', () => {
    const rodar = () => {
      const sql = criar({ semente: 5, fator: 10 })
      for (let i = 0; i < 4; i++) avancar(sql)
      return sql.all<{ texto: string; semana: number }>('SELECT semana, texto FROM noticia ORDER BY id')
    }
    const a = rodar()
    expect(a.length).toBeGreaterThan(3)
    expect(rodar()).toEqual(a)
  })

  it('destaques da volta do jogo: o resultado fica de fora; decisão pendente e notícia do elenco entram', () => {
    const sql = criar({ catalogo: [escolhaSempre] })
    const r = continuarAtePreJogo(sql)
    const j = jogarDataDoUsuario(sql)
    const semana = j.jogoDoUsuario!.semana
    expect(r.preJogo!.semana).toBe(semana)
    const lesao = sql.get<{ id: number }>("SELECT id FROM jogador j WHERE time_id = (SELECT id FROM time WHERE sigla = 'AAA') LIMIT 1")!.id
    sql.run("INSERT INTO noticia (temporada, semana, tipo, origem, texto, jogador_id, time) VALUES (2026, ?, 'elenco', 'info', 'lesão', ?, 'AAA')", semana, lesao)
    sql.run("INSERT INTO noticia (temporada, semana, tipo, origem, texto, time) VALUES (2026, ?, 'competicao', 'info', 'outro campeão', 'BBB')", semana)
    sql.run("INSERT INTO noticia (temporada, semana, tipo, origem, texto, escolhas, pendente) VALUES (2026, ?, 'torcida', 'evento', 'decida', '[]', 1)", semana)
    const d = destaquesDoJogo(sql, semana)
    const textos = d.noticias.map((n) => n.texto)
    expect(textos[0]).toBe('decida')
    expect(textos).toContain('lesão')
    expect(textos).not.toContain('outro campeão')
    expect(d.noticias.every((n) => n.tipo !== 'jogo')).toBe(true)
    expect(d.propostas).toEqual([])
    expect(caixa(sql).noticias.some((n) => n.tipo === 'jogo' && n.semana === semana)).toBe(true)
  })

  it('jogo do usuário com evento pendente também espera a resposta', () => {
    const sql = criar({ catalogo: [escolhaSempre] })
    continuar(sql) // o evento surge na semana 1, antes do 1º jogo
    expect(responderPendentes(sql)).toBe(1)
    const r = continuarAtePreJogo(sql)
    expect(r.preJogo).not.toBeNull()
    // Um novo pendente antes do jogo trava a simulação do jogo também.
    sql.run("INSERT INTO noticia (temporada, semana, tipo, origem, texto, escolhas, pendente) VALUES (2026, 11, 'elenco', 'evento', 'x', '[{\"id\":\"a\",\"texto\":\"A\",\"resultado\":null,\"efeitos\":[]},{\"id\":\"b\",\"texto\":\"B\",\"resultado\":null,\"efeitos\":[]}]', 1)")
    expect(codigo(() => jogarDataDoUsuario(sql))).toBe('evento_pendente')
  })
})

describe('ponte com evento pendente', () => {
  it('não prepara a partida do WE enquanto houver decisão pendente', async () => {
    const { preparar } = await import('../../src/main/we/ponte')
    const sql = criar({ catalogo: [escolhaSempre] })
    continuarAtePreJogo(sql)
    sql.run("INSERT INTO noticia (temporada, semana, tipo, origem, texto, escolhas, pendente) VALUES (2026, 11, 'elenco', 'evento', 'x', '[{\"id\":\"a\",\"texto\":\"A\",\"resultado\":null,\"efeitos\":[]},{\"id\":\"b\",\"texto\":\"B\",\"resultado\":null,\"efeitos\":[]}]', 1)")
    const cfg = { raiz: 'x', caminhos: { emulador: 'x', imagem: 'y', estados: 'z' }, pastaCarreira: 'x', carreiraId: 'x' }
    expect(codigo(() => preparar(sql, cfg, 'jogar'))).toBe('evento_pendente')
  })
})
