import type { EventoCatalogo } from '@shared/esquemas/noticias'
import { catalogoPadrao } from '../noticias/catalogoPadrao'
import { mesclarRegras, PADROES, type Parcial, type Regras } from '../config/padroes'
import { temErros, validarPacote, type Problema } from './validar'
import type { Pacote, Time } from '@shared/esquemas/pacote'
import type { Bloco } from '../competicoes/calendario'
import { aplicarDivisoes } from '../competicoes/divisoes'

/**
 * Transforma o pacote validado nas linhas da carreira nova. Puro: a gravação no SQLite
 * e a cópia dos PNGs ficam no main.
 */

export const DIFICULDADES = ['facil', 'normal', 'dificil'] as const
export type Dificuldade = (typeof DIFICULDADES)[number]

export interface EscolhaCarreira {
  id: string
  nome: string
  tecnico: string
  /** Sigla do time do usuário (qualquer time do pacote do país principal). */
  time: string
  dificuldade: Dificuldade
  semente: number
  /** Momento real da criação (metadado; o jogo não usa). */
  criadaEm: string
}

export interface LinhaTime {
  sigla: string
  nome: string
  nome_curto: string
  pais: string
  estado: string | null
  cores: string[]
  porte: Time['porte']
  formacao: string
  estadio_nome: string
  estadio_capacidade: number
  ingresso: number
  custo_por_jogo: number
  saldo: number
  patrocinio_temporada: number
  orcamento_folha_mensal: number
  kit: unknown
  kit_reserva: unknown
  kit_goleiro: unknown
  bandeira: unknown
  /** Caminho do PNG dentro da pasta da carreira. */
  escudo: string
}

export interface LinhaJogador {
  chave: string
  time: string
  nome: string
  nome_we: string
  posicao: string
  posicao_secundaria: string | null
  camisa: number
  camisa_real: number | null
  idade: number
  nacionalidade: string
  pe: string
  altura: number
  atributos: Record<string, number>
  outside: boolean
  potencial: number
  resistencia: number
  moral: number
  aparencia: unknown
  contrato: { salario_mensal: number; ate_temporada: number; multa: number }
}

export interface DadosCarreiraNova {
  carreira: {
    id: string
    nome: string
    pacote_id: string
    pacote_versao: string
    semente: number
    tecnico_nome: string
    time_usuario: string
    dificuldade: Dificuldade
    temporada_atual: number
    criada_em: string
  }
  regras: Regras
  paises: Pacote['paises']
  times: LinhaTime[]
  jogadores: LinhaJogador[]
  competicoes: { id: string; nome: string; tipo: string; definicao: unknown }[]
  /** Catálogo de eventos aleatórios (o do pacote ou o padrão). */
  catalogo: EventoCatalogo[]
  /** Janelas do temporada.json (vazio = cada competição usa os fins de semana da temporada). */
  blocos: Bloco[]
  /** Arquivos a copiar do pacote para a carreira: [origem relativa ao pacote, destino relativo à carreira]. */
  arquivos: [string, string][]
}

export class ErroImportacao extends Error {
  constructor(
    mensagem: string,
    readonly problemas: Problema[] = [],
  ) {
    super(mensagem)
  }
}

/** Moral inicial (spec 05: padrão 60). */
export const MORAL_INICIAL_PADRAO = 60

export function regrasDoPacote(pacote: Pacote): Regras {
  return mesclarRegras(PADROES, pacote.regras as Parcial<Regras>)
}

