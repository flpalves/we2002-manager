import { z } from 'zod'
import type { Regras } from '../config/padroes'
import { deExibicaoWe, geral } from '../jogadores/conversao'
import { paraAscii, slug } from '../texto'
import { ATRIBUTOS, AparenciaSchema, type Atributo, type Jogador, type Porte, type Posicao, type Time } from '@shared/esquemas/pacote'

/**
 * Conversão dos arquivos antigos `data/times/*.json` (formato da ponte e do app do
 * campeonato) para o formato do pacote. Atributos 12-19 → 1-20 pela inversa da tabela.
 */

/** Posições com lado do formato antigo → as 8 do WE (o lado vem da vaga da formação). */
const POSICAO_LEGADO: Record<string, Posicao> = {
  GK: 'GK',
  CB: 'CB',
  SB: 'SB',
  LB: 'SB',
  RB: 'SB',
  DH: 'DH',
  SH: 'SH',
  LH: 'SH',
  RH: 'SH',
  OH: 'OH',
  AM: 'OH',
  CF: 'CF',
  SS: 'CF',
  WG: 'WG',
  LW: 'WG',
  RW: 'WG',
  WF: 'WG',
}

/** Chaves antigas dos atributos → siglas do pacote. */
const ATRIBUTO_LEGADO: Record<string, Atributo> = {
  OFF: 'OFF',
  DEF: 'DEF',
  BAL: 'BAL',
  STA: 'STA',
  SPD: 'SPD',
  ACC: 'ACC',
  RES: 'RES',
  DRI: 'DRI',
  PASS: 'PAS',
  PAS: 'PAS',
  SHPW: 'SHP',
  SHAC: 'SHA',
  TEC: 'TEC',
  HEAD: 'HEA',
  JMP: 'JMP',
  CRV: 'CUR',
  AGR: 'AGR',
}

const JogadorLegadoSchema = z.object({
  vaga: z.number().int(),
  nome: z.string(),
  posicao: z.string(),
  camisa: z.number().int(),
  camisa_real: z.number().int().optional(),
  altura: z.number().int(),
  idade: z.number().int(),
  pe: z.enum(['destro', 'canhoto', 'ambidestro']).optional(),
  outside: z.boolean().optional(),
  aparencia: z.unknown().optional(),
  atributos: z.record(z.string(), z.number()),
})

export const TimeLegadoSchema = z.object({
  nome: z.string(),
  nome_tela: z.string().optional(),
  sigla: z.string(),
  bandeira: z.string().nullable().optional(),
  bandeira_ajuste: z.string().optional(),
  formacao: z.string(),
  kit: z.record(z.string(), z.unknown()).optional(),
  kit_reserva: z.record(z.string(), z.unknown()).optional(),
  jogadores: z.array(JogadorLegadoSchema),
})
export type TimeLegado = z.infer<typeof TimeLegadoSchema>

export interface OpcoesLegado {
  pais: string
  estado?: string
  porte: Porte
  temporada_inicial: number
  regras: Regras
  /** Caminho do kit no pacote a partir do caminho antigo (ex.: kits/desenhos/x_4x.png). */
  caminhoKit: (antigo: string) => string
  caminhoBandeira: (antigo: string) => string
}

/** Potencial provisório (oculto): o geral, com folga para os jovens. Recalibrar na fase 4. */
export function potencialProvisorio(geralAtual: number, idade: number): number {
  const folga = idade <= 19 ? 3 : idade <= 22 ? 2 : idade <= 26 ? 1 : 0
  return Math.min(20, geralAtual + folga)
}

function coresDoKit(kit: Record<string, unknown> | undefined): string[] {
  const design = (kit?.['design'] ?? {}) as Record<string, unknown>
  const cores: string[] = []
  for (const campo of ['camisa', 'detalhe', 'calcao']) {
    const c = design[campo]
    if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) && !cores.includes(c.toUpperCase())) cores.push(c.toUpperCase())
  }
  return cores.length ? cores : ['#555555']
}

function converterKit(kit: Record<string, unknown> | undefined, caminhoKit: (a: string) => string) {
  if (!kit) return undefined
  const arte = kit['arte']
  return typeof arte === 'string' ? { ...kit, arte: caminhoKit(arte) } : { ...kit }
}

export function converterTimeLegado(bruto: unknown, op: OpcoesLegado): Time {
  const legado = TimeLegadoSchema.parse(bruto)
  const sigla = legado.sigla.toUpperCase()
  const tabela = op.regras.jogadores.conversao_we
  const ids = new Set<string>()

  const jogadores: Jogador[] = [...legado.jogadores]
    .sort((a, b) => a.vaga - b.vaga)
    .map((j) => {
      const posicao = POSICAO_LEGADO[j.posicao.toUpperCase()]
      if (!posicao) throw new Error(`${legado.nome}: posição desconhecida "${j.posicao}" (${j.nome})`)

      const atributos = {} as Record<Atributo, number>
      for (const [chave, valor] of Object.entries(j.atributos)) {
        const destino = ATRIBUTO_LEGADO[chave.toUpperCase()]
        if (destino) atributos[destino] = deExibicaoWe(valor, tabela)
      }
      for (const a of ATRIBUTOS) atributos[a] ??= deExibicaoWe(12, tabela)

      let id = `${sigla.toLowerCase()}-${slug(j.nome) || `vaga-${j.vaga}`}`
      for (let n = 2; ids.has(id); n++) id = `${sigla.toLowerCase()}-${slug(j.nome)}-${n}`
      ids.add(id)

      const aparencia = AparenciaSchema.safeParse(j.aparencia)
      const g = geral(atributos, posicao, op.regras)
      const jogador: Jogador = {
        id,
        nome: j.nome,
        nome_we: paraAscii(j.nome),
        posicao,
        posicao_secundaria: null,
        camisa: j.camisa,
        camisa_real: j.camisa_real ?? null,
        idade: j.idade,
        nacionalidade: op.pais,
        pe: j.pe ?? 'destro',
        altura: j.altura,
        atributos,
        outside: j.outside ?? true,
        potencial: potencialProvisorio(g, j.idade),
        resistencia: 10,
        contrato: { salario_mensal: 0, ate_temporada: op.temporada_inicial + 1, multa: 0 },
        ...(aparencia.success && { aparencia: aparencia.data }),
      }
      return jogador
    })

  return {
    sigla,
    nome: legado.nome,
    nome_curto: paraAscii(legado.nome_tela ?? legado.nome).toUpperCase(),
    pais: op.pais,
    ...(op.estado && { estado: op.estado }),
    cores: coresDoKit(legado.kit),
    porte: op.porte,
    formacao: legado.formacao,
    ...(legado.kit && { kit: converterKit(legado.kit, op.caminhoKit) }),
    ...(legado.kit_reserva && { kit_reserva: converterKit(legado.kit_reserva, op.caminhoKit) }),
    ...(legado.bandeira && {
      bandeira: { arquivo: op.caminhoBandeira(legado.bandeira), ajuste: legado.bandeira_ajuste ?? 'esticar' },
    }),
    jogadores,
  }
}
