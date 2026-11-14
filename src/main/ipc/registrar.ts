import { contratos, descreverErroZod, falha, ok, type Canal, type Resposta, type Saida } from '@shared/esquemas/ipc'
import type { z } from 'zod'

export type Handler<C extends Canal> = (
  entrada: z.output<(typeof contratos)[C]['entrada']>,
) => Saida<C> | Promise<Saida<C>>

export type Handlers = { [C in Canal]: Handler<C> }

/** Erro de domínio com código, devolvido ao renderer como `{ ok: false }`. */
export class ErroApp extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

/**
 * Executa um handler validando entrada e saída. Independente do Electron para poder
 * ser testado: o `ipcMain.handle` só chama esta função.
 */
export async function executar<C extends Canal>(canal: C, handler: Handler<C>, bruto: unknown): Promise<Resposta<Saida<C>>> {
  const contrato = contratos[canal]
  const entrada = contrato.entrada.safeParse(bruto)
  if (!entrada.success) return falha('entrada_invalida', descreverErroZod(entrada.error))
  try {
    const resultado = await handler(entrada.data as never)
    const saida = contrato.saida.safeParse(resultado)
    if (!saida.success) return falha('saida_invalida', descreverErroZod(saida.error))
    return ok(saida.data as Saida<C>)
  } catch (e) {
    if (e instanceof ErroApp) return falha(e.codigo, e.message)
    console.error(`[ipc] ${canal}`, e)
    return falha('erro_interno', e instanceof Error ? e.message : String(e))
  }
}
