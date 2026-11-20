<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PORTES, type Time } from '@shared/esquemas/pacote'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeEscudo from '../../componentes/WeEscudo.vue'
import WeTag from '../../componentes/WeTag.vue'
import CampoDinheiro from '../../componentes/CampoDinheiro.vue'
import WeSeletorTime from '../../componentes/WeSeletorTime.vue'
import PainelUniformes from './PainelUniformes.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar, igual } from './rascunho'

const editor = useEditor()
const ui = useUi()

const times = computed(() => [...(editor.aberto?.times ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)))
const original = computed(() => editor.aberto?.times.find((t) => t.sigla === editor.timeSelecionado) ?? null)
const rascunho = ref<Time | null>(null)
const novo = ref(false)
/** Seção mostrada do time: os dados (identificação, estádio, finanças) ou os uniformes. */
const secao = ref<'dados' | 'uniformes'>('dados')
const painelUniformes = ref<InstanceType<typeof PainelUniformes> | null>(null)
const uniformesAlterados = computed(() => !!painelUniformes.value?.algumAlterado)
const alterado = computed(() => novo.value || (rascunho.value !== null && !igual(rascunho.value, original.value)))

const problemasDoTime = (sigla: string) => editor.aberto?.problemas.filter((p) => p.time === sigla && !p.jogador) ?? []
const errosDoTime = (sigla: string) => editor.aberto?.problemas.filter((p) => p.time === sigla && p.nivel === 'erro').length ?? 0

watch(
  original,
  (t) => {
    if (novo.value) return
    rascunho.value = t ? copiar(t) : null
  },
  { immediate: true },
)

if (!editor.timeSelecionado && times.value[0]) editor.timeSelecionado = times.value[0].sigla

const confirmarDescarte = () => ui.confirmar('Descartar alterações', 'Há alterações não salvas neste time. Descartar?', 'Descartar')

async function selecionar(sigla: string): Promise<void> {
  if (sigla === editor.timeSelecionado && !novo.value) return
  if ((alterado.value || uniformesAlterados.value) && !(await confirmarDescarte())) return
  novo.value = false
  editor.timeSelecionado = sigla
  rascunho.value = original.value ? copiar(original.value) : null
}

function siglaLivre(): string {
  const usadas = new Set(editor.aberto?.times.map((t) => t.sigla))
  for (let i = 1; ; i++) {
    const s = i === 1 ? 'NOVO' : `NOV${i}`
    if (!usadas.has(s)) return s
  }
}

const timeEscolhido = computed({
  get: () => (novo.value ? '' : (editor.timeSelecionado ?? '')),
  set: (sigla: string) => void selecionar(sigla),
})

/**
 * Dados e uniformes gravam o mesmo arquivo do time, e cada um recarrega o seu rascunho quando o
 * outro salva: para não perder nada calado, trocar de seção com alterações pendentes pede descarte.
 */
async function mudarSecao(s: 'dados' | 'uniformes'): Promise<void> {
  if (s === secao.value) return
  const pendente = s === 'uniformes' ? alterado.value : uniformesAlterados.value
  if (pendente && !(await confirmarDescarte())) return
  if (s === 'uniformes') descartar()
  else painelUniformes.value?.recarregar()
  secao.value = s
}

async function criarTime(): Promise<void> {
  if ((alterado.value || uniformesAlterados.value) && !(await confirmarDescarte())) return
  secao.value = 'dados'
  novo.value = true
  rascunho.value = {
    sigla: siglaLivre(),
    nome: 'Novo time',
    nome_curto: 'NOVO TIME',
    pais: 'BRA',
    cores: ['#555555', '#FFFFFF'],
    porte: 'pequeno',
    formacao: '4-4-2A',
    jogadores: [],
  }
}

async function salvar(): Promise<void> {
  const t = rascunho.value
  if (!t) return
  t.sigla = t.sigla.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,5}$/.test(t.sigla)) return ui.avisar('A sigla precisa ter de 2 a 5 letras maiúsculas ou números.')
  const anterior = novo.value ? undefined : (editor.timeSelecionado ?? undefined)
  if (t.sigla !== anterior && editor.aberto?.times.some((x) => x.sigla === t.sigla)) return ui.avisar(`Já existe um time com a sigla ${t.sigla}.`)
  if (await editor.salvarTime(copiar(t), anterior)) {
    novo.value = false
    editor.timeSelecionado = t.sigla
    rascunho.value = original.value ? copiar(original.value) : null
  }
}

