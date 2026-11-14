/**
 * Leitura do controle (Gamepad API, mapeamento "standard") e do teclado, convertida em
 * comandos do app. A lógica de borda/repetição é pura (o tempo entra como argumento).
 */

export type Comando =
  | 'cima'
  | 'baixo'
  | 'esquerda'
  | 'direita'
  | 'confirmar'
  | 'voltar'
  | 'acaoX'
  | 'acaoY'
  | 'secaoAnterior'
  | 'secaoProxima'
  | 'abaAnterior'
  | 'abaProxima'
  | 'continuar'

export const DIRECOES = ['cima', 'baixo', 'esquerda', 'direita'] as const

/** Botões do mapeamento standard → comando. */
export const MAPA_BOTOES: Readonly<Record<number, Comando>> = {
  0: 'confirmar', // A
  1: 'voltar', // B
  2: 'acaoX', // X
  3: 'acaoY', // Y
  4: 'secaoAnterior', // LB
  5: 'secaoProxima', // RB
  6: 'abaAnterior', // LT
  7: 'abaProxima', // RT
  9: 'continuar', // START
  12: 'cima',
  13: 'baixo',
  14: 'esquerda',
  15: 'direita',
}

/** Teclado espelha o controle. Enter e Tab ficam com o comportamento nativo. */
export const MAPA_TECLAS: Readonly<Record<string, Comando>> = {
  ArrowUp: 'cima',
  ArrowDown: 'baixo',
  ArrowLeft: 'esquerda',
  ArrowRight: 'direita',
  Escape: 'voltar',
  Backspace: 'voltar',
  x: 'acaoX',
  y: 'acaoY',
  q: 'secaoAnterior',
  e: 'secaoProxima',
  PageUp: 'abaAnterior',
  PageDown: 'abaProxima',
  ' ': 'continuar',
}

/** Rótulo da tecla do controle para o rodapé de atalhos. */
export const ROTULO_CONTROLE: Readonly<Record<Comando, string>> = {
  cima: '↑',
  baixo: '↓',
  esquerda: '←',
  direita: '→',
  confirmar: 'A',
  voltar: 'B',
  acaoX: 'X',
  acaoY: 'Y',
  secaoAnterior: 'LB',
  secaoProxima: 'RB',
  abaAnterior: 'LT',
  abaProxima: 'RT',
  continuar: 'START',
}

export interface EstadoControle {
  botoes: readonly boolean[]
  eixos: readonly number[]
}

export interface OpcoesLeitor {
  /** Quanto tempo segurando uma direção até começar a repetir (ms). */
  atrasoRepeticao: number
  /** Intervalo entre repetições (ms). */
  intervaloRepeticao: number
  /** Zona morta do analógico (0 a 1). */
  zonaMorta: number
}

export const OPCOES_PADRAO: OpcoesLeitor = { atrasoRepeticao: 380, intervaloRepeticao: 110, zonaMorta: 0.5 }

const REPETEM: ReadonlySet<Comando> = new Set(DIRECOES)

/** Comandos pressionados agora (botões + analógico esquerdo como direcional). */
export function comandosAtivos(estado: EstadoControle, zonaMorta: number): Set<Comando> {
  const ativos = new Set<Comando>()
  estado.botoes.forEach((apertado, i) => {
    const c = MAPA_BOTOES[i]
    if (apertado && c) ativos.add(c)
  })
  const [x = 0, y = 0] = estado.eixos
  if (Math.abs(x) >= zonaMorta || Math.abs(y) >= zonaMorta) {
    if (Math.abs(x) >= Math.abs(y)) ativos.add(x > 0 ? 'direita' : 'esquerda')
    else ativos.add(y > 0 ? 'baixo' : 'cima')
  }
  return ativos
}

/**
 * Transforma leituras sucessivas do controle em comandos: dispara na borda (ao apertar)
 * e, para as direções, repete enquanto segurar.
 */
export class LeitorControle {
  private readonly desde = new Map<Comando, number>()
  private readonly ultimoDisparo = new Map<Comando, number>()

  constructor(private readonly opcoes: OpcoesLeitor = OPCOES_PADRAO) {}

  atualizar(estado: EstadoControle, agoraMs: number): Comando[] {
    const ativos = comandosAtivos(estado, this.opcoes.zonaMorta)
    const saida: Comando[] = []
    for (const c of [...this.desde.keys()]) {
      if (!ativos.has(c)) {
        this.desde.delete(c)
        this.ultimoDisparo.delete(c)
      }
    }
    for (const c of ativos) {
      const inicio = this.desde.get(c)
      if (inicio === undefined) {
        this.desde.set(c, agoraMs)
        this.ultimoDisparo.set(c, agoraMs)
        saida.push(c)
        continue
      }
      if (!REPETEM.has(c)) continue
      const ultimo = this.ultimoDisparo.get(c) ?? inicio
      const proximo = ultimo === inicio ? inicio + this.opcoes.atrasoRepeticao : ultimo + this.opcoes.intervaloRepeticao
      if (agoraMs >= proximo) {
        this.ultimoDisparo.set(c, agoraMs)
        saida.push(c)
      }
    }
    return saida
  }

  reiniciar(): void {
    this.desde.clear()
    this.ultimoDisparo.clear()
  }
}
