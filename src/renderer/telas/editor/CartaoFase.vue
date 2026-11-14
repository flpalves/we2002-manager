<script setup lang="ts">
/**
 * Uma fase da competição no editor visual: formato, regras do formato, quantos se classificam,
 * desempate e zonas da tabela. A conta "entram → saem" vem de core/pacote/editorFases.
 */
import { computed, ref, watch } from 'vue'
import type { Fase } from '@shared/esquemas/pacote'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import {
  DESEMPATE_PADRAO,
  ROTULO_DESEMPATE,
  ROTULO_FORMATO,
  etapasDoMataMata,
  type CriterioDesempate,
  type FormatoFase,
  type ResumoFase,
} from '@core/pacote/editorFases'

const props = defineProps<{
  indice: number
  total: number
  resumo: ResumoFase | undefined
  /** Ids das outras fases (para não repetir). */
  outrosIds: string[]
}>()
const fase = defineModel<Fase>({ required: true })
const emit = defineEmits<{
  formato: [formato: FormatoFase]
  renomear: [id: string]
  mover: [passo: -1 | 1]
  remover: []
}>()

const ultima = computed(() => props.indice === props.total - 1)
const FORMATOS: FormatoFase[] = ['pontos_corridos', 'grupos', 'mata_mata']

// Id: edita num campo local e só aplica ao sair (troca as referências de uma vez).
const textoId = ref(fase.value.id)
watch(
  () => fase.value.id,
  (id) => (textoId.value = id),
)
const erroId = computed(() => {
  const id = textoId.value.trim()
  if (!id) return 'O id não pode ficar vazio.'
  if (props.outrosIds.includes(id)) return 'Já existe outra fase com esse id.'
  return null
})
function aplicarId(): void {
  if (erroId.value) {
    textoId.value = fase.value.id
    return
  }
  const id = textoId.value.trim()
  if (id !== fase.value.id) emit('renomear', id)
}

const num = (e: Event) => Number((e.target as HTMLInputElement).value)

// ---------------------------------------------------------------- classificam

/** Pontos corridos e mata-mata: vazio = padrão (última fase: campeão; mata-mata: metade). */
function definirClassificam(v: string): void {
  const f = fase.value
  const n = v === '' ? undefined : Math.max(1, Number(v))
  if (f.formato === 'pontos_corridos') {
    if (n) f.pontos_corridos.classificam = n
    else delete f.pontos_corridos.classificam
  } else if (f.formato === 'mata_mata') {
    if (n) f.mata_mata.classificam = n
    else delete f.mata_mata.classificam
  }
}
const padraoClassificam = computed(() => {
  if (fase.value.formato === 'mata_mata') return ultima.value ? 'campeão' : 'metade'
  return ultima.value ? 'campeão' : 'todos'
})
const etapas = computed(() => {
  const r = props.resumo
  if (fase.value.formato !== 'mata_mata' || !r || r.entram === null || r.saem === null) return []
  return etapasDoMataMata(r.entram, r.saem)
})

// ---------------------------------------------------------------- desempate

const desempate = computed(() => (fase.value.formato === 'mata_mata' ? [] : (fase.value.desempate ?? DESEMPATE_PADRAO)))
const faltando = computed(() => DESEMPATE_PADRAO.filter((c) => !desempate.value.includes(c)))
const novoCriterio = ref<CriterioDesempate | ''>('')
function definirDesempate(l: CriterioDesempate[]): void {
  fase.value.desempate = l
}
function moverCriterio(i: number, passo: -1 | 1): void {
  const l = [...desempate.value]
  const j = i + passo
  if (j < 0 || j >= l.length) return
  ;[l[i], l[j]] = [l[j]!, l[i]!]
  definirDesempate(l)
}
function tirarCriterio(i: number): void {
  definirDesempate(desempate.value.filter((_, k) => k !== i))
}
function porCriterio(): void {
  if (!novoCriterio.value) return
  definirDesempate([...desempate.value, novoCriterio.value])
  novoCriterio.value = ''
}

// ---------------------------------------------------------------- zonas

