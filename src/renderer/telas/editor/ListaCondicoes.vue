<script setup lang="ts">
/** Condições do gatilho de um evento: todas precisam valer para ele poder acontecer. Spec 09b. */
import { CAMPOS_CONDICAO, type Condicao, type Momento } from '@shared/esquemas/noticias'
import { CONDICOES_BOOLEANAS } from '@core/noticias/editor'
import WeBotao from '../../componentes/WeBotao.vue'
import { ROTULO_CONDICAO, ROTULO_OPERADOR } from '../../noticias'
import { centavosParaReais, reaisParaCentavos } from '../../formato'

const props = defineProps<{ momento: Momento; porJogador: boolean }>()
const condicoes = defineModel<Condicao[]>({ required: true })

const OPERADORES: Condicao['op'][] = ['<', '<=', '>', '>=', '==', '!=']
const RESULTADOS = [
  { v: 'V', t: 'Vitória' },
  { v: 'E', t: 'Empate' },
  { v: 'D', t: 'Derrota' },
]

const valeCampo = (c: Condicao['campo']) => (props.porJogador || !c.startsWith('jogador.')) && (props.momento === 'pos_jogo' || !c.startsWith('partida.'))
const disponiveis = (atual: Condicao['campo']) => CAMPOS_CONDICAO.filter((c) => c === atual || valeCampo(c))
const booleana = (c: Condicao) => CONDICOES_BOOLEANAS.includes(c.campo)
const operadores = (c: Condicao) => (c.campo === 'partida.resultado' ? (['==', '!='] as Condicao['op'][]) : OPERADORES)

function padrao(campo: Condicao['campo']): Condicao {
  if (campo === 'partida.resultado') return { campo, op: '==', valor: 'V' }
  if (CONDICOES_BOOLEANAS.includes(campo)) return { campo, op: '==', valor: 1 }
  if (campo === 'time.aproveitamento') return { campo, op: '>=', valor: 0.6 }
  if (campo === 'time.saldo') return { campo, op: '<', valor: 0 }
  if (campo === 'jogador.idade') return { campo, op: '<=', valor: 23 }
  if (campo === 'partida.gols_pro' || campo === 'partida.gols_contra') return { campo, op: '>=', valor: 3 }
  return { campo, op: '<=', valor: 50 }
}
function trocarCampo(i: number, campo: string): void {
  condicoes.value[i] = padrao(campo as Condicao['campo'])
}
function definirNumero(c: Condicao, texto: string, escala = 1): void {
  const v = Number(texto.replace(',', '.'))
  if (Number.isFinite(v)) c.valor = v / escala
}
function definirSaldo(c: Condicao, texto: string): void {
  const v = reaisParaCentavos(texto)
  if (v !== null) c.valor = v
}
function acrescentar(): void {
  const campo = CAMPOS_CONDICAO.find(valeCampo) ?? 'time.confianca'
  condicoes.value.push(padrao(campo))
}
</script>

<template>
  <div class="condicoes" role="group" aria-label="Condições do gatilho">
    <p v-if="!condicoes.length" class="we-lb">Sem condições: pode acontecer a qualquer momento do gatilho.</p>
    <div v-for="(c, i) in condicoes" :key="i" class="condicao">
      <span class="condicao__e">{{ i === 0 ? 'Se' : 'e' }}</span>
      <label class="campo condicao__campo">
        <span class="we-lb">Campo</span>
        <select :value="c.campo" @change="(ev) => trocarCampo(i, (ev.target as HTMLSelectElement).value)">
          <option v-for="k in disponiveis(c.campo)" :key="k" :value="k">{{ ROTULO_CONDICAO[k] }}</option>
        </select>
      </label>
      <template v-if="booleana(c)">
        <label class="campo">
          <span class="we-lb">Valor</span>
          <select :value="c.op === '!=' ? Number(c.valor) ^ 1 : Number(c.valor)" @change="(ev) => ((c.op = '=='), (c.valor = Number((ev.target as HTMLSelectElement).value)))">
            <option :value="1">Sim</option>
            <option :value="0">Não</option>
          </select>
        </label>
      </template>
      <template v-else>
        <label class="campo">
          <span class="we-lb">Comparação</span>
          <select v-model="c.op">
            <option v-for="o in operadores(c)" :key="o" :value="o">{{ ROTULO_OPERADOR[o] }}</option>
          </select>
        </label>
        <label v-if="c.campo === 'partida.resultado'" class="campo">
          <span class="we-lb">Resultado</span>
          <select v-model="c.valor">
            <option v-for="r in RESULTADOS" :key="r.v" :value="r.v">{{ r.t }}</option>
          </select>
        </label>
        <label v-else-if="c.campo === 'time.aproveitamento'" class="campo condicao__num">
          <span class="we-lb">Aproveitamento (%)</span>
          <input :value="Math.round(Number(c.valor) * 100)" type="number" min="0" max="100" step="5" @change="(ev) => definirNumero(c, (ev.target as HTMLInputElement).value, 100)" />
        </label>
        <label v-else-if="c.campo === 'time.saldo'" class="campo">
          <span class="we-lb">Saldo em R$</span>
          <input :value="centavosParaReais(Number(c.valor))" type="text" inputmode="decimal" @change="(ev) => definirSaldo(c, (ev.target as HTMLInputElement).value)" />
        </label>
        <label v-else class="campo condicao__num">
          <span class="we-lb">Valor</span>
          <input :value="c.valor" type="number" step="1" @change="(ev) => definirNumero(c, (ev.target as HTMLInputElement).value)" />
        </label>
      </template>
      <WeBotao icone="descartar" @click="condicoes.splice(i, 1)">Tirar</WeBotao>
    </div>
    <div class="acoes"><WeBotao icone="nova" @click="acrescentar">Acrescentar condição</WeBotao></div>
  </div>
</template>

<style scoped>
.condicoes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.condicoes > p {
  margin: 0;
}
.condicao {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-2);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-radius: var(--radius-sm);
}
.condicao__e {
  align-self: center;
  min-width: 22px;
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--texto-suave);
}
.condicao__campo {
  min-width: 240px;
}
.condicao__num input {
  width: 100px;
}
</style>
