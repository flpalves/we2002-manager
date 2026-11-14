import type { Ref } from 'vue'

/** Ações de LT/RT para percorrer uma lista de abas. */
export function acoesAbas<T extends string>(atual: Ref<T>, ids: () => readonly T[]) {
  const mover = (passo: number) => {
    const lista = ids()
    const i = lista.indexOf(atual.value)
    const proxima = lista[(i + passo + lista.length) % lista.length]
    if (proxima !== undefined) atual.value = proxima
  }
  return { abaAnterior: () => mover(-1), abaProxima: () => mover(1) }
}
