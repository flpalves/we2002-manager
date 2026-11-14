import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ConfigAppSchema, type ConfigApp, type ConfigAppParcial } from '@shared/esquemas/config'

/** Junta o que foi salvo (possivelmente incompleto ou de versão antiga) com os padrões. */
export function normalizarConfig(bruto: unknown, padrao: ConfigApp): ConfigApp {
  const obj = typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : {}
  const caminhos = typeof obj['caminhos'] === 'object' && obj['caminhos'] !== null ? obj['caminhos'] : {}
  const candidato = {
    ...padrao,
    ...obj,
    versao: 1,
    caminhos: { ...padrao.caminhos, ...(caminhos as object) },
  }
  const r = ConfigAppSchema.safeParse(candidato)
  return r.success ? r.data : padrao
}

export function aplicarParcial(atual: ConfigApp, parcial: ConfigAppParcial): ConfigApp {
  return ConfigAppSchema.parse({
    ...atual,
    ...(parcial.tema !== undefined && { tema: parcial.tema }),
    ...(parcial.pastaCarreiras !== undefined && { pastaCarreiras: parcial.pastaCarreiras }),
    ...(parcial.pastaPacotes !== undefined && { pastaPacotes: parcial.pastaPacotes }),
    caminhos: { ...atual.caminhos, ...parcial.caminhos },
  })
}

/** Lê e grava o `config.json` do app (gravação atômica: arquivo temporário + rename). */
export class ArquivoConfig {
  private atual: ConfigApp

  constructor(
    private readonly arquivo: string,
    private readonly padrao: ConfigApp,
  ) {
    this.atual = this.ler()
  }

  private ler(): ConfigApp {
    if (!existsSync(this.arquivo)) return this.padrao
    try {
      return normalizarConfig(JSON.parse(readFileSync(this.arquivo, 'utf8')), this.padrao)
    } catch {
      return this.padrao
    }
  }

  obter(): ConfigApp {
    return this.atual
  }

  salvar(parcial: ConfigAppParcial): ConfigApp {
    const nova = aplicarParcial(this.atual, parcial)
    mkdirSync(dirname(this.arquivo), { recursive: true })
    const tmp = `${this.arquivo}.tmp`
    writeFileSync(tmp, JSON.stringify(nova, null, 2), 'utf8')
    renameSync(tmp, this.arquivo)
    this.atual = nova
    return nova
  }
}
