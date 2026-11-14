// Gera pacotes/brasil-2026/ a partir dos arquivos antigos data/times/*.json.
//
//   npm run pacote:gerar            (não sobrescreve times já existentes no pacote)
//   npm run pacote:gerar -- --forcar (regrava todos os times a partir de data/times)
//
// Dados que os arquivos antigos não têm entram com valor provisório e aparecem como
// aviso na validação: finanças/estádio (padrão do porte), posição secundária, salário,
// nacionalidade (BRA). Escudos não são gerados: escudos/<SIGLA>.png é obrigatório.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PADROES } from '@core/config/padroes'
import { converterTimeLegado } from '@core/pacote/legado'
import { validarPacote } from '@core/pacote/validar'
import type { Competicao, Manifesto, Pais, Porte } from '@shared/esquemas/pacote'
import { gravarJson, lerPacote } from '../src/main/pacote/leitor'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const destino = join(raiz, 'pacotes', 'brasil-2026')
const forcar = process.argv.includes('--forcar')

// Estado e porte dos 20 da Série A 2026 (porte: os 12 clubes tradicionais = grande).
const CLUBES: Record<string, { estado: string; porte: Porte }> = {
  CAP: { estado: 'PR', porte: 'medio' },
  CAM: { estado: 'MG', porte: 'grande' },
  BAH: { estado: 'BA', porte: 'medio' },
  BOT: { estado: 'RJ', porte: 'grande' },
  RBB: { estado: 'SP', porte: 'medio' },
  CHA: { estado: 'SC', porte: 'pequeno' },
  COR: { estado: 'SP', porte: 'grande' },
  CFC: { estado: 'PR', porte: 'medio' },
  CRU: { estado: 'MG', porte: 'grande' },
  FLA: { estado: 'RJ', porte: 'grande' },
  FLU: { estado: 'RJ', porte: 'grande' },
  GRE: { estado: 'RS', porte: 'grande' },
  INT: { estado: 'RS', porte: 'grande' },
  MIR: { estado: 'SP', porte: 'pequeno' },
  PAL: { estado: 'SP', porte: 'grande' },
  REM: { estado: 'PA', porte: 'pequeno' },
  SAN: { estado: 'SP', porte: 'grande' },
  SPFC: { estado: 'SP', porte: 'grande' },
  VAS: { estado: 'RJ', porte: 'grande' },
  VIT: { estado: 'BA', porte: 'medio' },
}

const manifesto: Manifesto = {
  id: 'brasil-2026',
  nome: 'Brasil 2026',
  versao: '0.1.0',
  temporada_inicial: 2026,
  tipo: 'real',
  autor: 'Felipe',
}

// Fator de valor de mercado por país (06-mercado): provisório, calibrar na fase 6.
const paises: Pais[] = [
  { codigo: 'BRA', nome: 'Brasil', fator_valor: 1 },
  { codigo: 'ARG', nome: 'Argentina', fator_valor: 0.8 },
  { codigo: 'URU', nome: 'Uruguai', fator_valor: 0.6 },
  { codigo: 'COL', nome: 'Colômbia', fator_valor: 0.6 },
  { codigo: 'CHI', nome: 'Chile', fator_valor: 0.5 },
  { codigo: 'ECU', nome: 'Equador', fator_valor: 0.5 },
  { codigo: 'PAR', nome: 'Paraguai', fator_valor: 0.45 },
  { codigo: 'PER', nome: 'Peru', fator_valor: 0.4 },
  { codigo: 'BOL', nome: 'Bolívia', fator_valor: 0.3 },
  { codigo: 'VEN', nome: 'Venezuela', fator_valor: 0.3 },
]

function copiar(origemRel: string, destinoRel: string): void {
  const origem = join(raiz, origemRel)
  if (!existsSync(origem)) {
    console.warn(`  aviso: ${origemRel} não existe`)
    return
  }
  mkdirSync(dirname(join(destino, destinoRel)), { recursive: true })
  copyFileSync(origem, join(destino, destinoRel))
}

