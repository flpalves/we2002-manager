<script setup lang="ts">
/**
 * Janelas de transferência do pacote (regras.json, mercado.janelas): linha do tempo da
 * temporada com as competições e as janelas, e a lista para editar. Vale para carreiras novas.
 */
import { computed, ref, watch } from 'vue'
import type { JanelaTransferencia } from '@shared/esquemas/pacote'
import { ordenarJanelas, validarJanelas } from '@core/mercado/janelas'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar, igual } from './rascunho'

const editor = useEditor()
const ui = useUi()

const dados = computed(() => editor.aberto?.janelas ?? { lista: [], doPacote: false, semanas: 52, blocos: [] })
const semanas = computed(() => dados.value.semanas)
const rascunho = ref<JanelaTransferencia[]>([])
watch(
  () => dados.value.lista,
  (l) => (rascunho.value = copiar(l)),
  { immediate: true },
)
const alterado = computed(() => !igual(rascunho.value, dados.value.lista))
const problemas = computed(() => validarJanelas(rascunho.value, semanas.value))
const temErro = computed(() => problemas.value.some((p) => p.nivel === 'erro'))

const nomeCompeticao = (id: string) => editor.aberto?.competicoes.find((c) => c.id === id)?.nome ?? id
const rotulo = (j: JanelaTransferencia, i: number) => j.nome?.trim() || `Janela ${i + 1}`
/** Índices das janelas que se sobrepõem a outra (pintadas de vermelho na linha do tempo). */
const sobrepostas = computed(() => {
  const r = new Set<number>()
  rascunho.value.forEach((a, i) =>
    rascunho.value.forEach((b, k) => {
      if (i !== k && a.semana_inicio <= b.semana_fim && b.semana_inicio <= a.semana_fim) r.add(i)
    }),
  )
  return r
})
const duracao = (j: JanelaTransferencia) => Math.max(0, j.semana_fim - j.semana_inicio + 1)

/** Posição na linha do tempo (em % da temporada). */
const faixa = (inicio: number, fim: number) => {
  const n = semanas.value
  const de = Math.min(Math.max(inicio, 1), n)
  const ate = Math.min(Math.max(fim, de), n)
  return { left: `${((de - 1) / n) * 100}%`, width: `${((ate - de + 1) / n) * 100}%` }
}
const marcas = computed(() => Array.from({ length: Math.floor(semanas.value / 4) + 1 }, (_, i) => Math.max(1, i * 4)).filter((s) => s <= semanas.value))

function adicionar(): void {
  const fimUltima = Math.max(0, ...rascunho.value.map((j) => j.semana_fim))
  const inicio = Math.min(semanas.value, fimUltima + 6)
  rascunho.value.push({ nome: '', semana_inicio: inicio, semana_fim: Math.min(semanas.value, inicio + 3) })
}

function remover(i: number): void {
  rascunho.value.splice(i, 1)
}

async function salvar(): Promise<void> {
  const limpas = ordenarJanelas(rascunho.value).map((j) => {
    const nome = j.nome?.trim()
    return { semana_inicio: j.semana_inicio, semana_fim: j.semana_fim, ...(nome ? { nome } : {}) }
  })
  await editor.salvarJanelas(limpas)
}

async function restaurarPadrao(): Promise<void> {
  if (await ui.confirmar('Voltar ao padrão', 'Tirar as janelas do regras.json deste pacote e usar as padrão do jogo?', 'Voltar ao padrão')) await editor.salvarJanelas(null)
}

async function descartar(): Promise<void> {
  if (await ui.confirmar('Descartar alterações', 'Voltar as janelas para o que está salvo?', 'Descartar')) rascunho.value = copiar(dados.value.lista)
}
</script>

