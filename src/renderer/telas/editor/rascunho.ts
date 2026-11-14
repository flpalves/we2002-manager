import { toRaw } from 'vue'

/** Cópia profunda e desligada da store (os proxies do Vue não passam pelo structuredClone). */
export function copiar<T>(v: T): T {
  return JSON.parse(JSON.stringify(toRaw(v))) as T
}

export function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
