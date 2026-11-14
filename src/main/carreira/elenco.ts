import { FOCOS_TREINO, type FocoTreino, type Regras } from '@core/config/padroes'
import { geral, BASE_EXIBICAO_WE } from '@core/jogadores/conversao'
import { nivelWeNaPartida, seta } from '@core/jogadores/setas'
import { faixaPotencial } from '@core/jogadores/potencial'
import { ATRIBUTOS, AparenciaSchema, type Aparencia, type Atributos } from '@shared/esquemas/pacote'
import type { Elenco, Evolucao, FichaJogador, JogadorElenco, Treino } from '@shared/esquemas/elenco'
import { ErroApp } from '../ipc/registrar'
import type { Sql } from '../db/sql'

/** Elenco, ficha do jogador e treino do time do usuário (as contas vêm do núcleo). */

interface LinhaJogador {
  id: number
  chave: string
  nome: string
  nome_we: string
  posicao: string
  posicao_secundaria: string | null
  camisa: number
  idade: number
  nacionalidade: string
  atributos: string
  condicao: number
  moral: number
  lesao_dias: number
  potencial: number
  pe: string
  altura: number
  outside: number
  aparencia: string | null
  sigla: string
  ate_temporada: number | null
  salario_mensal: number | null
  valor: number
}

const SELECT_JOGADOR = `
  SELECT j.id, j.chave, j.nome, j.nome_we, j.posicao, j.posicao_secundaria, j.camisa, j.idade, j.nacionalidade, j.atributos,
         j.condicao, j.moral, j.lesao_dias, j.potencial, j.pe, j.altura, j.outside, j.aparencia, t.sigla,
         c.ate_temporada, c.salario_mensal, j.valor
    FROM jogador j JOIN time t ON t.id = j.time_id
    LEFT JOIN contrato c ON c.jogador_id = j.id`

function regrasDe(sql: Sql): Regras {
  return JSON.parse(sql.get<{ dados: string }>('SELECT dados FROM regras WHERE id = 1')!.dados) as Regras
}

function carreira(sql: Sql) {
  return sql.get<{ time_usuario: string; semente: number; temporada_atual: number }>('SELECT time_usuario, semente, temporada_atual FROM carreira')!
}

function nomesCompeticoes(sql: Sql): Map<string, string> {
  return new Map(sql.all<{ id: string; nome: string }>('SELECT id, nome FROM competicao').map((c) => [c.id, c.nome]))
}

type Disciplina = { competicao_id: string; amarelos: number; suspenso: number }

function paraElenco(l: LinhaJogador, regras: Regras, disciplina: Disciplina[], nomes: Map<string, string>, amarelosParaSuspender: (competicao: string) => number): JogadorElenco {
  const atributos = JSON.parse(l.atributos) as Atributos
  return {
    id: String(l.id),
    nome: l.nome,
    nomeWe: l.nome_we,
    posicao: l.posicao,
    posicaoSecundaria: l.posicao_secundaria,
    camisa: l.camisa,
    idade: l.idade,
    nacionalidade: l.nacionalidade,
    geral: geral(atributos, l.posicao, regras),
    condicao: Math.round(l.condicao),
    moral: Math.round(l.moral),
    seta: seta(l.condicao, l.moral, regras),
    lesaoSemanas: Math.ceil(l.lesao_dias / 7),
    suspenso: disciplina.filter((d) => d.suspenso > 0).map((d) => nomes.get(d.competicao_id) ?? d.competicao_id),
    pendurado: disciplina
      .filter((d) => d.suspenso === 0 && d.amarelos > 0 && d.amarelos === amarelosParaSuspender(d.competicao_id) - 1)
      .map((d) => nomes.get(d.competicao_id) ?? d.competicao_id),
    contratoAte: l.ate_temporada,
    salario: l.salario_mensal ?? 0,
    valor: l.valor,
  }
}