<template>
  <WePainel titulo="Janelas de transferência" clube>
    <template #extra>
      <WeTag :tipo="dados.doPacote ? 'info' : undefined">{{ dados.doPacote ? 'Do pacote' : 'Padrão do jogo' }}</WeTag>
    </template>
    <p class="we-lb">
      Dentro de uma janela vale comprar e emprestar; fora dela só jogadores livres e renovações. As semanas são as da temporada (1-{{ semanas }}). Vale para as carreiras
      novas deste pacote.
    </p>

    <div class="linha-tempo" role="img" :aria-label="`Temporada de ${semanas} semanas com ${rascunho.length} janela(s)`">
      <div class="linha-tempo__regua">
        <span v-for="m in marcas" :key="m" class="marca" :style="{ left: faixa(m, m).left }">{{ m }}</span>
      </div>
      <div v-for="b in dados.blocos" :key="b.competicao" class="trilha">
        <span class="trilha__nome">{{ nomeCompeticao(b.competicao) }}</span>
        <div class="trilha__fundo">
          <span class="bloco" :style="faixa(b.semana_inicio, b.semana_fim)"></span>
        </div>
      </div>
      <div class="trilha trilha--janelas">
        <span class="trilha__nome">Janelas</span>
        <div class="trilha__fundo">
          <span v-for="(j, i) in rascunho" :key="i" class="janela" :class="{ 'janela--conflito': sobrepostas.has(i) }" :style="faixa(j.semana_inicio, j.semana_fim)" :title="`${rotulo(j, i)}: semanas ${j.semana_inicio}-${j.semana_fim}`">
            {{ rotulo(j, i) }}
          </span>
        </div>
      </div>
    </div>

    <p v-if="!rascunho.length" class="we-lb">Nenhuma janela: o mercado fica fechado o ano todo (só livres e renovações).</p>
    <div v-for="(j, i) in rascunho" :key="i" class="item">
      <span class="item__n">{{ i + 1 }}</span>
      <label class="campo item__nome">
        <span class="we-lb">Nome (opcional)</span>
        <input v-model="j.nome" type="text" maxlength="40" :placeholder="`Janela ${i + 1}`" />
      </label>
      <label class="campo item__semana">
        <span class="we-lb">Abre na semana</span>
        <input v-model.number="j.semana_inicio" type="number" min="1" :max="semanas" />
      </label>
      <label class="campo item__semana">
        <span class="we-lb">Fecha na semana</span>
        <input v-model.number="j.semana_fim" type="number" min="1" :max="semanas" />
      </label>
      <span class="item__duracao">{{ duracao(j) }} sem.</span>
      <WeBotao icone="lixeira" @click="remover(i)">Remover</WeBotao>
    </div>

    <div class="acoes">
      <WeBotao icone="nova" @click="adicionar">Adicionar janela</WeBotao>
    </div>

    <ul v-if="problemas.length" class="problemas">
      <li v-for="(p, k) in problemas" :key="k" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
    </ul>

    <div class="acoes rodape-form">
      <WeBotao icone="salvar" variante="principal" :desabilitado="editor.ocupado || !alterado || temErro" @click="salvar">Salvar janelas</WeBotao>
      <WeBotao icone="descartar" :desabilitado="!alterado" @click="descartar">Descartar</WeBotao>
      <WeBotao icone="restaurar" :desabilitado="editor.ocupado || !dados.doPacote" @click="restaurarPadrao">Voltar ao padrão</WeBotao>
    </div>
  </WePainel>
</template>

<style scoped>
.linha-tempo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) 0;
}
.linha-tempo__regua {
  position: relative;
  height: 14px;
  margin-left: 130px;
}
.marca {
  position: absolute;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--texto-suave);
  transform: translateX(-2px);
}
.trilha {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
}
.trilha__nome {
  font-size: 12px;
  color: var(--texto-suave);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 8px;
}
.trilha__fundo {
  position: relative;
  height: 20px;
  background: var(--painel-fundo);
  border: 1px solid var(--linha);
}
.bloco {
  position: absolute;
  top: 3px;
  bottom: 3px;
  background: var(--linha-forte);
}
.trilha--janelas .trilha__fundo {
  height: 26px;
}
.janela {
  position: absolute;
  top: 2px;
  bottom: 2px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  overflow: hidden;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--clube);
  color: var(--sobre-clube);
  box-shadow: 2px 2px 0 var(--sombra-dura);
  border-right: 2px solid var(--painel-fundo);
  box-sizing: border-box;
}
.janela--conflito {
  background: repeating-linear-gradient(135deg, var(--negativo) 0 6px, var(--clube) 6px 12px);
  color: #111111;
}
.item {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--clube);
  border-radius: var(--radius-sm);
}
.item__n {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  align-self: center;
  min-width: 22px;
  color: var(--texto-forte);
}
.item__nome {
  flex: 1;
  max-width: 280px;
}
.item__semana input {
  width: 90px;
}
.item__duracao {
  align-self: center;
  min-width: 56px;
  font-family: var(--font-display);
  color: var(--texto-suave);
}
.problemas {
  margin: 0;
  padding-left: 18px;
}
</style>