function descartar(): void {
  novo.value = false
  rascunho.value = original.value ? copiar(original.value) : null
}

function editarJogadores(): void {
  editor.origemJogadores = 'times'
  editor.aba = 'jogadores'
}

async function remover(): Promise<void> {
  const t = original.value
  if (!t) return
  const ok = await ui.confirmar('Remover time', `Remover ${t.nome} (${t.jogadores.length} jogadores) do pacote? O arquivo times/${t.sigla}.json será apagado.`, 'Remover', true)
  if (ok && (await editor.removerTime(t.sigla))) editor.timeSelecionado = times.value[0]?.sigla ?? null
}

// Estádio e finanças são opcionais (sem eles valem os padrões do porte).
function alternarEstadio(): void {
  const t = rascunho.value
  if (!t) return
  if (t.estadio) delete t.estadio
  else t.estadio = { nome: `Estádio do ${t.nome}`, capacidade: 20000, ingresso_padrao: 4000, custo_por_jogo: 10_000_000 }
}
function alternarFinancas(): void {
  const t = rascunho.value
  if (!t) return
  if (t.financas) delete t.financas
  else t.financas = { saldo_inicial: 0, patrocinio_temporada: 0, orcamento_folha_mensal: 0 }
}
function definirCor(i: number, cor: string): void {
  if (rascunho.value) rascunho.value.cores[i] = cor.toUpperCase()
}
function removerCor(i: number): void {
  rascunho.value?.cores.splice(i, 1)
}
</script>

