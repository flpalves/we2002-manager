import type { Api, Canal, Entrada, Saida } from '@shared/esquemas/ipc'

declare global {
  interface Window {
    api: Api
  }
}

export class ErroApi extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

/** Chama o main e devolve os dados, ou lança `ErroApi`. */
export async function chamar<C extends Canal>(canal: C, entrada: Entrada<C>): Promise<Saida<C>> {
  // Proxies reativos do Vue não passam pelo contextBridge (structured clone): manda uma cópia simples.
  const simples = entrada === undefined ? entrada : (JSON.parse(JSON.stringify(entrada)) as Entrada<C>)
  const r = await window.api.invocar(canal, simples)
  if (!r.ok) throw new ErroApi(r.erro.codigo, r.erro.mensagem)
  return r.dados
}
