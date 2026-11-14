<script setup lang="ts">
/**
 * Calendário da temporada do pacote (temporada.json + duração no regras.json): a janela de
 * semanas e o tipo de data de cada competição, na ordem de encaixe. Vale para carreiras novas.
 */
import { computed, ref, watch } from 'vue'
import type { Temporada } from '@shared/esquemas/pacote'
import { datasDoBloco, descreverDatas, SEMANAS_MAXIMO, SEMANAS_MINIMO, validarBlocos } from '@core/competicoes/blocos'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar, igual } from './rascunho'

type Bloco = Temporada['blocos'][number]

const editor = useEditor()
const ui = useUi()

const dados = computed(() => editor.aberto?.temporada ?? { arquivo: null, semanas: 52, semanasDoPacote: false, semanasPadrao: 52 })
const competicoes = computed(() => editor.aberto?.competicoes ?? [])

/** Rascunho: blocos e a duração (null = padrão do jogo). */
const salvo = computed(() => ({ blocos: dados.value.arquivo?.blocos ?? [], semanas: dados.value.semanasDoPacote ? dados.value.semanas : null }))
const rascunho = ref<{ blocos: Bloco[]; semanas: number | null }>({ blocos: [], semanas: null })
watch(salvo, (s) => (rascunho.value = copiar(s)), { immediate: true })

const alterado = computed(() => !igual(rascunho.value, salvo.value))
const semanas = computed(() => rascunho.value.semanas ?? dados.value.semanasPadrao)
const problemas = computed(() => validarBlocos(rascunho.value.blocos, competicoes.value, semanas.value))
const temErro = computed(() => problemas.value.some((p) => p.nivel === 'erro'))

const nomeCompeticao = (id: string) => competicoes.value.find((c) => c.id === id)?.nome ?? id
const livres = computed(() => competicoes.value.filter((c) => !rascunho.value.blocos.some((b) => b.competicao === c.id)))
/** Opções do seletor: as livres, a do próprio bloco (mesmo que não exista mais). */
const opcoesPara = (b: Bloco) => {
  const lista = competicoes.value.filter((c) => c.id === b.competicao || livres.value.includes(c))
  return lista.some((c) => c.id === b.competicao) ? lista : [{ id: b.competicao, nome: `${b.competicao} (não existe)` }, ...lista]
}
const comErro = (b: Bloco) => problemas.value.some((p) => p.nivel === 'erro' && p.competicao === b.competicao)

/** Posição na linha do tempo (em % da temporada). */
const faixa = (inicio: number, fim: number) => {
  const n = semanas.value
  const de = Math.min(Math.max(inicio, 1), n)
  const ate = Math.min(Math.max(fim, de), n)
  return { left: `${((de - 1) / n) * 100}%`, width: `${((ate - de + 1) / n) * 100}%` }
}
const marcas = computed(() => Array.from({ length: Math.floor(semanas.value / 4) + 1 }, (_, i) => Math.max(1, i * 4)).filter((s) => s <= semanas.value))

function adicionar(id: string): void {
  rascunho.value.blocos.push({ competicao: id, datas: 'fds', semana_inicio: 1, semana_fim: semanas.value })
}

function mover(i: number, delta: number): void {
  const lista = rascunho.value.blocos
  const [b] = lista.splice(i, 1)
  if (b) lista.splice(i + delta, 0, b)
}

function remover(i: number): void {
  rascunho.value.blocos.splice(i, 1)
}

function definirSemanas(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value)
  rascunho.value.semanas = Number.isFinite(v) && v > 0 ? Math.trunc(v) : null
}

async function salvar(): Promise<void> {
  const blocos = rascunho.value.blocos.map(({ competicao, datas, semana_inicio, semana_fim }) => ({ competicao, datas, semana_inicio, semana_fim }))
  await editor.salvarTemporada({ blocos }, rascunho.value.semanas)
}

async function descartar(): Promise<void> {
  if (await ui.confirmar('Descartar alterações', 'Voltar o calendário para o que está salvo?', 'Descartar')) rascunho.value = copiar(salvo.value)
}
</script>

