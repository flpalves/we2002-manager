// Desenha o kit de um time a partir das cores do `kit.design`, usando um kit original do WE
// como base para manter dobras e sombras. Gera a arte 4x (512x1024) em `kit.arte`, que
// depois pode ser retocada à mão.
//
// kit.design (formato completo e estilos em src/core/we/estampas.ts):
//   camisa, detalhe, calcao, meiao: "#RRGGBB"
//   listras_verticais: { "cores": ["#000000", "#FFFFFF"], "largura": 4 }       tipo Atlético-MG
//   faixa_diagonal:    { "cor": "#000000", "largura": 14, "inicio": "direita" } tipo Vasco
//   faixa_peito:       { "cor": "#C8102E", "linhas": [10, 17] }                faixa no peito
//   mangas:            "#FFFFFF"                                              mangas de outra cor
//   faixas: [{ "cor", "regiao": "frente"|"costas"|"laterais"|"mangas", "linhas": [y0, y1] }]  livres
//
// Uso:
//   npm run kits:desenhar                                  (os dois times do data/partida.json)
//   npm run kits:desenhar -- data/outra-partida.json
//   npm run kits:desenhar -- --time vasco                  (titular, reserva e goleiro de data/times/vasco.json)
//   npm run kits:desenhar -- --time pacotes/brasil-2026/times/VAS.json --base holanda
//   npm run kits:desenhar -- --todos                       (todos de data/times)
//
// Arte que já existe NÃO é regravada (pode ter retoque à mão): use --forcar para regravar
// ou --saida <pasta> para gerar uma prévia em outro lugar.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { carregarPartida } from './lib/times.mjs'
import { problemasDoDesign, type DesignKit } from '../src/core/we/estampas'
import { PAGINA_KIT, desenharKit } from '../src/core/we/desenharKit'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const S = 4

interface KitParaDesenhar { pagina: string; arte?: string; design?: DesignKit }

const BASES: Record<string, string> = { brasil: 'kits/brasil_pagina.bin', holanda: 'kits/holanda_pagina.bin' }

function desenhar(rotulo: string, kit: KitParaDesenhar, destinoRel: string): void {
  const d = kit.design!
  const problemas = problemasDoDesign(d)
  if (problemas.length) {
    console.error(`${rotulo}: design inválido, kit não desenhado:\n  - ${problemas.join('\n  - ')}`)
    process.exitCode = 1
    return
  }
  const basePng = PNG.sync.read(fs.readFileSync(path.resolve(ROOT, kit.pagina.replace('_pagina.bin', '_original.png'))))
  const pagina = fs.readFileSync(path.resolve(ROOT, kit.pagina))
  const out = new PNG({ width: PAGINA_KIT.largura * S, height: PAGINA_KIT.altura * S })
  out.data.set(desenharKit({ rgba: basePng.data, pagina }, d, S))
  const destino = saida ? path.resolve(ROOT, saida, path.basename(destinoRel)) : path.resolve(ROOT, destinoRel)
  if (fs.existsSync(destino) && !forcar) {
    console.log(`${rotulo}: ${path.relative(ROOT, destino)} já existe (pode ter retoque à mão); use --forcar para regravar ou --saida <pasta>`)
    return
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, PNG.sync.write(out))
  console.log(`${rotulo}: kit desenhado em ${path.relative(ROOT, destino)} (base: ${path.basename(kit.pagina)})`)
}

const args = process.argv.slice(2)
const opcao = (nome: string) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined }
const forcar = args.includes('--forcar')
const saida = opcao('--saida')
const base = BASES[opcao('--base') ?? 'brasil']
if (!base) throw new Error(`--base deve ser ${Object.keys(BASES).join(' ou ')}`)

function desenharTime(arquivo: string): void {
  const caminho = fs.existsSync(path.resolve(ROOT, arquivo)) ? arquivo : path.join('data', 'times', `${arquivo}.json`)
  const time = JSON.parse(fs.readFileSync(path.resolve(ROOT, caminho), 'utf8')) as Record<string, KitParaDesenhar | undefined>
  const slug = path.basename(caminho, '.json').toLowerCase()
  const sufixos: Record<string, string> = { kit: '', kit_reserva: '_reserva', kit_goleiro: '_goleiro' }
  for (const [campo, sufixo] of Object.entries(sufixos)) {
    const kit = time[campo]
    if (!kit?.design) continue
    const arte = kit.arte ?? `kits/desenhos/${slug}${sufixo}_4x.png`
    // A arte do pacote fica relativa à pasta do pacote; a de data/times, à raiz.
    const pacote = caminho.replace(/\\/g, '/').match(/^(pacotes\/[^/]+)\/times\//)?.[1]
    desenhar(`${slug} ${campo}`, { ...kit, pagina: base! }, pacote ? `${pacote}/${arte}` : arte)
    if (!kit.arte && !saida) console.log(`  (acrescente "arte": "${arte}" ao ${campo} de ${caminho} para usar o desenho)`)
  }
}

const time = opcao('--time')
if (time) desenharTime(time)
else if (args.includes('--todos')) {
  for (const f of fs.readdirSync(path.join(ROOT, 'data', 'times')).filter((n) => n.endsWith('.json'))) desenharTime(path.join('data', 'times', f))
} else {
  const partidaPath = args.find((a) => !a.startsWith('--')) || path.join(ROOT, 'data', 'partida.json')
  const partida = carregarPartida(partidaPath, ROOT)
  for (const lado of ['casa', 'visitante']) {
    const kit = partida.kits[lado]
    if (kit && kit.design && kit.arte) desenhar(lado, kit, kit.arte)
  }
}