mkdirSync(destino, { recursive: true })
if (forcar || !existsSync(join(destino, 'manifesto.json'))) gravarJson(join(destino, 'manifesto.json'), manifesto)
if (!existsSync(join(destino, 'regras.json'))) gravarJson(join(destino, 'regras.json'), {})
if (!existsSync(join(destino, 'paises.json'))) gravarJson(join(destino, 'paises.json'), paises)
// Janelas provisórias (decisão 8): Série A nos fins de semana de abril a dezembro.
if (!existsSync(join(destino, 'temporada.json'))) {
  gravarJson(join(destino, 'temporada.json'), { blocos: [{ competicao: 'serie-a', datas: 'fds', semana_inicio: 12, semana_fim: 50 }] })
}

const pastaLegado = join(raiz, 'data', 'times')
const siglas: string[] = []
for (const arq of readdirSync(pastaLegado).filter((f) => f.endsWith('.json')).sort()) {
  const bruto = JSON.parse(readFileSync(join(pastaLegado, arq), 'utf8'))
  const sigla = String(bruto.sigla).toUpperCase()
  const clube = CLUBES[sigla]
  if (!clube) throw new Error(`${arq}: sigla ${sigla} sem estado/porte em CLUBES`)
  siglas.push(sigla)
  const arqTime = join(destino, 'times', `${sigla}.json`)
  if (existsSync(arqTime) && !forcar) {
    console.log(`${sigla}: já existe no pacote (use --forcar para regravar)`)
    continue
  }

  const copias: [string, string][] = []
  const time = converterTimeLegado(bruto, {
    pais: 'BRA',
    estado: clube.estado,
    porte: clube.porte,
    temporada_inicial: manifesto.temporada_inicial,
    regras: PADROES,
    caminhoKit: (antigo) => {
      const novo = `kits/desenhos/${basename(antigo).replace(/^[^_]+/, sigla.toLowerCase())}`
      copias.push([antigo, novo])
      return novo
    },
    caminhoBandeira: (antigo) => {
      const novo = `bandeiras/${sigla}.png`
      copias.push([antigo, novo])
      return novo
    },
  })
  for (const [de, para] of copias) copiar(de, para)
  gravarJson(arqTime, time)
  console.log(`${sigla}: ${time.jogadores.length} jogadores`)
}

const arqSerieA = join(destino, 'competicoes', 'serie-a.json')
if (forcar || !existsSync(arqSerieA)) {
  const serieA: Competicao = {
    id: 'serie-a',
    nome: 'Série A',
    tipo: 'nacional',
    participantes: { regra: 'lista', times: siglas, quantidade: 20 },
    suspensao: { amarelos: 3, jogos: 1, vermelho_jogos: 1, zera_na_fase: null },
    substituicoes: 3,
    fases: [
      {
        id: 'liga',
        nome: 'Turno e returno',
        formato: 'pontos_corridos',
        pontos_corridos: { turnos: 2 },
        desempate: ['pontos', 'vitorias', 'saldo', 'gols_pro', 'confronto_direto', 'menos_vermelhos', 'menos_amarelos', 'sorteio'],
        zonas: [
          { de: 1, ate: 6, nome: 'Libertadores', cor: 'info' },
          { de: 7, ate: 12, nome: 'Sul-Americana', cor: 'atencao' },
          { de: 17, ate: 20, nome: 'Rebaixamento', cor: 'negativo' },
        ],
      },
    ],
  }
  gravarJson(arqSerieA, serieA)
}

// Escada de acesso e rebaixamento (só quando a Série B existe; não sobrescreve a do editor).
const arqDivisoes = join(destino, 'divisoes.json')
if (!existsSync(arqDivisoes) && existsSync(join(destino, 'competicoes', 'serie-b.json'))) {
  gravarJson(arqDivisoes, { divisoes: [{ competicao: 'serie-a' }, { competicao: 'serie-b', troca: 4 }] })
}

const pacote = lerPacote(destino)
const problemas = validarPacote(pacote, PADROES)
const contagem = new Map<string, { nivel: string; n: number }>()
for (const p of problemas) {
  const c = contagem.get(p.codigo) ?? { nivel: p.nivel, n: 0 }
  c.n++
  contagem.set(p.codigo, c)
}
console.log(`\n${destino}\n${pacote.times.length} times, ${pacote.competicoes.length} competição(ões)`)
for (const [codigo, { nivel, n }] of [...contagem].sort()) console.log(`  ${nivel.padEnd(5)} ${codigo}: ${n}`)
