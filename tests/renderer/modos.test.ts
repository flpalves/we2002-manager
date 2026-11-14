import { describe, expect, it } from 'vitest'
import { bloqueioDoModo, modoDaTela } from '@renderer/modos'

describe('modos do app', () => {
  it('telas da carreira exigem carreira aberta', () => {
    expect(bloqueioDoModo('carreira', false)).toBe('sem_carreira')
    expect(bloqueioDoModo('carreira', true)).toBeNull()
  })

  it('o editor do pacote só abre sem carreira', () => {
    expect(bloqueioDoModo('editor', true)).toBe('carreira_aberta')
    expect(bloqueioDoModo('editor', false)).toBeNull()
  })

  it('telas sem modo valem nos dois casos', () => {
    expect(bloqueioDoModo(undefined, true)).toBeNull()
    expect(bloqueioDoModo(undefined, false)).toBeNull()
  })

  it('modo de cada tela: editor, livres e o resto é carreira', () => {
    expect(modoDaTela('editor')).toBe('editor')
    expect(modoDaTela('abertura')).toBeUndefined()
    expect(modoDaTela('configuracoes')).toBeUndefined()
    for (const t of ['inicio', 'elenco', 'mercado', 'jogador', 'carreiras', 'prejogo', 'emulador', 'tela-nova']) {
      expect(modoDaTela(t)).toBe('carreira')
    }
  })

  it('do editor não se chega à carreira, nem da carreira ao editor', () => {
    expect(bloqueioDoModo(modoDaTela('inicio'), false)).toBe('sem_carreira')
    expect(bloqueioDoModo(modoDaTela('editor'), true)).toBe('carreira_aberta')
  })
})
