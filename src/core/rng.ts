/**
 * Gerador pseudoaleatório com semente (xoshiro128**), única fonte de aleatoriedade do núcleo.
 *
 * - `criarRng(semente)` cria o gerador raiz da carreira.
 * - `rng.derivar('partida', partidaId)` cria um gerador independente para um contexto.
 *   A derivação depende só da semente raiz e das partes, nunca de quantos números já
 *   foram sorteados: a mesma carreira e o mesmo contexto dão sempre a mesma sequência.
 */

export type ParteDerivacao = string | number

export interface EstadoRng {
  readonly raiz: number
  readonly s: readonly [number, number, number, number]
}

export interface Rng {
  /** Semente (uint32) que originou este gerador; usada nas derivações. */
  readonly raiz: number
  /** Número em [0, 1). */
  proximo(): number
  /** Inteiro uniforme em [min, max], inclusive. */
  inteiro(min: number, max: number): number
  /** `true` com probabilidade `p` (0 a 1). */
  chance(p: number): boolean
  /** Um elemento da lista (lista não vazia). */
  escolher<T>(lista: readonly T[]): T
  /** Índice sorteado proporcional aos pesos (pesos >= 0, soma > 0). */
  escolherPeso(pesos: readonly number[]): number
  /** Cópia embaralhada (Fisher-Yates). */
  embaralhar<T>(lista: readonly T[]): T[]
  /** Normal (Box-Muller) com média e desvio padrão. */
  normal(media?: number, desvio?: number): number
  /** Gerador independente para um contexto, ex.: `derivar('partida', 123)`. */
  derivar(...partes: ParteDerivacao[]): Rng
  /** Estado atual, para salvar e restaurar. */
  estado(): EstadoRng
}

const U32 = 0x1_0000_0000

/** Hash de 32 bits (FNV-1a + finalizador do murmur3) de um texto, com semente. */
export function hash32(texto: string, semente = 0): number {
  let h = (0x811c9dc5 ^ semente) >>> 0
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return fmix32(h)
}

function fmix32(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Normaliza a semente da carreira (número ou texto) para uint32. */
export function normalizarSemente(semente: number | string): number {
  if (typeof semente === 'string') return hash32(semente)
  if (!Number.isFinite(semente)) throw new Error(`Semente inválida: ${semente}`)
  // Números grandes: mistura as duas metades para não perder entropia.
  const n = Math.trunc(Math.abs(semente))
  const alto = Math.floor(n / U32) >>> 0
  const baixo = n >>> 0
  return fmix32((baixo ^ Math.imul(alto, 0x9e3779b9)) >>> 0)
}

function splitmix32(semente: number): () => number {
  let x = semente >>> 0
  return () => {
    x = (x + 0x9e3779b9) >>> 0
    let z = x
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b)
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35)
    return (z ^ (z >>> 16)) >>> 0
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}

class Xoshiro128 implements Rng {
  readonly raiz: number
  private s0: number
  private s1: number
  private s2: number
  private s3: number

  constructor(raiz: number, s?: readonly [number, number, number, number]) {
    this.raiz = raiz >>> 0
    const sm = splitmix32(this.raiz)
    const inicial = s ?? [sm(), sm(), sm(), sm()]
    this.s0 = inicial[0] >>> 0
    this.s1 = inicial[1] >>> 0
    this.s2 = inicial[2] >>> 0
    this.s3 = inicial[3] >>> 0
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1
  }

  private proximoU32(): number {
    const resultado = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0
    const t = (this.s1 << 9) >>> 0
    this.s2 = (this.s2 ^ this.s0) >>> 0
    this.s3 = (this.s3 ^ this.s1) >>> 0
    this.s1 = (this.s1 ^ this.s2) >>> 0
    this.s0 = (this.s0 ^ this.s3) >>> 0
    this.s2 = (this.s2 ^ t) >>> 0
    this.s3 = rotl(this.s3, 11)
    return resultado
  }

  proximo(): number {
    return this.proximoU32() / U32
  }

  inteiro(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`Intervalo inválido: [${min}, ${max}]`)
    }
    const faixa = max - min + 1
    if (faixa > U32) throw new Error('Intervalo grande demais')
    // Rejeição para não ter viés de módulo.
    const limite = U32 - (U32 % faixa)
    let x = this.proximoU32()
    while (x >= limite) x = this.proximoU32()
    return min + (x % faixa)
  }

  chance(p: number): boolean {
    if (p <= 0) return false
    if (p >= 1) return true
    return this.proximo() < p
  }

  escolher<T>(lista: readonly T[]): T {
    if (lista.length === 0) throw new Error('Lista vazia')
    return lista[this.inteiro(0, lista.length - 1)] as T
  }

  escolherPeso(pesos: readonly number[]): number {
    let total = 0
    for (const p of pesos) {
      if (!(p >= 0)) throw new Error(`Peso inválido: ${p}`)
      total += p
    }
    if (total <= 0) throw new Error('Soma dos pesos precisa ser maior que zero')
    let alvo = this.proximo() * total
    for (let i = 0; i < pesos.length; i++) {
      alvo -= pesos[i] as number
      if (alvo < 0) return i
    }
    // Arredondamento: último índice com peso > 0.
    for (let i = pesos.length - 1; i >= 0; i--) if ((pesos[i] as number) > 0) return i
    return pesos.length - 1
  }

  embaralhar<T>(lista: readonly T[]): T[] {
    const copia = lista.slice()
    for (let i = copia.length - 1; i > 0; i--) {
      const j = this.inteiro(0, i)
      const tmp = copia[i] as T
      copia[i] = copia[j] as T
      copia[j] = tmp
    }
    return copia
  }

  normal(media = 0, desvio = 1): number {
    // Sem guardar o segundo valor do par: o estado do gerador fica só nos 4 inteiros.
    let u = 0
    while (u === 0) u = this.proximo()
    const v = this.proximo()
    return media + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * desvio
  }

  derivar(...partes: ParteDerivacao[]): Rng {
    if (partes.length === 0) throw new Error('derivar() precisa de pelo menos um contexto')
    let h = this.raiz
    for (const parte of partes) {
      const texto = typeof parte === 'number' ? `n:${parte}` : `s:${parte}`
      h = hash32(texto, h)
    }
    return new Xoshiro128(h)
  }

  estado(): EstadoRng {
    return { raiz: this.raiz, s: [this.s0, this.s1, this.s2, this.s3] }
  }
}

export function criarRng(semente: number | string): Rng {
  return new Xoshiro128(normalizarSemente(semente))
}

export function restaurarRng(estado: EstadoRng): Rng {
  return new Xoshiro128(estado.raiz, estado.s)
}
