// Valida um pacote de dados com as mesmas regras do editor e da criação de carreira.
//
//   npm run pacote:validar                       (pacotes/brasil-2026, todos os problemas)
//   npm run pacote:validar -- --time SAN          (só os problemas de um time)
//   npm run pacote:validar -- --pacote meu-pacote
//
// Sai com código 1 se houver erro (aviso não bloqueia a carreira).
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { regrasDoPacote } from '@core/pacote/importar'
import { validarPacote } from '@core/pacote/validar'
import { lerPacote } from '../src/main/pacote/leitor'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (nome: string) => {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const id = arg('--pacote') ?? 'brasil-2026'
const time = arg('--time')

const pacote = lerPacote(join(raiz, 'pacotes', id))
// Com --time: os problemas do time e também o arquivo dele fora do formato (que não tem `time`).
const doTime = (p: { time?: string; arquivo?: string }) => p.time === time || p.arquivo === `times/${time}.json`
const problemas = validarPacote(pacote, regrasDoPacote(pacote)).filter((p) => !time || doTime(p))
for (const p of problemas) console.log(`${p.nivel === 'erro' ? 'ERRO ' : 'aviso'}  ${p.codigo.padEnd(24)} ${p.mensagem}`)
const erros = problemas.filter((p) => p.nivel === 'erro').length
console.log(`\n${id}${time ? ` / ${time}` : ''}: ${erros} erro(s), ${problemas.length - erros} aviso(s)`)
process.exit(erros > 0 ? 1 : 0)
