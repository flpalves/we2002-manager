import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ArquivoConfig, aplicarParcial, normalizarConfig } from '../../src/main/config'
import { caminhosPadrao, estaNoOneDrive } from '../../src/main/caminhos'
import type { ConfigApp } from '@shared/esquemas/config'

const padrao: ConfigApp = {
  versao: 1,
  tema: 'escuro',
  pastaCarreiras: 'C:\\Users\\x\\AppData\\Roaming\\we2002-manager\\carreiras',
  pastaPacotes: 'C:/p/pacotes',
  caminhos: { emulador: 'C:\\p\\emulador\\pcsx-redux\\pcsx-redux.exe', imagem: 'C:\\p\\emulador\\we2002.cue', estados: 'C:\\p\\states' },
}

describe('config do app', () => {
  it('normalizarConfig completa campos faltando com o padrão', () => {
    const c = normalizarConfig({ tema: 'claro', caminhos: { imagem: 'D:\\we.cue' } }, padrao)
    expect(c.tema).toBe('claro')
    expect(c.caminhos.imagem).toBe('D:\\we.cue')
    expect(c.caminhos.emulador).toBe(padrao.caminhos.emulador)
  })

  it('normalizarConfig volta ao padrão se o arquivo for lixo', () => {
    expect(normalizarConfig('x', padrao)).toEqual(padrao)
    expect(normalizarConfig({ tema: 'roxo' }, padrao)).toEqual(padrao)
  })

  it('aplicarParcial troca só o que veio', () => {
    const c = aplicarParcial(padrao, { caminhos: { estados: 'E:\\states' } })
    expect(c.caminhos).toEqual({ ...padrao.caminhos, estados: 'E:\\states' })
    expect(c.tema).toBe('escuro')
  })

  it('ArquivoConfig grava e relê', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'we-config-'))
    const arq = join(pasta, 'sub', 'config.json')
    const a = new ArquivoConfig(arq, padrao)
    expect(a.obter()).toEqual(padrao)
    a.salvar({ tema: 'claro' })
    expect(JSON.parse(readFileSync(arq, 'utf8')).tema).toBe('claro')
    expect(new ArquivoConfig(arq, padrao).obter().tema).toBe('claro')
  })

  it('ArquivoConfig ignora JSON corrompido', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'we-config-'))
    const arq = join(pasta, 'config.json')
    writeFileSync(arq, '{ quebrado')
    expect(new ArquivoConfig(arq, padrao).obter()).toEqual(padrao)
  })
})

describe('caminhos', () => {
  it('detecta OneDrive pela variável de ambiente', () => {
    const env = { OneDrive: 'C:\\Users\\felip\\OneDrive' }
    expect(estaNoOneDrive('C:\\Users\\felip\\OneDrive\\Documentos\\carreiras', env)).toBe(true)
    expect(estaNoOneDrive('C:\\Users\\felip\\onedrive\\x', env)).toBe(true)
    expect(estaNoOneDrive('C:\\Users\\felip\\AppData\\Roaming\\we2002-manager\\carreiras', env)).toBe(false)
    expect(estaNoOneDrive('C:\\Users\\felip\\OneDriveBackup\\x', { OneDrive: 'C:\\Users\\felip\\OneDrive' })).toBe(false)
  })

  it('detecta OneDrive pelo nome da pasta quando não há variável', () => {
    expect(estaNoOneDrive('C:\\Users\\a\\OneDrive - Empresa\\x', {})).toBe(true)
    expect(estaNoOneDrive('D:\\jogos\\carreiras', {})).toBe(false)
  })

  it('caminhos padrão ficam dentro do projeto, sem D:\\ fixo', () => {
    const c = caminhosPadrao('C:\\proj')
    expect(c.emulador).toMatch(/^C:\\proj[\\/]emulador[\\/]pcsx-redux[\\/]pcsx-redux\.exe$/)
    expect(c.imagem).toMatch(/we2002\.cue$/)
    expect(c.estados).toMatch(/states$/)
  })
})
