import { Disciplinas } from '@core/competicoes/suspensoes'
import { Elencos, type InfoTime, type JogadorCarreira } from '@core/partida/sessao'
import { FOCOS_TREINO, type FocoTreino } from '@core/config/padroes'
import type { EscalacaoSalva } from '@core/partida/escalacaoSalva'
import type { Atributos, Posicao } from '@shared/esquemas/pacote'
import type { Sql } from '../sql'

/** Ocupação provisória do estádio até o público de verdade (fase 6). */
export const OCUPACAO_PROVISORIA = 0.6

interface LinhaJogador {
  id: number
  sigla: string
  nome: string
  posicao: Posicao
  posicao_secundaria: Posicao | null
  atributos: string
  condicao: number
  moral: number
  resistencia: number
  potencial: number
  idade: number
  camisa: number
  lesao_dias: number
}

const focoValido = (f: string | null): FocoTreino | null => (f && (FOCOS_TREINO as readonly string[]).includes(f) ? (f as FocoTreino) : null)

/** Carrega os elencos no dia implícito `dia` (o do último passo jogado). */
export function carregarElencos(sql: Sql, dia = 0): Elencos {
  const jogadores: JogadorCarreira[] = sql
    .all<LinhaJogador>(
      `SELECT j.id, t.sigla, j.nome_we AS nome, j.posicao, j.posicao_secundaria, j.atributos, j.condicao, j.moral,
              j.resistencia, j.potencial, j.idade, j.camisa, j.lesao_dias
         FROM jogador j JOIN time t ON t.id = j.time_id
        WHERE j.status = 'ativo'`,
    )
    .map((l) => ({
      id: String(l.id),
      time: l.sigla,
      nome: l.nome,
      posicao: l.posicao,
      posicaoSecundaria: l.posicao_secundaria,
      atributos: JSON.parse(l.atributos) as Atributos,
      condicao: l.condicao,
      moral: l.moral,
      resistencia: l.resistencia,
      potencial: l.potencial,
      idade: l.idade,
      camisa: l.camisa,
      lesaoDias: l.lesao_dias,
    }))
  const times = new Map<string, InfoTime>(
    sql
      .all<{ sigla: string; formacao: string; entrosamento: number; treino_foco: string | null; escalacao: string | null }>(
        'SELECT sigla, formacao, entrosamento, treino_foco, escalacao FROM time',
      )
      .map((t) => [
        t.sigla,
        {
          formacao: t.formacao,
          entrosamento: t.entrosamento,
          ocupacao: OCUPACAO_PROVISORIA,
          foco: focoValido(t.treino_foco),
          escalacao: t.escalacao ? (JSON.parse(t.escalacao) as EscalacaoSalva) : null,
        },
      ]),
  )
  const disciplinas = new Disciplinas(
    sql
      .all<{ jogador_id: number; competicao_id: string; amarelos: number; suspenso: number }>('SELECT * FROM disciplina')
      .map((d) => ({ jogador: String(d.jogador_id), competicao: d.competicao_id, amarelos: d.amarelos, suspenso: d.suspenso })),
  )
  return new Elencos(jogadores, times, disciplinas, dia)
}

/** Grava o que mudou: condição, lesão, moral e atributos; entrosamento; disciplina; histórico de evolução. */
export function gravarElencos(sql: Sql, e: Elencos, temporada: number): void {
  for (const id of e.alterados) {
    const j = e.jogadores.get(id)
    if (!j) continue
    sql.run(
      'UPDATE jogador SET condicao = ?, lesao_dias = ?, moral = ?, atributos = ?, potencial = ? WHERE id = ?',
      Math.round(j.condicao), j.lesaoDias, Math.round(j.moral), JSON.stringify(j.atributos), j.potencial, Number(id),
    )
  }
  e.alterados.clear()
  for (const sigla of e.timesAlterados) {
    const t = e.times.get(sigla)
    if (t) sql.run('UPDATE time SET entrosamento = ? WHERE sigla = ?', Math.round(t.entrosamento * 10) / 10, sigla)
  }
  e.timesAlterados.clear()
  for (const ev of e.evolucoes.splice(0)) {
    sql.run(
      'INSERT INTO evolucao (temporada, semana, jogador_id, atributo, delta, motivo) VALUES (?, ?, ?, ?, ?, ?)',
      temporada, ev.semana, Number(ev.jogador), ev.atributo, ev.delta, ev.motivo,
    )
  }
  sql.run('DELETE FROM disciplina')
  for (const d of e.disciplinas.todas()) {
    sql.run('INSERT INTO disciplina (jogador_id, competicao_id, amarelos, suspenso) VALUES (?, ?, ?, ?)', Number(d.jogador), d.competicao, d.amarelos, d.suspenso)
  }
}
