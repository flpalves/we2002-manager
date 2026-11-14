/**
 * Janelas de transferência (06-mercado): intervalos de semanas da temporada em que o mercado
 * abre para compras e empréstimos. Fora delas só jogadores livres e renovações.
 * Configuráveis no pacote (`regras.json`, `mercado.janelas`); padrão em `config/padroes.ts`.
 */

export interface JanelaTransferencia {
  semana_inicio: number
  semana_fim: number
  /** Nome para a interface (ex.: "Início da temporada"). */
  nome?: string
}

export interface ProblemaJanela {
  nivel: 'erro' | 'aviso'
  codigo: string
  mensagem: string
}

const rotulo = (j: JanelaTransferencia, i: number) => j.nome?.trim() || `Janela ${i + 1}`

/** A janela que contém a semana (ou null). */
export function janelaDaSemana<J extends JanelaTransferencia>(janelas: readonly J[], semana: number): J | null {
  return janelas.find((j) => semana >= j.semana_inicio && semana <= j.semana_fim) ?? null
}

/** Ordena por início (a interface e as notícias mostram nessa ordem). */
export function ordenarJanelas<J extends JanelaTransferencia>(janelas: readonly J[]): J[] {
  return [...janelas].sort((a, b) => a.semana_inicio - b.semana_inicio || a.semana_fim - b.semana_fim)
}

/** Valida as janelas contra a duração da temporada. */
export function validarJanelas(janelas: readonly JanelaTransferencia[], semanas: number): ProblemaJanela[] {
  const p: ProblemaJanela[] = []
  const erro = (codigo: string, mensagem: string) => p.push({ nivel: 'erro', codigo, mensagem })
  if (!janelas.length) {
    p.push({ nivel: 'aviso', codigo: 'sem_janela', mensagem: 'Sem janela de transferências: o ano todo só jogadores livres e renovações.' })
    return p
  }
  janelas.forEach((j, i) => {
    const r = rotulo(j, i)
    if (!Number.isInteger(j.semana_inicio) || !Number.isInteger(j.semana_fim)) return void erro('janela_invalida', `${r}: semanas precisam ser números inteiros.`)
    if (j.semana_inicio > j.semana_fim) erro('janela_invalida', `${r}: começa na semana ${j.semana_inicio} e termina antes, na ${j.semana_fim}.`)
    if (j.semana_inicio < 1 || j.semana_fim > semanas) erro('janela_invalida', `${r}: semanas ${j.semana_inicio}-${j.semana_fim} fora da temporada (1-${semanas}).`)
  })
  const ordenadas = ordenarJanelas(janelas.map((j, i) => ({ ...j, nome: rotulo(j, i) })))
  for (let i = 1; i < ordenadas.length; i++) {
    const a = ordenadas[i - 1]!
    const b = ordenadas[i]!
    if (b.semana_inicio <= a.semana_fim) erro('janelas_sobrepostas', `${a.nome} e ${b.nome} se sobrepõem (semana ${b.semana_inicio}).`)
    else if (b.semana_inicio === a.semana_fim + 1) {
      p.push({ nivel: 'aviso', codigo: 'janelas_coladas', mensagem: `${a.nome} e ${b.nome} estão coladas: na prática são uma janela só.` })
    }
  }
  return p
}
