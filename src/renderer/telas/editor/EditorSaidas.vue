<script setup lang="ts">
/** Saídas da competição (acesso, rebaixamento, vagas): quem vai para onde. Spec 03. */
import { computed } from 'vue'
import type { Competicao, SaidaCompeticao } from '@shared/esquemas/pacote'
import WeBotao from '../../componentes/WeBotao.vue'
import { ROTULO_MODO_SAIDA, descreverSaida, lerPosicoes, modoDaSaida, trocarModoSaida, type ModoSaida } from '@core/pacote/editorFases'

const props = defineProps<{
  competicao: Competicao
  /** Outras competições do pacote (destinos). */
  destinos: { id: string; nome: string }[]
  /** A competição está na escada de divisões: acesso/rebaixamento vêm de lá. */
  naEscada: boolean
}>()
const saidas = defineModel<SaidaCompeticao[]>({ required: true })

const MODOS: ModoSaida[] = ['campeao', 'posicoes', 'primeiros', 'ultimos', 'por_grupo']
const TIPOS = ['vaga', 'acesso', 'rebaixamento']
const fases = computed(() => props.competicao.fases)
const fasesGrupo = computed(() => fases.value.filter((f) => f.formato === 'grupos'))
const nomeDestino = (id: string) => props.destinos.find((d) => d.id === id)?.nome ?? id
const substituida = (s: SaidaCompeticao) => props.naEscada && (s.tipo === 'acesso' || s.tipo === 'rebaixamento')

function trocarModo(i: number, modo: ModoSaida): void {
  saidas.value[i] = trocarModoSaida(saidas.value[i]!, modo, props.competicao)
}
function definirTipo(s: SaidaCompeticao, tipo: string): void {
  if (tipo === 'vaga') delete s.tipo
  else s.tipo = tipo
}
function definirFase(s: SaidaCompeticao, fase: string): void {
  if (fase) s.fase = fase
  else delete s.fase
}
function definirN(s: SaidaCompeticao, campo: 'primeiros' | 'ultimos', v: string): void {
  s[campo] = Math.max(1, Number(v) || 1)
}
/** Vaga pulando: quem joga estas competições na próxima temporada (ou já está no destino) é pulado. */
function alternarPula(s: SaidaCompeticao, id: string): void {
  const l = s.exceto_de ?? []
  const nova = l.includes(id) ? l.filter((x) => x !== id) : [...l, id]
  if (nova.length) s.exceto_de = nova
  else delete s.exceto_de
}
function acrescentar(): void {
  saidas.value.push({ campeao: true, destino: props.destinos[0]?.id ?? '' })
}
function tirar(i: number): void {
  saidas.value.splice(i, 1)
}
</script>

