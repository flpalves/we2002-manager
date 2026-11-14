// Gera src/renderer/estilos/tokens.css a partir de docs/design-system/tokens.json e copia
// o bundle.css do design system (sem o @import do Google Fonts: as fontes vêm do
// @fontsource, para o app funcionar offline).
//
//   node tools/gerar-tokens-css.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const ds = join(raiz, 'docs', 'design-system')
const saida = join(raiz, 'src', 'renderer', 'estilos')

const tokens = JSON.parse(readFileSync(join(ds, 'tokens.json'), 'utf8'))
const temas = tokens.color.themes.map((t) => t.id)
const [primeiro] = temas

const valorDoTema = (token, tema) => {
  if (typeof token.value === 'string') return token.value
  return token.value[tema] ?? token.value[primeiro]
}

const linhas = (tema) =>
  tokens.color.tokens.map((t) => `  --${t.name}: ${valorDoTema(t, tema)};`).join('\n')

const fixos = []
for (const [nome, familia] of Object.entries(tokens.type.families)) fixos.push(`  --font-${nome}: ${familia};`)
for (const fam of ['spacing', 'radius', 'shadow']) {
  for (const t of tokens[fam]?.tokens ?? []) fixos.push(`  --${t.name}: ${t.value};`)
}

let css = `/* ${tokens.name} — gerado de docs/design-system/tokens.json por tools/gerar-tokens-css.mjs. Não editar. */\n\n`
css += `:root,\n[data-tema="${primeiro}"] {\n  color-scheme: dark;\n${linhas(primeiro)}\n${fixos.join('\n')}\n}\n`
for (const tema of temas.slice(1)) {
  css += `\n[data-tema="${tema}"] {\n  color-scheme: light;\n${linhas(tema)}\n}\n`
}

mkdirSync(saida, { recursive: true })
writeFileSync(join(saida, 'tokens.css'), css)

const bundle = readFileSync(join(ds, 'components', 'bundle.css'), 'utf8')
  .split('\n')
  .filter((l) => !l.startsWith('@import'))
  .join('\n')
  .trimStart()
writeFileSync(
  join(saida, 'bundle.css'),
  `/* Copiado de docs/design-system/components/bundle.css por tools/gerar-tokens-css.mjs. Não editar. */\n\n${bundle}`,
)
console.log(`tokens.css (${temas.join(', ')}) e bundle.css gerados em ${saida}`)