export function prepararCarreira(pacote: Pacote, escolha: EscolhaCarreira): DadosCarreiraNova {
  const regras = regrasDoPacote(pacote)
  const problemas = validarPacote(pacote, regras)
  if (temErros(problemas)) {
    const n = problemas.filter((p) => p.nivel === 'erro').length
    throw new ErroImportacao(`O pacote tem ${n} erro(s); corrija no editor antes de criar a carreira.`, problemas)
  }
  const manifesto = pacote.manifesto
  if (!manifesto) throw new ErroImportacao('Pacote sem manifesto.')
  const doUsuario = pacote.times.find((t) => t.sigla === escolha.time)
  if (!doUsuario) throw new ErroImportacao(`O time ${escolha.time} não existe no pacote.`)
  if (!escolha.tecnico.trim()) throw new ErroImportacao('Informe o nome do técnico.')

  const arquivos: [string, string][] = []
  const kitsPresentes = new Set(pacote.arquivosKit)
  const copiarKit = (kit: Record<string, unknown> | undefined) => {
    const arte = kit?.['arte']
    if (typeof arte === 'string' && kitsPresentes.has(arte)) arquivos.push([arte, `pacote/${arte}`])
    return kit ?? null
  }

  const fatorOrcamento = regras.financas.orcamento_dificuldade[escolha.dificuldade]
  const times: LinhaTime[] = pacote.times.map((t) => {
    const padrao = regras.padrao_por_porte[t.porte]
    const escudo = `pacote/escudos/${t.sigla}.png`
    arquivos.push([`escudos/${t.sigla}.png`, escudo])
    const bandeira = t.bandeira?.['arquivo']
    if (typeof bandeira === 'string') arquivos.push([bandeira, `pacote/${bandeira}`])
    return {
      sigla: t.sigla,
      nome: t.nome,
      nome_curto: t.nome_curto,
      pais: t.pais,
      estado: t.estado ?? null,
      cores: t.cores,
      porte: t.porte,
      formacao: t.formacao,
      estadio_nome: t.estadio?.nome ?? `Estádio do ${t.nome}`,
      estadio_capacidade: t.estadio?.capacidade ?? padrao.capacidade,
      ingresso: t.estadio?.ingresso_padrao ?? padrao.ingresso_padrao,
      custo_por_jogo: t.estadio?.custo_por_jogo ?? padrao.custo_por_jogo,
      // Dificuldade ajusta o orçamento inicial do time do usuário (±25%).
      saldo: Math.round((t.financas?.saldo_inicial ?? padrao.saldo_inicial) * (t.sigla === escolha.time ? fatorOrcamento : 1)),
      patrocinio_temporada: t.financas?.patrocinio_temporada ?? padrao.patrocinio_temporada,
      orcamento_folha_mensal: Math.round((t.financas?.orcamento_folha_mensal ?? padrao.orcamento_folha_mensal) * (t.sigla === escolha.time ? fatorOrcamento : 1)),
      kit: copiarKit(t.kit),
      kit_reserva: copiarKit(t.kit_reserva),
      kit_goleiro: copiarKit(t.kit_goleiro),
      bandeira: t.bandeira ?? null,
      escudo,
    }
  })

  const jogadores: LinhaJogador[] = pacote.times.flatMap((t) =>
    t.jogadores.map((j) => ({
      chave: j.id,
      time: t.sigla,
      nome: j.nome,
      nome_we: j.nome_we,
      posicao: j.posicao,
      posicao_secundaria: j.posicao_secundaria ?? null,
      camisa: j.camisa,
      camisa_real: j.camisa_real ?? null,
      idade: j.idade,
      nacionalidade: j.nacionalidade,
      pe: j.pe,
      altura: j.altura,
      atributos: { ...j.atributos },
      outside: j.outside,
      potencial: j.potencial,
      resistencia: j.resistencia,
      moral: j.moral_inicial ?? MORAL_INICIAL_PADRAO,
      aparencia: j.aparencia ?? null,
      contrato: { ...j.contrato },
    })),
  )

  return {
    carreira: {
      id: escolha.id,
      nome: escolha.nome.trim() || `${doUsuario.nome} ${manifesto.temporada_inicial}`,
      pacote_id: manifesto.id,
      pacote_versao: manifesto.versao,
      semente: escolha.semente >>> 0,
      tecnico_nome: escolha.tecnico.trim(),
      time_usuario: escolha.time,
      dificuldade: escolha.dificuldade,
      temporada_atual: manifesto.temporada_inicial,
      criada_em: escolha.criadaEm,
    },
    regras,
    paises: pacote.paises,
    times,
    jogadores,
    // A escada de divisões vira saídas e zonas de cada competição (o motor só lê as saídas).
    competicoes: aplicarDivisoes(pacote.competicoes, pacote.divisoes).map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo, definicao: c })),
    blocos: pacote.temporada?.blocos ?? [],
    catalogo: pacote.noticias ?? catalogoPadrao(),
    arquivos,
  }
}
