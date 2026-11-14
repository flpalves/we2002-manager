<script setup lang="ts">
/** Consequências de um evento (ou de uma opção da decisão): o que muda no jogo quando acontece. Spec 09b. */
import { CAMPOS_EFEITO, type Efeito } from '@shared/esquemas/noticias'
import { ATRIBUTOS, ROTULO_ATRIBUTO } from '@shared/esquemas/pacote'
import { EFEITOS_COM_DELTA, EFEITOS_DE_JOGADOR, limparEfeito } from '@core/noticias/editor'
import WeBotao from '../../componentes/WeBotao.vue'
import { ROTULO_EFEITO, descreverEfeitoCatalogo } from '../../noticias'
import { centavosParaReais, reaisParaCentavos } from '../../formato'

const props = defineProps<{
  /** O alvo do evento é um jogador (efeitos de jogador valem). */
  porJogador: boolean
  rotulo: string
}>()
const efeitos = defineModel<Efeito[]>({ required: true })

const disponiveis = (atual: Efeito['campo']) => CAMPOS_EFEITO.filter((c) => c === atual || props.porJogador || !EFEITOS_DE_JOGADOR.includes(c))
const semAlvo = (e: Efeito) => !props.porJogador && EFEITOS_DE_JOGADOR.includes(e.campo)

function trocarCampo(i: number, campo: string): void {
  efeitos.value[i] = limparEfeito({ ...efeitos.value[i]!, campo: campo as Efeito['campo'] })
}
function definirChance(e: Efeito, texto: string): void {
  const v = Number(texto.replace(',', '.'))
  if (!texto.trim() || !Number.isFinite(v) || v >= 100) delete e.chance
  else e.chance = Math.max(0, v) / 100
}
function definirSaldo(e: Efeito, texto: string): void {
  const c = reaisParaCentavos(texto)
  if (c !== null) e.valor = c
}
function acrescentar(): void {
  efeitos.value.push({ campo: props.porJogador ? 'moral' : 'moral_elenco', delta: 5 })
}
</script>

<template>
  <div class="efeitos" role="group" :aria-label="rotulo">
    <p v-if="!efeitos.length" class="we-lb">Nenhuma consequência.</p>
    <div v-for="(e, i) in efeitos" :key="i" class="efeito" :class="{ 'efeito--sem-alvo': semAlvo(e) }">
      <label class="campo efeito__campo">
        <span class="we-lb">Mexe em</span>
        <select :value="e.campo" @change="(ev) => trocarCampo(i, (ev.target as HTMLSelectElement).value)">
          <option v-for="c in disponiveis(e.campo)" :key="c" :value="c">{{ ROTULO_EFEITO[c] }}</option>
        </select>
      </label>
      <label v-if="e.campo === 'atributo'" class="campo">
        <span class="we-lb">Atributo</span>
        <select v-model="e.atributo">
          <option v-for="a in ATRIBUTOS" :key="a" :value="a">{{ ROTULO_ATRIBUTO[a] }} ({{ a }})</option>
        </select>
      </label>
      <label v-if="EFEITOS_COM_DELTA.includes(e.campo)" class="campo efeito__num">
        <span class="we-lb">Variação</span>
        <input v-model.number="e.delta" type="number" min="-100" max="100" step="1" />
      </label>
      <label v-if="e.campo === 'saldo'" class="campo">
        <span class="we-lb">Valor em R$ (− = despesa)</span>
        <input :value="centavosParaReais(e.valor ?? 0)" type="text" inputmode="decimal" @change="(ev) => definirSaldo(e, (ev.target as HTMLInputElement).value)" />
      </label>
      <label v-if="e.campo === 'lesao' || e.campo === 'disponibilidade'" class="campo efeito__num">
        <span class="we-lb">Semanas fora</span>
        <input v-model.number="e.semanas" type="number" min="1" max="52" />
      </label>
      <label class="campo efeito__num">
        <span class="we-lb">Chance (%)</span>
        <input
          :value="e.chance === undefined ? 100 : Math.round(e.chance * 1000) / 10"
          type="number"
          min="0"
          max="100"
          step="5"
          @change="(ev) => definirChance(e, (ev.target as HTMLInputElement).value)"
        />
      </label>
      <span class="efeito__frase">{{ descreverEfeitoCatalogo(e) }}<template v-if="semAlvo(e)"> — sem jogador no alvo, será ignorado</template></span>
      <WeBotao icone="descartar" @click="efeitos.splice(i, 1)">Tirar</WeBotao>
    </div>
    <div class="acoes"><WeBotao icone="nova" @click="acrescentar">Acrescentar consequência</WeBotao></div>
  </div>
</template>

<style scoped>
.efeitos {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.efeitos > p {
  margin: 0;
}
.efeito {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-2);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--clube);
  border-radius: var(--radius-sm);
}
.efeito--sem-alvo {
  border-left-color: var(--atencao);
  opacity: 0.8;
}
.efeito__campo {
  min-width: 220px;
}
.efeito__num input {
  width: 90px;
}
.efeito__frase {
  flex: 1;
  align-self: center;
  min-width: 160px;
  font-size: 13px;
  color: var(--texto-suave);
}
</style>
