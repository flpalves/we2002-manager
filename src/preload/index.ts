import { contextBridge, ipcRenderer } from 'electron'
import { contratos, descreverErroZod, falha, type Api, type Canal, type Entrada, type Resposta, type Saida } from '@shared/esquemas/ipc'

async function invocar<C extends Canal>(canal: C, entrada: Entrada<C>): Promise<Resposta<Saida<C>>> {
  const contrato = contratos[canal]
  if (!contrato) return falha('canal_desconhecido', `Canal desconhecido: ${String(canal)}`)
  const e = contrato.entrada.safeParse(entrada)
  if (!e.success) return falha('entrada_invalida', descreverErroZod(e.error))
  const r = (await ipcRenderer.invoke(canal, e.data)) as Resposta<unknown>
  if (!r.ok) return r
  const s = contrato.saida.safeParse(r.dados)
  if (!s.success) return falha('saida_invalida', descreverErroZod(s.error))
  return { ok: true, dados: s.data as Saida<C> }
}

const api: Api = { invocar }

contextBridge.exposeInMainWorld('api', api)