const CORES_ZONA = [
  { valor: 'positivo', rotulo: 'Verde' },
  { valor: 'info', rotulo: 'Azul' },
  { valor: 'atencao', rotulo: 'Amarelo' },
  { valor: 'negativo', rotulo: 'Vermelho' },
  { valor: 'diretoria', rotulo: 'Diretoria' },
] as const
/** Linhas da tabela (pontos corridos: quem entra; grupos: tamanho de cada grupo). */
const linhasTabela = computed(() => {
  const f = fase.value
  if (f.formato === 'grupos') return f.grupos.tamanho
  return props.resumo?.entram ?? null
})
function porZona(): void {
  const f = fase.value
  const zonas = f.zonas ?? []
  const n = linhasTabela.value ?? 4
  const saem = f.formato === 'grupos' ? f.grupos.classificam : (props.resumo?.saem ?? 1)
  const zona = zonas.length ? { de: Math.max(1, n - 3), ate: n, nome: 'Rebaixamento', cor: 'negativo' as const } : { de: 1, ate: Math.min(n, saem), nome: ultima.value ? 'Título' : 'Classificação', cor: 'info' as const }
  f.zonas = [...zonas, zona]
}
function tirarZona(i: number): void {
  const z = (fase.value.zonas ?? []).filter((_, k) => k !== i)
  if (z.length) fase.value.zonas = z
  else delete fase.value.zonas
}
</script>