/** Amarelos que dão suspensão em cada competição (padrão 3). */
function amarelosParaSuspender(sql: Sql): (competicao: string) => number {
  const mapa = new Map(
    sql.all<{ id: string; definicao: string }>('SELECT id, definicao FROM competicao').map((c) => {
      const def = JSON.parse(c.definicao) as { suspensao?: { amarelos: number } }
      return [c.id, def.suspensao?.amarelos ?? 3]
    }),
  )
  return (id) => mapa.get(id) ?? 3
}

export function elenco(sql: Sql, sigla?: string): Elenco {
  const c = carreira(sql)
  const time = sigla ?? c.time_usuario
  const regras = regrasDe(sql)
  const nomes = nomesCompeticoes(sql)
  const suspende = amarelosParaSuspender(sql)
  const disciplina = sql.all<{ jogador_id: number; competicao_id: string; amarelos: number; suspenso: number }>('SELECT * FROM disciplina')
  const linhas = sql.all<LinhaJogador>(`${SELECT_JOGADOR} WHERE t.sigla = ? AND j.status = 'ativo' ORDER BY j.camisa`, time)
  const entrosamento = sql.get<{ entrosamento: number }>('SELECT entrosamento FROM time WHERE sigla = ?', time)?.entrosamento ?? 50
  return {
    time,
    entrosamento,
    jogadores: linhas.map((l) => paraElenco(l, regras, disciplina.filter((d) => d.jogador_id === l.id), nomes, suspende)),
  }
}

function evolucoes(sql: Sql, temporada: number, filtro: { jogador?: number; time?: string }, limite: number): Evolucao[] {
  const onde = filtro.jogador !== undefined ? 'e.jogador_id = ?' : 't.sigla = ?'
  const param = filtro.jogador !== undefined ? filtro.jogador : filtro.time!
  return sql
    .all<{ semana: number; jogador_id: number; nome: string; atributo: string; delta: number; motivo: string }>(
      `SELECT e.semana, e.jogador_id, j.nome, e.atributo, e.delta, e.motivo
         FROM evolucao e JOIN jogador j ON j.id = e.jogador_id JOIN time t ON t.id = j.time_id
        WHERE e.temporada = ? AND ${onde}
        ORDER BY e.semana DESC, e.id DESC LIMIT ?`,
      temporada, param, limite,
    )
    .map((e) => ({ semana: e.semana, jogadorId: String(e.jogador_id), jogador: e.nome, atributo: e.atributo, delta: e.delta, motivo: e.motivo }))
}

export function ficha(sql: Sql, id: string): FichaJogador {
  const c = carreira(sql)
  const regras = regrasDe(sql)
  const nomes = nomesCompeticoes(sql)
  const suspende = amarelosParaSuspender(sql)
  const l = sql.get<LinhaJogador>(`${SELECT_JOGADOR} WHERE j.id = ?`, Number(id))
  if (!l) throw new ErroApp('jogador_inexistente', 'Jogador não encontrado.')
  const disciplina = sql.all<{ jogador_id: number; competicao_id: string; amarelos: number; suspenso: number }>('SELECT * FROM disciplina WHERE jogador_id = ?', l.id)
  const atributos = JSON.parse(l.atributos) as Atributos
  const historico = sql.all<{ competicao: string; jogos: number; minutos: number; gols: number; assistencias: number; amarelos: number; vermelhos: number }>(
    `SELECT co.nome AS competicao,
            COUNT(*) AS jogos, SUM(x.minutos) AS minutos,
            (SELECT COUNT(*) FROM evento_partida e JOIN partida p2 ON p2.id = e.partida_id JOIN edicao ed2 ON ed2.id = p2.edicao_id
              WHERE e.tipo = 'gol' AND e.jogador_id = x.jogador_id AND ed2.competicao_id = co.id AND p2.temporada = ?) AS gols,
            (SELECT COUNT(*) FROM evento_partida e JOIN partida p2 ON p2.id = e.partida_id JOIN edicao ed2 ON ed2.id = p2.edicao_id
              WHERE e.tipo = 'gol' AND e.outro_id = x.jogador_id AND ed2.competicao_id = co.id AND p2.temporada = ?) AS assistencias,
            (SELECT COUNT(*) FROM evento_partida e JOIN partida p2 ON p2.id = e.partida_id JOIN edicao ed2 ON ed2.id = p2.edicao_id
              WHERE e.tipo = 'amarelo' AND e.jogador_id = x.jogador_id AND ed2.competicao_id = co.id AND p2.temporada = ?) AS amarelos,
            (SELECT COUNT(*) FROM evento_partida e JOIN partida p2 ON p2.id = e.partida_id JOIN edicao ed2 ON ed2.id = p2.edicao_id
              WHERE e.tipo = 'vermelho' AND e.jogador_id = x.jogador_id AND ed2.competicao_id = co.id AND p2.temporada = ?) AS vermelhos
       FROM escalacao_partida x JOIN partida p ON p.id = x.partida_id JOIN edicao ed ON ed.id = p.edicao_id JOIN competicao co ON co.id = ed.competicao_id
      WHERE x.jogador_id = ? AND p.temporada = ?
      GROUP BY co.id ORDER BY co.rowid`,
    c.temporada_atual, c.temporada_atual, c.temporada_atual, c.temporada_atual, l.id, c.temporada_atual,
  )
  return {
    ...paraElenco(l, regras, disciplina, nomes, suspende),
    time: l.sigla,
    pe: l.pe,
    altura: l.altura,
    outside: !!l.outside,
    atributos: { ...atributos },
    atributosWe: Object.fromEntries(ATRIBUTOS.map((a) => [a, nivelWeNaPartida(atributos[a], l.condicao, regras) + BASE_EXIBICAO_WE])),
    potencial: faixaPotencial(l.potencial, l.idade, c.semente, l.chave, regras),
    aparencia: l.aparencia ? (JSON.parse(l.aparencia) as Aparencia) : null,
    historico,
    evolucoes: evolucoes(sql, c.temporada_atual, { jogador: l.id }, 20),
  }
}

