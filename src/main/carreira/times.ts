import type { Regras } from '@core/config/padroes'
import { papeisDa } from '@core/partida/formacoes'
import { escalarTime } from '@core/partida/sessao'
import type { DetalheTime, ListaTransferencias } from '@shared/esquemas/time'
import { carregarElencos } from '../db/repositorios/elencos'
import { ErroApp } from '../ipc/registrar'
import type { Sql } from '../db/sql'
import { elenco } from './elenco'
import { proximoJogo } from './escalacao'

/** Página de qualquer clube da carreira (elenco + escalação provável) e o histórico de transferências. */

function regrasDe(sql: Sql): Regras {
  return JSON.parse(sql.get<{ dados: string }>('SELECT dados FROM regras WHERE id = 1')!.dados) as Regras
}

interface LinhaTime {
  sigla: string
  nome: string
  nome_curto: string
  pais: string
  estado: string | null
  porte: DetalheTime['porte']
  cores: string
  escudo: string | null
  estadio_nome: string
  estadio_capacidade: number
}

export function detalheTime(sql: Sql, sigla: string): DetalheTime {
  const t = sql.get<LinhaTime>(
    'SELECT sigla, nome, nome_curto, pais, estado, porte, cores, escudo, estadio_nome, estadio_capacidade FROM time WHERE sigla = ?',
    sigla,
  )
  if (!t) throw new ErroApp('time_inexistente', 'Clube não encontrado.')
  const usuario = sql.get<{ time_usuario: string }>('SELECT time_usuario FROM carreira')!.time_usuario
  const prox = proximoJogo(sql, sigla)
  let escalacao: DetalheTime['escalacao'] = null
  try {
    const e = escalarTime(carregarElencos(sql), sigla, prox?.competicao, regrasDe(sql), prox?.rodizio)
    escalacao = { formacao: e.formacao, papeis: [...papeisDa(e.formacao)], titulares: e.titulares.map((j) => j.id), reservas: e.reservas.map((j) => j.id) }
  } catch {
    escalacao = null // menos de 11 jogadores
  }
  return {
    sigla: t.sigla,
    nome: t.nome,
    nomeCurto: t.nome_curto,
    pais: t.pais,
    estado: t.estado,
    porte: t.porte,
    cores: JSON.parse(t.cores) as string[],
    escudo: t.escudo,
    estadio: { nome: t.estadio_nome, capacidade: t.estadio_capacidade },
    usuario: t.sigla === usuario,
    elenco: elenco(sql, sigla),
    escalacao,
    proximoJogo: prox ? { competicao: prox.nomeCompeticao, adversario: prox.adversario, emCasa: prox.emCasa } : null,
  }
}

/** Transferências da temporada (de todos os clubes ou só de um), da mais recente para a mais antiga. */
export function transferencias(sql: Sql, filtro: { sigla?: string; temporada?: number } = {}): ListaTransferencias {
  const atual = sql.get<{ temporada_atual: number }>('SELECT temporada_atual FROM carreira')!.temporada_atual
  const temporada = filtro.temporada ?? atual
  const sigla = filtro.sigla
  if (sigla && !sql.get('SELECT 1 FROM time WHERE sigla = ?', sigla)) throw new ErroApp('time_inexistente', 'Clube não encontrado.')
  const temporadas = new Set(sql.all<{ temporada: number }>('SELECT DISTINCT temporada FROM transferencia').map((x) => x.temporada))
  temporadas.add(atual)
  const lista = sql
    .all<{ id: number; temporada: number; semana: number; jogador_id: number; nome: string; posicao: string; nacionalidade: string; idade: number; de: string | null; para: string | null; tipo: string; valor: number; salario: number }>(
      `SELECT x.id, x.temporada, x.semana, x.jogador_id, j.nome, j.posicao, j.nacionalidade, j.idade, x.de, x.para, x.tipo, x.valor, x.salario
         FROM transferencia x JOIN jogador j ON j.id = x.jogador_id
        WHERE x.temporada = ? AND (x.de IS NULL OR x.para IS NULL OR x.de <> x.para)
          ${sigla ? 'AND (x.de = ? OR x.para = ?)' : ''}
        ORDER BY x.semana DESC, x.id DESC`,
      ...(sigla ? [temporada, sigla, sigla] : [temporada]),
    )
    .map((l) => ({
      id: l.id,
      temporada: l.temporada,
      semana: l.semana,
      jogadorId: String(l.jogador_id),
      jogador: l.nome,
      posicao: l.posicao,
      nacionalidade: l.nacionalidade,
      idade: l.idade,
      de: l.de,
      para: l.para,
      tipo: l.tipo,
      valor: l.valor,
      salario: l.salario,
    }))
  const saldo = sigla
    ? {
        gasto: lista.filter((t) => t.para === sigla).reduce((a, t) => a + t.valor, 0),
        arrecadado: lista.filter((t) => t.de === sigla).reduce((a, t) => a + t.valor, 0),
        chegadas: lista.filter((t) => t.para === sigla).length,
        saidas: lista.filter((t) => t.de === sigla).length,
      }
    : null
  return { temporada, temporadas: [...temporadas].sort((a, b) => b - a), lista, saldo }
}
