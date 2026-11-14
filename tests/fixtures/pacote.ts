import { ATRIBUTOS, JogadorSemClubeSchema, type Atributos, type Jogador, type JogadorExterior, type JogadorSemClube, type Pacote, type Posicao, type Time } from '@shared/esquemas/pacote'

/** Pacote mínimo e válido para os testes: times com 23 jogadores (2 GK) e uma liga. */

const POSICOES_ELENCO: Posicao[] = [
  'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'SB', 'SB', 'SB', 'SB', 'DH', 'DH',
  'SH', 'SH', 'OH', 'OH', 'OH', 'CF', 'CF', 'CF', 'WG', 'WG', 'DH',
]

export function atributos(valor = 10): Atributos {
  return Object.fromEntries(ATRIBUTOS.map((a) => [a, valor])) as Atributos
}

export function jogador(sigla: string, n: number, extra: Partial<Jogador> = {}): Jogador {
  return {
    id: `${sigla.toLowerCase()}-j${n}`,
    nome: `Jogador ${n}`,
    nome_we: `JOG ${n}`,
    posicao: POSICOES_ELENCO[n - 1] ?? 'CF',
    posicao_secundaria: 'CF',
    camisa: n,
    idade: 25,
    nacionalidade: 'BRA',
    pe: 'destro',
    altura: 180,
    atributos: atributos(),
    outside: true,
    potencial: 12,
    resistencia: 10,
    contrato: { salario_mensal: 1_000_000, ate_temporada: 2027, multa: 0 },
    ...extra,
  }
}

/** O jogador de time sem os campos que o sem clube não tem. */
function semCamisaNemContrato(j: Jogador): JogadorSemClube {
  return JogadorSemClubeSchema.parse(j)
}

/** Livre inicial (`livres.json`). */
export function livre(n: number, extra: Partial<JogadorSemClube> = {}): JogadorSemClube {
  const base = semCamisaNemContrato(jogador('liv', n, { posicao: 'CB', posicao_secundaria: 'SB' }))
  return { ...base, nome: `Livre ${n}`, nome_we: `LIVRE ${n}`, ...extra }
}

/** Disponível do exterior (`exterior.json`). */
export function exterior(n: number, extra: Partial<JogadorExterior> = {}): JogadorExterior {
  const base = semCamisaNemContrato(jogador('ext', n, { posicao: 'CF', posicao_secundaria: 'WG', atributos: atributos(14) }))
  return { ...base, nome: `Exterior ${n}`, nome_we: `EXT ${n}`, origem: { clube: 'Zenit', pais: 'RUS' }, taxa: 50_000_000, ...extra }
}

export function time(sigla: string, extra: Partial<Time> = {}): Time {
  return {
    sigla,
    nome: `Time ${sigla}`,
    nome_curto: sigla,
    pais: 'BRA',
    estado: 'SP',
    cores: ['#C8102E', '#111111'],
    porte: 'medio',
    estadio: { nome: `Estádio ${sigla}`, capacidade: 30000, ingresso_padrao: 4000, custo_por_jogo: 1_000_000 },
    financas: { saldo_inicial: 100_000_000, patrocinio_temporada: 500_000_000, orcamento_folha_mensal: 50_000_000 },
    formacao: '4-4-2A',
    kit_goleiro: {},
    jogadores: Array.from({ length: 23 }, (_, i) => jogador(sigla, i + 1)),
    ...extra,
  }
}

export function pacote(extra: Partial<Pacote> = {}): Pacote {
  const times = extra.times ?? [time('AAA'), time('BBB')]
  return {
    manifesto: { id: 'teste', nome: 'Teste', versao: '1', temporada_inicial: 2026, tipo: 'ficticio' },
    regras: {},
    temporada: { blocos: [{ competicao: 'liga', datas: 'fds', semana_inicio: 10, semana_fim: 40 }] },
    paises: [{ codigo: 'BRA', nome: 'Brasil', fator_valor: 1 }],
    times,
    competicoes: [
      {
        id: 'liga',
        nome: 'Liga',
        tipo: 'nacional',
        participantes: { regra: 'lista', times: times.map((t) => t.sigla) },
        fases: [{ id: 'f1', nome: 'Turno e returno', formato: 'pontos_corridos', pontos_corridos: { turnos: 2 } }],
      },
    ],
    escudos: times.map((t) => t.sigla),
    arquivosKit: [],
    invalidos: [],
    ...extra,
  }
}
