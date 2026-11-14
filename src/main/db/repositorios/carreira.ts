import type { DadosCarreiraNova } from '@core/pacote/importar'
import type { Sql } from '../sql'

const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v))

/** Grava a carreira nova inteira numa transação. */
export function gravarCarreiraNova(sql: Sql, dados: DadosCarreiraNova, versaoEsquema: number): void {
  sql.transacao(() => {
    const c = dados.carreira
    sql.run(
      `INSERT INTO carreira (id, nome, pacote_id, pacote_versao, semente, tecnico_nome, time_usuario, dificuldade,
         temporada_atual, semana_atual, passo_atual, versao_esquema, criada_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      c.id, c.nome, c.pacote_id, c.pacote_versao, c.semente, c.tecnico_nome, c.time_usuario, c.dificuldade,
      c.temporada_atual, versaoEsquema, c.criada_em,
    )
    sql.run('INSERT INTO regras (id, dados) VALUES (1, ?)', JSON.stringify(dados.regras))
    sql.run("INSERT INTO configuracao (chave, valor) VALUES ('temporada_blocos', ?)", JSON.stringify(dados.blocos))
    sql.run("INSERT INTO configuracao (chave, valor) VALUES ('catalogo_noticias', ?)", JSON.stringify(dados.catalogo))

    for (const p of dados.paises) sql.run('INSERT INTO pais (codigo, nome, fator_valor) VALUES (?, ?, ?)', p.codigo, p.nome, p.fator_valor)

    const idTime = new Map<string, number>()
    for (const t of dados.times) {
      const r = sql.run(
        `INSERT INTO time (sigla, nome, nome_curto, pais, estado, cores, porte, formacao, estadio_nome, estadio_capacidade,
           ingresso, custo_por_jogo, saldo, patrocinio_temporada, orcamento_folha_mensal, kit, kit_reserva, kit_goleiro, bandeira, escudo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.sigla, t.nome, t.nome_curto, t.pais, t.estado, JSON.stringify(t.cores), t.porte, t.formacao, t.estadio_nome,
        t.estadio_capacidade, t.ingresso, t.custo_por_jogo, t.saldo, t.patrocinio_temporada, t.orcamento_folha_mensal,
        json(t.kit), json(t.kit_reserva), json(t.kit_goleiro), json(t.bandeira), t.escudo,
      )
      idTime.set(t.sigla, Number(r.lastInsertRowid))
    }

    for (const j of dados.jogadores) {
      // Sem clube: gravados a partir da migração 013 (passo 3 da 9.2).
      if (j.time === null || !j.contrato) continue
      const timeId = idTime.get(j.time)
      if (timeId === undefined) throw new Error(`Jogador ${j.chave} de time inexistente (${j.time})`)
      const r = sql.run(
        `INSERT INTO jogador (chave, time_id, nome, nome_we, posicao, posicao_secundaria, camisa, camisa_real, idade,
           nacionalidade, pe, altura, atributos, outside, potencial, resistencia, moral, aparencia)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        j.chave, timeId, j.nome, j.nome_we, j.posicao, j.posicao_secundaria, j.camisa, j.camisa_real, j.idade,
        j.nacionalidade, j.pe, j.altura, JSON.stringify(j.atributos), j.outside, j.potencial, j.resistencia, j.moral, json(j.aparencia),
      )
      sql.run(
        'INSERT INTO contrato (jogador_id, time_id, salario_mensal, ate_temporada, multa) VALUES (?, ?, ?, ?, ?)',
        Number(r.lastInsertRowid), timeId, j.contrato.salario_mensal, j.contrato.ate_temporada, j.contrato.multa,
      )
    }

    // O time do usuário começa com treino Técnico; os da CPU ficam com a IA (NULL).
    sql.run("UPDATE time SET treino_foco = 'tecnico' WHERE sigla = ?", c.time_usuario)
    // Confiança inicial da diretoria (regras do pacote).
    sql.run('UPDATE time SET confianca_diretoria = ? WHERE sigla = ?', dados.regras.diretoria.confianca_inicial, c.time_usuario)

    for (const comp of dados.competicoes) {
      sql.run('INSERT INTO competicao (id, nome, tipo, definicao) VALUES (?, ?, ?, ?)', comp.id, comp.nome, comp.tipo, JSON.stringify(comp.definicao))
    }
  })
}

export interface LinhaResumo {
  id: string
  nome: string
  tecnico_nome: string
  pacote_id: string
  dificuldade: string
  temporada_atual: number
  semana_atual: number
  criada_em: string
  sigla: string
  time_nome: string
  cores: string
  escudo: string | null
  saldo: number
}

/** Dados da barra superior e da lista de carreiras. */
export function lerResumo(sql: Sql): LinhaResumo | undefined {
  return sql.get<LinhaResumo>(
    `SELECT c.id, c.nome, c.tecnico_nome, c.pacote_id, c.dificuldade, c.temporada_atual, c.semana_atual, c.criada_em,
            t.sigla, t.nome AS time_nome, t.cores, t.escudo, t.saldo
       FROM carreira c JOIN time t ON t.sigla = c.time_usuario`,
  )
}