<template>
  <article class="fase" :class="{ 'fase--erro': resumo?.problema }">
    <header class="fase__topo">
      <span class="fase__n">{{ indice + 1 }}</span>
      <label class="campo fase__nome">
        <span class="we-lb">Nome</span>
        <input v-model="fase.nome" type="text" />
      </label>
      <label class="campo fase__id">
        <span class="we-lb">Id</span>
        <input v-model="textoId" type="text" spellcheck="false" :aria-invalid="!!erroId" @change="aplicarId" @keydown.enter="aplicarId" />
      </label>
      <div class="acoes fase__mover">
        <WeBotao icone="subir" :desabilitado="indice === 0" @click="emit('mover', -1)">Subir</WeBotao>
        <WeBotao icone="descer" :desabilitado="ultima" @click="emit('mover', 1)">Descer</WeBotao>
        <WeBotao icone="lixeira" :desabilitado="total <= 1" @click="emit('remover')">Remover</WeBotao>
      </div>
    </header>
    <p v-if="erroId" class="we-vl--negativo fase__aviso">{{ erroId }}</p>

    <div class="acoes" role="group" :aria-label="`Formato da fase ${fase.nome}`">
      <WeBotao v-for="f in FORMATOS" :key="f" :ativo="fase.formato === f" @click="emit('formato', f)">{{ ROTULO_FORMATO[f] }}</WeBotao>
    </div>

    <!-- Regras do formato -->
    <div v-if="fase.formato === 'pontos_corridos'" class="campos">
      <label class="campo">
        <span class="we-lb">Turnos</span>
        <select v-model.number="fase.pontos_corridos.turnos">
          <option :value="1">1 (só ida)</option>
          <option :value="2">2 (ida e volta)</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
        </select>
      </label>
      <label class="campo">
        <span class="we-lb">Classificam{{ ultima ? '' : ' (obrigatório)' }}</span>
        <input
          :value="fase.pontos_corridos.classificam ?? ''"
          type="number"
          min="1"
          :placeholder="padraoClassificam"
          @change="(e) => definirClassificam((e.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <div v-else-if="fase.formato === 'grupos'" class="campos">
      <label class="campo">
        <span class="we-lb">Grupos</span>
        <input :value="fase.grupos.quantidade" type="number" min="1" @change="(e) => fase.formato === 'grupos' && (fase.grupos.quantidade = Math.max(1, num(e)))" />
      </label>
      <label class="campo">
        <span class="we-lb">Times por grupo</span>
        <input :value="fase.grupos.tamanho" type="number" min="2" @change="(e) => fase.formato === 'grupos' && (fase.grupos.tamanho = Math.max(2, num(e)))" />
      </label>
      <label class="campo">
        <span class="we-lb">Turnos</span>
        <select v-model.number="fase.grupos.turnos">
          <option :value="1">1 (só ida)</option>
          <option :value="2">2 (ida e volta)</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
        </select>
      </label>
      <label class="campo">
        <span class="we-lb">Classificam por grupo</span>
        <input :value="fase.grupos.classificam" type="number" min="1" @change="(e) => fase.formato === 'grupos' && (fase.grupos.classificam = Math.max(1, num(e)))" />
      </label>
      <label class="campo">
        <span class="we-lb">Sorteio</span>
        <select v-model="fase.grupos.sorteio">
          <option value="potes">Por potes (ranking)</option>
          <option value="livre">Livre</option>
        </select>
      </label>
      <p class="conta">{{ fase.grupos.quantidade }} × {{ fase.grupos.tamanho }} = {{ fase.grupos.quantidade * fase.grupos.tamanho }} times</p>
    </div>

    <div v-else class="campos">
      <div class="campo campo--duplo">
        <span class="we-lb">Jogos por confronto</span>
        <div class="acoes" role="group" aria-label="Jogos por confronto">
          <WeBotao :ativo="fase.mata_mata.jogos === 1" @click="fase.formato === 'mata_mata' && (fase.mata_mata.jogos = 1)">Jogo único</WeBotao>
          <WeBotao :ativo="fase.mata_mata.jogos === 2" @click="fase.formato === 'mata_mata' && (fase.mata_mata.jogos = 2)">Ida e volta</WeBotao>
        </div>
      </div>
      <label class="campo">
        <span class="we-lb">Mando {{ fase.mata_mata.jogos === 2 ? 'do 2º jogo' : 'do jogo' }}</span>
        <select v-model="fase.mata_mata.mando">
          <option value="melhor_campanha">Melhor campanha</option>
          <option value="pior_campanha">Pior campanha</option>
          <option value="sorteio">Sorteio</option>
        </select>
      </label>
      <label class="campo">
        <span class="we-lb">Classificam</span>
        <input
          :value="fase.mata_mata.classificam ?? ''"
          type="number"
          min="1"
          :placeholder="padraoClassificam"
          @change="(e) => definirClassificam((e.target as HTMLInputElement).value)"
        />
      </label>
      <label v-if="fase.mata_mata.jogos === 2" class="campo campo--check">
        <input v-model="fase.mata_mata.gol_fora" type="checkbox" />
        Gol fora desempata
      </label>
      <label class="campo campo--check">
        <input v-model="fase.mata_mata.prorrogacao" type="checkbox" />
        Prorrogação
      </label>
      <p class="conta campos--largo">
        Empate no fim{{ fase.mata_mata.jogos === 2 ? ' do agregado' : '' }}:
        {{ [fase.mata_mata.jogos === 2 && fase.mata_mata.gol_fora && 'gol fora', fase.mata_mata.prorrogacao && 'prorrogação', 'pênaltis'].filter(Boolean).join(' → ') }}.
        <template v-if="etapas.length"> Etapas: {{ etapas.join(' → ') }}.</template>
      </p>
    </div>

    <!-- Desempate e zonas (só fases com tabela) -->
    <template v-if="fase.formato !== 'mata_mata'">
      <details class="dobra">
        <summary class="we-lb">Desempate: {{ desempate.map((c) => ROTULO_DESEMPATE[c]).join(', ') || 'nenhum' }}</summary>
        <ol class="criterios">
          <li v-for="(c, i) in desempate" :key="c">
            <span class="criterios__n">{{ i + 1 }}º</span>
            <span class="criterios__nome">{{ ROTULO_DESEMPATE[c] }}</span>
            <WeBotao icone="subir" :desabilitado="i === 0" :aria-label="`Subir ${ROTULO_DESEMPATE[c]}`" @click="moverCriterio(i, -1)" />
            <WeBotao icone="descer" :desabilitado="i === desempate.length - 1" :aria-label="`Descer ${ROTULO_DESEMPATE[c]}`" @click="moverCriterio(i, 1)" />
            <WeBotao icone="descartar" :aria-label="`Tirar ${ROTULO_DESEMPATE[c]}`" @click="tirarCriterio(i)">Tirar</WeBotao>
          </li>
        </ol>
        <div class="acoes">
          <select v-if="faltando.length" v-model="novoCriterio" aria-label="Critério para acrescentar" @change="porCriterio">
            <option value="">Acrescentar critério…</option>
            <option v-for="c in faltando" :key="c" :value="c">{{ ROTULO_DESEMPATE[c] }}</option>
          </select>
          <WeBotao icone="restaurar" @click="definirDesempate([...DESEMPATE_PADRAO])">Ordem padrão</WeBotao>
        </div>
      </details>

      <details class="dobra" :open="!!fase.zonas?.length">
        <summary class="we-lb">Zonas da tabela ({{ fase.zonas?.length ?? 0 }}){{ fase.formato === 'grupos' ? ', em cada grupo' : '' }}</summary>
        <div v-for="(z, i) in fase.zonas ?? []" :key="i" class="zona">
          <span class="zona__cor" :class="`zona__cor--${z.cor}`" aria-hidden="true"></span>
          <label class="campo"><span class="we-lb">De</span><input v-model.number="z.de" type="number" min="1" :max="linhasTabela ?? undefined" /></label>
          <label class="campo"><span class="we-lb">Até</span><input v-model.number="z.ate" type="number" min="1" :max="linhasTabela ?? undefined" /></label>
          <label class="campo zona__nome"><span class="we-lb">Nome</span><input v-model="z.nome" type="text" /></label>
          <label class="campo">
            <span class="we-lb">Cor</span>
            <select v-model="z.cor">
              <option v-for="c in CORES_ZONA" :key="c.valor" :value="c.valor">{{ c.rotulo }}</option>
            </select>
          </label>
          <WeBotao icone="descartar" @click="tirarZona(i)">Tirar</WeBotao>
        </div>
        <div class="acoes"><WeBotao icone="nova" @click="porZona">Acrescentar zona</WeBotao></div>
      </details>
    </template>

    <footer class="fase__resumo">
      <template v-if="resumo">
        <span>Entram <b>{{ resumo.entram ?? '?' }}</b></span>
        <span>{{ ultima && resumo.saem === 1 ? 'Campeão' : 'Classificam' }} <b>{{ resumo.saem ?? '?' }}</b></span>
        <span v-if="resumo.rodadas !== null"><b>{{ resumo.rodadas }}</b> rodada(s)</span>
        <WeTag v-if="resumo.problema" tipo="negativo">Não fecha</WeTag>
      </template>
    </footer>
    <p v-if="resumo?.problema" class="we-vl--negativo fase__aviso">{{ resumo.problema }}</p>
  </article>