<template>
  <WePainel titulo="Calendário da temporada" clube>
    <template #extra>
      <WeTag :tipo="dados.arquivo ? 'info' : undefined">{{ dados.arquivo ? 'temporada.json' : 'Sem temporada.json' }}</WeTag>
    </template>
    <p class="we-lb">
      Cada competição joga dentro da sua janela de semanas, em fins de semana, meios de semana ou nos dois. A ordem da lista é a ordem de encaixe no calendário
      (quem vem antes escolhe as datas primeiro). Competição sem janela usa os fins de semana da temporada inteira. Vale para as carreiras novas deste pacote.
    </p>

    <div class="duracao">
      <label class="campo">
        <span class="we-lb">Semanas na temporada</span>
        <input :value="semanas" type="number" :min="SEMANAS_MINIMO" :max="SEMANAS_MAXIMO" @change="definirSemanas" />
      </label>
      <WeTag :tipo="rascunho.semanas === null ? undefined : 'info'">{{ rascunho.semanas === null ? `Padrão do jogo (${dados.semanasPadrao})` : 'Do pacote (regras.json)' }}</WeTag>
      <WeBotao icone="restaurar" :desabilitado="rascunho.semanas === null" @click="rascunho.semanas = null">Usar o padrão</WeBotao>
    </div>

    <div class="linha-tempo" role="img" :aria-label="`Temporada de ${semanas} semanas com ${rascunho.blocos.length} competição(ões) com janela`">
      <div class="linha-tempo__regua">
        <span v-for="m in marcas" :key="m" class="marca" :style="{ left: faixa(m, m).left }">{{ m }}</span>
      </div>
      <div v-for="(b, i) in rascunho.blocos" :key="i" class="trilha">
        <span class="trilha__nome">{{ nomeCompeticao(b.competicao) }}</span>
        <div class="trilha__fundo">
          <span
            class="bloco"
            :class="[`bloco--${b.datas}`, { 'bloco--erro': comErro(b) }]"
            :style="faixa(b.semana_inicio, b.semana_fim)"
            :title="`${nomeCompeticao(b.competicao)}: semanas ${b.semana_inicio}-${b.semana_fim}, ${descreverDatas(b.datas)}`"
          ></span>
        </div>
      </div>
      <div class="legenda">
        <span><span class="amostra bloco--fds"></span>Fins de semana</span>
        <span><span class="amostra bloco--meio"></span>Meios de semana</span>
        <span><span class="amostra bloco--ambos"></span>Os dois</span>
      </div>
    </div>

    <p v-if="!rascunho.blocos.length" class="we-lb">Nenhuma janela: todas as competições usam os fins de semana da temporada inteira.</p>
    <ol class="lista">
      <li v-for="(b, i) in rascunho.blocos" :key="i" class="item" :class="{ 'item--erro': comErro(b) }">
        <span class="item__n">{{ i + 1 }}</span>
        <label class="campo item__comp">
          <span class="we-lb">Competição</span>
          <select v-model="b.competicao">
            <option v-for="c in opcoesPara(b)" :key="c.id" :value="c.id">{{ c.nome }}</option>
          </select>
        </label>
        <label class="campo">
          <span class="we-lb">Datas</span>
          <select v-model="b.datas">
            <option value="fds">Fins de semana</option>
            <option value="meio">Meios de semana</option>
            <option value="ambos">Os dois</option>
          </select>
        </label>
        <label class="campo item__semana">
          <span class="we-lb">Da semana</span>
          <input v-model.number="b.semana_inicio" type="number" min="1" :max="semanas" />
        </label>
        <label class="campo item__semana">
          <span class="we-lb">Até a semana</span>
          <input v-model.number="b.semana_fim" type="number" min="1" :max="semanas" />
        </label>
        <span class="item__datas">{{ datasDoBloco(b, semanas) }} datas</span>
        <div class="acoes">
          <WeBotao icone="subir" :desabilitado="i === 0" @click="mover(i, -1)">Subir</WeBotao>
          <WeBotao icone="descer" :desabilitado="i === rascunho.blocos.length - 1" @click="mover(i, 1)">Descer</WeBotao>
          <WeBotao icone="lixeira" @click="remover(i)">Remover</WeBotao>
        </div>
      </li>
    </ol>

    <div v-if="livres.length" class="livres">
      <span class="we-lb">Sem janela:</span>
      <WeBotao v-for="c in livres" :key="c.id" icone="nova" @click="adicionar(c.id)">{{ c.nome }}</WeBotao>
    </div>

    <ul v-if="problemas.length" class="problemas">
      <li v-for="(p, k) in problemas" :key="k" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
    </ul>

    <div class="acoes rodape-form">
      <WeBotao icone="salvar" variante="principal" :desabilitado="editor.ocupado || !alterado || temErro" @click="salvar">Salvar temporada</WeBotao>
      <WeBotao icone="descartar" :desabilitado="!alterado" @click="descartar">Descartar</WeBotao>
      <span v-if="alterado" class="we-lb">Alterações não salvas.</span>
    </div>
  </WePainel>
</template>

<style scoped>
.duracao {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.duracao input {
  width: 110px;
}
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
  box-shadow: 2px 2px 0 var(--sombra-dura);
}
.bloco--fds {
  background: var(--clube);
}
.bloco--meio {
  background: var(--info);
}
.bloco--ambos {
  background: repeating-linear-gradient(135deg, var(--clube) 0 6px, var(--info) 6px 12px);
}
.bloco--erro {
  background: repeating-linear-gradient(135deg, var(--negativo) 0 6px, var(--painel-alt) 6px 12px);
}
.legenda {
  display: flex;
  gap: var(--space-4);
  margin-left: 130px;
  font-size: 12px;
  color: var(--texto-suave);
}
.amostra {
  display: inline-block;
  width: 14px;
  height: 10px;
  margin-right: 6px;
  vertical-align: -1px;
}
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.item {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--clube);
  border-radius: var(--radius-sm);
}
.item--erro {
  border-left-color: var(--negativo);
}
.item__n {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  align-self: center;
  min-width: 22px;
  color: var(--texto-forte);
}
.item__comp {
  flex: 1;
  min-width: 180px;
  max-width: 280px;
}
.item__semana input {
  width: 90px;
}
.item__datas {
  align-self: center;
  min-width: 64px;
  font-family: var(--font-display);
  color: var(--texto-suave);
}
.livres {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.problemas {
  margin: 0;
  padding-left: 18px;
}
</style>
