/**
 * Suspensões por competição (03-competicoes): amarelos acumulados e jogos a cumprir são
 * contados separadamente em cada competição. Padrão: 3 amarelos = 1 jogo; vermelho = 1 jogo.
 */

export interface RegraSuspensao {
  amarelos: number
  jogos: number
  vermelho_jogos: number
  /** Id da fase em que os amarelos zeram (ou null). */
  zera_na_fase: string | null
}

export const SUSPENSAO_PADRAO: RegraSuspensao = { amarelos: 3, jogos: 1, vermelho_jogos: 1, zera_na_fase: null }

export interface Disciplina {
  jogador: string
  competicao: string
  amarelos: number
  /** Jogos que ainda faltam cumprir. */
  suspenso: number
}

export interface EventoCartao {
  jogador: string
  tipo: 'amarelo' | 'vermelho'
}

const chave = (jogador: string, competicao: string) => `${jogador}|${competicao}`

export class Disciplinas {
  private readonly mapa = new Map<string, Disciplina>()

  constructor(iniciais: readonly Disciplina[] = []) {
    for (const d of iniciais) this.mapa.set(chave(d.jogador, d.competicao), { ...d })
  }

  get(jogador: string, competicao: string): Disciplina {
    return this.mapa.get(chave(jogador, competicao)) ?? { jogador, competicao, amarelos: 0, suspenso: 0 }
  }

  private set(d: Disciplina): void {
    this.mapa.set(chave(d.jogador, d.competicao), d)
  }

  estaSuspenso(jogador: string, competicao: string): boolean {
    return this.get(jogador, competicao).suspenso > 0
  }

  /**
   * Registra uma partida do time na competição. Primeiro, quem estava suspenso cumpre
   * (não jogou esta partida); depois entram os cartões desta partida.
   * `elenco` = todos os jogadores do time no momento da partida.
   */
  registrarPartida(competicao: string, elenco: readonly string[], cartoes: readonly EventoCartao[], regra: RegraSuspensao): void {
    for (const j of elenco) {
      const d = this.get(j, competicao)
      if (d.suspenso > 0) this.set({ ...d, suspenso: d.suspenso - 1 })
    }
    // Dois amarelos no mesmo jogo chegam como 'vermelho' (o motor converte).
    for (const c of cartoes) {
      const d = this.get(c.jogador, competicao)
      if (c.tipo === 'vermelho') {
        this.set({ ...d, suspenso: d.suspenso + regra.vermelho_jogos })
      } else {
        const amarelos = d.amarelos + 1
        if (amarelos >= regra.amarelos) this.set({ ...d, amarelos: 0, suspenso: d.suspenso + regra.jogos })
        else this.set({ ...d, amarelos })
      }
    }
  }

  /** Começo de fase: zera os amarelos da competição se a regra mandar. */
  iniciarFase(competicao: string, fase: string, regra: RegraSuspensao): void {
    if (regra.zera_na_fase !== fase) return
    for (const d of this.mapa.values()) if (d.competicao === competicao && d.amarelos > 0) this.set({ ...d, amarelos: 0 })
  }

  todas(): Disciplina[] {
    return [...this.mapa.values()].filter((d) => d.amarelos > 0 || d.suspenso > 0)
  }
}