</template>

<style scoped>
.fase {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--clube);
  border-radius: var(--radius-sm);
}
.fase--erro {
  border-left-color: var(--negativo);
}
.fase__topo {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.fase__n {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  min-width: 28px;
  color: var(--texto-forte);
  align-self: center;
}
.fase__nome {
  flex: 1;
  min-width: 160px;
}
.fase__id {
  width: 130px;
}
.fase__mover {
  margin-left: auto;
}
.conta {
  margin: 0;
  align-self: end;
  font-size: 13px;
  color: var(--texto-suave);
}
.campo--duplo {
  grid-column: span 2;
}
.fase__aviso {
  margin: 0;
}
.dobra summary {
  cursor: pointer;
  padding: 2px 0;
}
.dobra[open] summary {
  margin-bottom: 6px;
}
.criterios {
  list-style: none;
  margin: 0 0 6px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.criterios li {
  display: flex;
  align-items: center;
  gap: 6px;
}
.criterios__n {
  font-family: var(--font-display);
  min-width: 26px;
  color: var(--texto-suave);
}
.criterios__nome {
  min-width: 150px;
}
.zona {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  margin-bottom: 6px;
}
.zona input[type='number'] {
  width: 64px;
}
.zona__nome {
  flex: 1;
  max-width: 220px;
}
.zona__cor {
  width: 6px;
  align-self: stretch;
  border-radius: 1px;
}
.zona__cor--positivo {
  background: var(--positivo);
}
.zona__cor--info {
  background: var(--info);
}
.zona__cor--atencao {
  background: var(--atencao);
}
.zona__cor--negativo {
  background: var(--negativo);
}
.zona__cor--diretoria {
  background: var(--diretoria, var(--clube));
}
.fase__resumo {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding-top: 6px;
  border-top: 1px solid var(--linha);
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--texto-suave);
}
.fase__resumo b {
  color: var(--texto-forte);
  font-size: 15px;
}
</style>
