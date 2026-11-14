<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATRIBUTOS, type Atributos, type Jogador, type Time } from '@shared/esquemas/pacote'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import CampoDinheiro from '../../componentes/CampoDinheiro.vue'
import CamposJogador from './CamposJogador.vue'
import WeSeletorTime from '../../componentes/WeSeletorTime.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar, igual } from './rascunho'

const editor = useEditor()
const ui = useUi()

const times = computed(() => [...(editor.aberto?.times ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)))
if (!editor.timeSelecionado && times.value[0]) editor.timeSelecionado = times.value[0].sigla

const original = computed(() => editor.aberto?.times.find((t) => t.sigla === editor.timeSelecionado) ?? null)
const rascunho = ref<Time | null>(null)
const alterado = computed(() => rascunho.value !== null && !igual(rascunho.value, original.value))

watch(original, (t) => (rascunho.value = t ? copiar(t) : null), { immediate: true })

const jogador = computed<Jogador | null>(() => rascunho.value?.jogadores.find((j) => j.id === editor.jogadorSelecionado) ?? null)
watch(
  rascunho,
  (t) => {
    if (t && !t.jogadores.some((j) => j.id === editor.jogadorSelecionado)) editor.jogadorSelecionado = t.jogadores[0]?.id ?? null
  },
  { immediate: true },
)

const problemasDe = (id: string) => editor.aberto?.problemas.filter((p) => p.jogador === id) ?? []
const temErro = (id: string) => problemasDe(id).some((p) => p.nivel === 'erro')
const goleiros = computed(() => rascunho.value?.jogadores.filter((j) => j.posicao === 'GK').length ?? 0)

const descartarSePreciso = async () =>
  !alterado.value || (await ui.confirmar('Descartar alterações', 'Há alterações não salvas neste elenco. Descartar?', 'Descartar'))

const timeEscolhido = computed({
  get: () => editor.timeSelecionado ?? '',
  set: async (sigla: string) => {
    if (sigla === editor.timeSelecionado) return
    if (await descartarSePreciso()) editor.timeSelecionado = sigla
  },
})

function novoJogador(): void {
  const t = rascunho.value
  if (!t) return
  const usadas = new Set(t.jogadores.map((j) => j.camisa))
  const camisa = Array.from({ length: 32 }, (_, i) => i + 1).find((n) => !usadas.has(n)) ?? 32
  const ids = new Set(editor.aberto?.times.flatMap((x) => x.jogadores.map((j) => j.id)))
  let n = 1
  while (ids.has(`${t.sigla.toLowerCase()}-novo-${n}`) || t.jogadores.some((j) => j.id === `${t.sigla.toLowerCase()}-novo-${n}`)) n++
  const atributos = Object.fromEntries(ATRIBUTOS.map((a) => [a, 10])) as Atributos
  const j: Jogador = {
    id: `${t.sigla.toLowerCase()}-novo-${n}`,
    nome: `Novo jogador ${n}`,
    nome_we: `NOVO ${n}`,
    posicao: goleiros.value < 2 ? 'GK' : 'CF',
    posicao_secundaria: null,
    camisa,
    camisa_real: null,
    idade: 20,
    nacionalidade: t.pais,
    pe: 'destro',
    altura: 180,
    atributos,
    outside: true,
    potencial: 12,
    resistencia: 10,
    contrato: { salario_mensal: 0, ate_temporada: (editor.aberto?.manifesto?.temporada_inicial ?? 2026) + 1, multa: 0 },
  }
  t.jogadores.push(j)
  editor.jogadorSelecionado = j.id
}

async function removerJogador(): Promise<void> {
  const t = rascunho.value
  const j = jogador.value
  if (!t || !j) return
  if (!(await ui.confirmar('Remover jogador', `Remover ${j.nome} do elenco? (Só vale depois de salvar o elenco.)`, 'Remover', true))) return
  const i = t.jogadores.indexOf(j)
  t.jogadores.splice(i, 1)
  editor.jogadorSelecionado = t.jogadores[Math.min(i, t.jogadores.length - 1)]?.id ?? null
}