/** Edita a aparência (vai para o WE pela ponte); `null` = usar a do jogador original da vaga. */
export function salvarAparencia(sql: Sql, id: string, aparencia: Aparencia | null): FichaJogador {
  const valida = aparencia === null ? null : AparenciaSchema.parse(aparencia)
  const r = sql.run('UPDATE jogador SET aparencia = ? WHERE id = ?', valida ? JSON.stringify(valida) : null, Number(id))
  if (Number(r.changes) === 0) throw new ErroApp('jogador_inexistente', 'Jogador não encontrado.')
  return ficha(sql, id)
}

export function treino(sql: Sql): Treino {
  const c = carreira(sql)
  const regras = regrasDe(sql)
  const t = sql.get<{ treino_foco: string | null; entrosamento: number }>('SELECT treino_foco, entrosamento FROM time WHERE sigla = ?', c.time_usuario)!
  const medias = sql.get<{ condicao: number; moral: number; lesionados: number }>(
    `SELECT AVG(j.condicao) AS condicao, AVG(j.moral) AS moral, SUM(CASE WHEN j.lesao_dias > 0 THEN 1 ELSE 0 END) AS lesionados
       FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.status = 'ativo'`,
    c.time_usuario,
  )!
  const foco = (FOCOS_TREINO as readonly string[]).includes(t.treino_foco ?? '') ? (t.treino_foco as FocoTreino) : 'tecnico'
  return {
    foco,
    focos: FOCOS_TREINO.map((f) => {
      const d = regras.treino.focos[f]
      return { id: f, atributos: [...d.atributos, ...(d.so_goleiro ?? [])], recuperacao: d.recuperacao, lesao: d.lesao, entrosamento: d.entrosamento }
    }),
    entrosamento: t.entrosamento,
    condicaoMedia: Math.round(medias.condicao ?? 0),
    moralMedia: Math.round(medias.moral ?? 0),
    lesionados: medias.lesionados ?? 0,
    evolucoes: evolucoes(sql, c.temporada_atual, { time: c.time_usuario }, 30),
  }
}

export function definirFoco(sql: Sql, foco: FocoTreino): Treino {
  const c = carreira(sql)
  sql.run('UPDATE time SET treino_foco = ? WHERE sigla = ?', foco, c.time_usuario)
  return treino(sql)
}