<template>
  <div class="saidas">
    <p v-if="naEscada" class="we-lb">
      Esta competição está na escada de Divisões: as saídas de acesso e rebaixamento daqui são trocadas pelas da escada na criação da carreira. Vagas valem normalmente.
    </p>
    <p v-if="!saidas.length" class="we-lb">Nenhuma saída. Ninguém sai desta competição para outra.</p>

    <div v-for="(s, i) in saidas" :key="i" class="saida" :class="{ 'saida--apagada': substituida(s) }">
      <div class="acoes" role="group" :aria-label="`Quem sai na saída ${i + 1}`">
        <WeBotao
          v-for="m in MODOS"
          :key="m"
          :ativo="modoDaSaida(s) === m"
          :desabilitado="m === 'por_grupo' && !fasesGrupo.length"
          @click="trocarModo(i, m)"
        >
          {{ ROTULO_MODO_SAIDA[m] }}
        </WeBotao>
        <WeBotao icone="descartar" class="saida__tirar" @click="tirar(i)">Tirar</WeBotao>
      </div>

      <div class="campos">
        <label v-if="modoDaSaida(s) === 'posicoes'" class="campo">
          <span class="we-lb">Posições (ex.: 1-4)</span>
          <input v-model="s.posicoes" type="text" :aria-invalid="!lerPosicoes(s.posicoes ?? '')" />
        </label>
        <template v-if="modoDaSaida(s) === 'primeiros' || modoDaSaida(s) === 'ultimos'">
          <label class="campo">
            <span class="we-lb">Quantos</span>
            <input
              :value="modoDaSaida(s) === 'primeiros' ? s.primeiros : s.ultimos"
              type="number"
              min="1"
              @change="(e) => definirN(s, modoDaSaida(s) as 'primeiros' | 'ultimos', (e.target as HTMLInputElement).value)"
            />
          </label>
          <label class="campo">
            <span class="we-lb">Só entre quem jogou</span>
            <select :value="s.fase ?? ''" @change="(e) => definirFase(s, (e.target as HTMLSelectElement).value)">
              <option value="">Classificação final (todos)</option>
              <option v-for="f in fases" :key="f.id" :value="f.id">{{ f.nome }}</option>
            </select>
          </label>
          <fieldset v-if="modoDaSaida(s) === 'primeiros' && (s.tipo ?? 'vaga') !== 'acesso' && s.tipo !== 'rebaixamento'" class="pula">
            <legend class="we-lb">Pular quem joga na próxima temporada (ex.: Série D pulando A, B e C)</legend>
            <label v-for="d in destinos.filter((x) => x.id !== s.destino)" :key="d.id" class="campo campo--check">
              <input type="checkbox" :checked="s.exceto_de?.includes(d.id) ?? false" @change="alternarPula(s, d.id)" />
              {{ d.nome }}
            </label>
          </fieldset>
        </template>
        <template v-if="s.por_grupo">
          <label class="campo">
            <span class="we-lb">Fase de grupos</span>
            <select v-model="s.por_grupo.fase">
              <option v-for="f in fasesGrupo" :key="f.id" :value="f.id">{{ f.nome }}</option>
            </select>
          </label>
          <label class="campo">
            <span class="we-lb">De cada grupo</span>
            <select v-model="s.por_grupo.lado">
              <option value="primeiros">Primeiros</option>
              <option value="ultimos">Últimos</option>
            </select>
          </label>
          <label class="campo">
            <span class="we-lb">Quantos</span>
            <input v-model.number="s.por_grupo.n" type="number" min="1" />
          </label>
        </template>
        <label class="campo">
          <span class="we-lb">Destino</span>
          <select v-model="s.destino">
            <option v-if="!destinos.some((d) => d.id === s.destino)" :value="s.destino">{{ s.destino || '(escolha)' }} — não existe</option>
            <option v-for="d in destinos" :key="d.id" :value="d.id">{{ d.nome }}</option>
          </select>
        </label>
        <label class="campo">
          <span class="we-lb">Tipo</span>
          <select :value="s.tipo ?? 'vaga'" @change="(e) => definirTipo(s, (e.target as HTMLSelectElement).value)">
            <option v-if="s.tipo && !TIPOS.includes(s.tipo)" :value="s.tipo">{{ s.tipo }}</option>
            <option value="vaga">Vaga</option>
            <option value="acesso">Acesso</option>
            <option value="rebaixamento">Rebaixamento</option>
          </select>
        </label>
      </div>
      <p class="saida__frase">
        {{ descreverSaida(s, competicao, nomeDestino) }}
        <template v-if="substituida(s)"> (substituída pela escada de Divisões)</template>
      </p>
    </div>

    <div class="acoes"><WeBotao icone="nova" :desabilitado="!destinos.length" @click="acrescentar">Acrescentar saída</WeBotao></div>
  </div>
</template>

<style scoped>
.saidas {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.saidas > p {
  margin: 0;
}
.saida {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-radius: var(--radius-sm);
}
.saida--apagada {
  opacity: 0.65;
}
.pula {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  padding: 0;
  border: 0;
  flex-basis: 100%;
}
.pula legend {
  margin-bottom: var(--space-1);
}
.saida__tirar {
  margin-left: auto;
}
.saida__frase {
  margin: 0;
  font-size: 13px;
  color: var(--texto-suave);
}
</style>