async function salvar(): Promise<void> {
  if (rascunho.value) await editor.salvarTime(copiar(rascunho.value))
}

function definirCamisaReal(valor: string): void {
  if (jogador.value) jogador.value.camisa_real = valor ? Number(valor) : null
}
</script>

<template>
  <div class="mestre-detalhe">
    <WePainel titulo="Elenco" sem-corpo>
      <template #extra>{{ rascunho?.jogadores.length ?? 0 }} · {{ goleiros }} GK</template>
      <div class="we-panel__body">
        <div class="campo">
          <span class="we-lb">Time</span>
          <WeSeletorTime v-model="timeEscolhido" :times="times" rotulo="Time" :escudo="editor.escudo" />
        </div>
      </div>
      <div class="lista-itens">
        <button
          v-for="j in rascunho?.jogadores ?? []"
          :key="j.id"
          type="button"
          :aria-current="j.id === editor.jogadorSelecionado"
          @click="editor.jogadorSelecionado = j.id"
        >
          <span class="num">{{ j.camisa }}</span>
          <span class="pos">{{ j.posicao }}</span>
          {{ j.nome }}
          <WeTag v-if="temErro(j.id)" class="marcador" tipo="negativo">Erro</WeTag>
        </button>
      </div>
      <div class="we-panel__body acoes">
        <WeBotao icone="nova" @click="novoJogador">Novo jogador</WeBotao>
        <WeBotao icone="salvar" :desabilitado="!alterado || editor.ocupado" @click="salvar">Salvar elenco</WeBotao>
      </div>
    </WePainel>

    <WePainel v-if="jogador" :titulo="jogador.nome" clube>
      <template #extra>{{ alterado ? 'alterações não salvas' : '' }}</template>

      <ul v-if="problemasDe(jogador.id).length" class="problemas">
        <li v-for="(p, i) in problemasDe(jogador.id)" :key="i" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
      </ul>

      <!-- O jogador do rascunho é editado no lugar pelos campos comuns. -->
      <CamposJogador :model-value="jogador">
        <template #camisa>
          <label class="campo"><span class="we-lb">Camisa (1-32)</span><input v-model.number="jogador.camisa" type="number" min="1" max="32" /></label>
          <label class="campo">
            <span class="we-lb">Camisa real</span>
            <input :value="jogador.camisa_real ?? ''" type="number" min="1" max="99" @input="(e) => definirCamisaReal((e.target as HTMLInputElement).value)" />
          </label>
        </template>
        <template #meio>
          <h3 class="secao-form">Contrato</h3>
          <div class="campos">
            <CampoDinheiro v-model="jogador.contrato.salario_mensal" rotulo="Salário mensal" />
            <label class="campo"><span class="we-lb">Até a temporada</span><input v-model.number="jogador.contrato.ate_temporada" type="number" min="2000" max="2200" /></label>
            <CampoDinheiro v-model="jogador.contrato.multa" rotulo="Multa" />
          </div>
        </template>
      </CamposJogador>

      <div class="acoes rodape-form">
        <WeBotao icone="salvar" :desabilitado="!alterado || editor.ocupado" @click="salvar">Salvar elenco</WeBotao>
        <WeBotao icone="descartar" :desabilitado="!alterado" @click="rascunho = original ? copiar(original) : null">Descartar</WeBotao>
        <WeBotao icone="lixeira" @click="removerJogador">Remover jogador</WeBotao>
      </div>
    </WePainel>
    <WePainel v-else titulo="Jogador"><p>Selecione um jogador ou crie um novo.</p></WePainel>
  </div>
</template>

<style scoped>
.num {
  width: 22px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--texto-suave);
}
.pos {
  width: 26px;
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--texto-suave);
}
.problemas {
  margin: 0;
  padding-left: 18px;
}
.rodape-form {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--linha);
}
</style>
