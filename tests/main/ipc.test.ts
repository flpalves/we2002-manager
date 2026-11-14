import { describe, expect, it } from 'vitest'
import { ErroApp, executar } from '../../src/main/ipc/registrar'
import type { ConfigApp } from '@shared/esquemas/config'

const config: ConfigApp = {
  versao: 1,
  tema: 'escuro',
  pastaCarreiras: 'C:/x/carreiras',
  pastaPacotes: 'C:/p/pacotes',
  caminhos: { emulador: 'e.exe', imagem: 'we.cue', estados: 'states' },
}

describe('ipc / executar', () => {
  it('devolve { ok: true, dados } quando tudo é válido', async () => {
    const r = await executar('config:salvar', (p) => ({ ...config, ...(p.tema && { tema: p.tema }) }), { tema: 'claro' })
    expect(r).toEqual({ ok: true, dados: { ...config, tema: 'claro' } })
  })

  it('rejeita entrada inválida sem chamar o handler', async () => {
    let chamou = false
    const r = await executar('config:salvar', () => ((chamou = true), config), { tema: 'roxo' })
    expect(chamou).toBe(false)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erro.codigo).toBe('entrada_invalida')
      expect(r.erro.mensagem).toContain('tema')
    }
  })

  it('rejeita saída fora do contrato', async () => {
    const r = await executar('config:obter', () => ({ ...config, tema: 'roxo' }) as never, undefined)
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'saida_invalida' } })
  })

  it('transforma ErroApp em erro com código e outros erros em erro_interno', async () => {
    const r1 = await executar('config:obter', () => {
      throw new ErroApp('sem_permissao', 'Pasta sem permissão')
    }, undefined)
    expect(r1).toEqual({ ok: false, erro: { codigo: 'sem_permissao', mensagem: 'Pasta sem permissão' } })

    const original = console.error
    console.error = () => {}
    const r2 = await executar('config:obter', () => {
      throw new Error('boom')
    }, undefined)
    console.error = original
    expect(r2).toEqual({ ok: false, erro: { codigo: 'erro_interno', mensagem: 'boom' } })
  })
})