<template>
  <div class="barra-time">
    <span class="we-lb">Time</span>
    <div class="seletor">
      <WeSeletorTime v-model="timeEscolhido" :times="times" rotulo="Time" :escudo="editor.escudo" :placeholder="novo ? 'Novo time (não salvo)' : 'Escolha um time'" />
    </div>
    <WeTag v-if="!novo && editor.timeSelecionado && errosDoTime(editor.timeSelecionado)" tipo="negativo">{{ errosDoTime(editor.timeSelecionado) }} erro(s)</WeTag>
    <div class="acoes" role="group" aria-label="Seção do time">
      <WeBotao icone="clube" :ativo="secao === 'dados'" @click="mudarSecao('dados')">Dados do clube</WeBotao>
      <WeBotao icone="camisa" :ativo="secao === 'uniformes'" :desabilitado="novo" @click="mudarSecao('uniformes')">Uniformes</WeBotao>
    </div>
    <WeBotao class="novo" icone="nova" @click="criarTime">Novo time</WeBotao>
  </div>

  <template v-if="rascunho">
    <PainelUniformes v-if="!novo && original" v-show="secao === 'uniformes'" ref="painelUniformes" :time="original" />
    <WePainel v-show="secao === 'dados'" :titulo="novo ? 'Novo time' : rascunho.nome" clube>
      <template #extra>{{ rascunho.jogadores.length }} jogadores</template>

      <div class="escudo-linha">
        <WeEscudo :sigla="rascunho.sigla" :cor="rascunho.cores[0]" :src="novo ? undefined : editor.escudo(rascunho.sigla)" tamanho="m" />
        <div>
          <p v-if="!novo && !editor.escudo(rascunho.sigla)" class="we-vl--negativo">Falta o escudo escudos/{{ rascunho.sigla }}.png</p>
          <WeBotao icone="importar" :desabilitado="novo" @click="editor.importarEscudo(rascunho.sigla)">Importar escudo (PNG)</WeBotao>
          <p v-if="novo" class="we-lb">Salve o time antes de importar o escudo.</p>
        </div>
      </div>

      <ul v-if="!novo && problemasDoTime(rascunho.sigla).length" class="problemas">
        <li v-for="(p, i) in problemasDoTime(rascunho.sigla)" :key="i" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
      </ul>

      <h3 class="secao-form">Identificação</h3>
      <div class="campos">
        <label class="campo"><span class="we-lb">Sigla</span><input v-model="rascunho.sigla" type="text" maxlength="5" /></label>
        <label class="campo campos--largo"><span class="we-lb">Nome</span><input v-model="rascunho.nome" type="text" /></label>
        <label class="campo">
          <span class="we-lb">Nome curto (WE) {{ rascunho.nome_curto.length }}/10</span>
          <input v-model="rascunho.nome_curto" type="text" maxlength="20" :aria-invalid="rascunho.nome_curto.length > 10" />
        </label>
        <label class="campo">
          <span class="we-lb">País</span>
          <select v-model="rascunho.pais">
            <option v-for="p in editor.aberto?.paises" :key="p.codigo" :value="p.codigo">{{ p.nome }}</option>
          </select>
        </label>
        <label class="campo">
          <span class="we-lb">Estado (UF)</span>
          <input :value="rascunho.estado ?? ''" type="text" maxlength="2" @input="(e) => { const v = (e.target as HTMLInputElement).value.toUpperCase(); if (v) rascunho!.estado = v; else delete rascunho!.estado }" />
        </label>
        <label class="campo">
          <span class="we-lb">Porte</span>
          <select v-model="rascunho.porte">
            <option v-for="p in PORTES" :key="p" :value="p">{{ { grande: 'Grande', medio: 'Médio', pequeno: 'Pequeno' }[p] }}</option>
          </select>
        </label>
        <label class="campo"><span class="we-lb">Formação (WE)</span><input v-model="rascunho.formacao" type="text" /></label>
      </div>

      <h3 class="secao-form">Cores (a 1ª é a cor do clube na interface)</h3>
      <div class="acoes cores">
        <span v-for="(c, i) in rascunho.cores" :key="i" class="campo campo--check">
          <input type="color" :value="c" :aria-label="`Cor ${i + 1}`" @input="(e) => definirCor(i, (e.target as HTMLInputElement).value)" />
          <span class="we-lb">{{ c }}</span>
          <WeBotao v-if="rascunho.cores.length > 1" icone="descartar" @click="removerCor(i)">Tirar</WeBotao>
        </span>
        <WeBotao v-if="rascunho.cores.length < 3" icone="nova" @click="rascunho.cores.push('#FFFFFF')">Adicionar cor</WeBotao>
      </div>

      <h3 class="secao-form">Estádio</h3>
      <div v-if="rascunho.estadio" class="campos">
        <label class="campo campos--largo"><span class="we-lb">Nome</span><input v-model="rascunho.estadio.nome" type="text" /></label>
        <label class="campo"><span class="we-lb">Capacidade</span><input v-model.number="rascunho.estadio.capacidade" type="number" min="0" /></label>
        <CampoDinheiro v-model="rascunho.estadio.ingresso_padrao" rotulo="Ingresso" />
        <CampoDinheiro v-model="rascunho.estadio.custo_por_jogo" rotulo="Custo por jogo" />
      </div>
      <p v-else class="we-lb">Sem estádio: usa o padrão do porte.</p>
      <div><WeBotao icone="clube" @click="alternarEstadio">{{ rascunho.estadio ? 'Usar padrão do porte' : 'Definir estádio' }}</WeBotao></div>

      <h3 class="secao-form">Finanças iniciais</h3>
      <div v-if="rascunho.financas" class="campos">
        <CampoDinheiro v-model="rascunho.financas.saldo_inicial" rotulo="Saldo inicial" />
        <CampoDinheiro v-model="rascunho.financas.patrocinio_temporada" rotulo="Patrocínio/temporada" />
        <CampoDinheiro v-model="rascunho.financas.orcamento_folha_mensal" rotulo="Orçamento da folha/mês" />
      </div>
      <p v-else class="we-lb">Sem finanças: usa o padrão do porte.</p>
      <div><WeBotao icone="financas" @click="alternarFinancas">{{ rascunho.financas ? 'Usar padrão do porte' : 'Definir finanças' }}</WeBotao></div>

      <div class="acoes rodape-form">
        <WeBotao icone="salvar" :desabilitado="!alterado || editor.ocupado" @click="salvar">Salvar time</WeBotao>
        <WeBotao icone="descartar" :desabilitado="!alterado" @click="descartar">Descartar</WeBotao>
        <WeBotao v-if="!novo" icone="elenco" @click="editarJogadores">Editar jogadores</WeBotao>
        <WeBotao v-if="!novo" icone="lixeira" @click="remover">Remover time</WeBotao>
      </div>
    </WePainel>
  </template>
  <WePainel v-else titulo="Times"><p>Escolha um time ou crie um novo.</p></WePainel>
</template>

<style scoped>
.barra-time {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.seletor {
  width: min(360px, 100%);
}
.novo {
  margin-left: auto;
}
.escudo-linha {
  display: flex;
  gap: var(--space-4);
  align-items: center;
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
.cores .we-btn {
  padding: 4px 10px;
}
</style>
