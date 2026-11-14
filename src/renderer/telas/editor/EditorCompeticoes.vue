<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CompeticaoSchema, type Competicao, type SaidaCompeticao } from '@shared/esquemas/pacote'
import {
  ROTULO_FORMATO,
  encadear,
  faseNova,
  moverFase,
  removerFase,
  renomearFase,
  resumirFases,
  saidasQueCitam,
  trocarFormato,
  type FormatoFase,
} from '@core/pacote/editorFases'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeEscudo from '../../componentes/WeEscudo.vue'
import WeTag from '../../componentes/WeTag.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar } from './rascunho'
import CartaoFase from './CartaoFase.vue'
import EditorSaidas from './EditorSaidas.vue'
import { filtrarTimes } from '../../busca'

const editor = useEditor()
const ui = useUi()

const competicoes = computed(() => editor.aberto?.competicoes ?? [])
if (!editor.competicaoSelecionada && competicoes.value[0]) editor.competicaoSelecionada = competicoes.value[0].id

const original = computed(() => competicoes.value.find((c) => c.id === editor.competicaoSelecionada) ?? null)
const rascunho = ref<Competicao | null>(null)
const novo = ref(false)
// Fases e saídas: editor visual; o modo JSON fica para o que o visual não cobre (ex.: "entram").
const modoJson = ref(false)
const textoFases = ref('')
const textoSaidas = ref('')
const erroJson = ref<string | null>(null)

function carregar(c: Competicao | null): void {
  rascunho.value = c ? { ...copiar(c), saidas: copiar(c.saidas ?? []) } : null
  modoJson.value = false
  erroJson.value = null
}
watch(original, (c) => !novo.value && carregar(c), { immediate: true })

const problemas = (id: string) => editor.aberto?.problemas.filter((p) => p.competicao === id) ?? []
const times = computed(() => [...(editor.aberto?.times ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)))

const buscaParticipantes = ref('')
const timesFiltrados = computed(() => filtrarTimes(times.value, buscaParticipantes.value))
const lista = computed(() => (rascunho.value?.participantes.regra === 'lista' ? rascunho.value.participantes : null))
function alternarTime(sigla: string): void {
  const l = lista.value
  if (!l) return
  const i = l.times.indexOf(sigla)
  if (i >= 0) l.times.splice(i, 1)
  else l.times.push(sigla)
}

// ---------------------------------------------------------------- fases

const participantes = computed(() => {
  const p = rascunho.value?.participantes
  if (!p) return null
  return p.regra === 'lista' ? p.times.length : (p.quantidade ?? null)
})
const resumos = computed(() => (rascunho.value ? resumirFases(rascunho.value, participantes.value) : []))
const saidasRascunho = computed<SaidaCompeticao[]>({
  get: () => rascunho.value?.saidas ?? [],
  set: (v) => {
    if (rascunho.value) rascunho.value.saidas = v
  },
})
const destinos = computed(() => competicoes.value.filter((c) => c.id !== rascunho.value?.id).map((c) => ({ id: c.id, nome: c.nome })))
const naEscada = computed(() => !!editor.aberto?.divisoes?.divisoes.some((d) => d.competicao === rascunho.value?.id))
const FORMATOS: FormatoFase[] = ['pontos_corridos', 'grupos', 'mata_mata']

function trocarFormatoFase(i: number, formato: FormatoFase): void {
  const c = rascunho.value
  if (!c) return
  c.fases[i] = trocarFormato(c.fases[i]!, formato, resumos.value[i]?.entram ?? null, i === c.fases.length - 1)
  c.fases = encadear(c.fases, participantes.value)
}
function renomearFaseId(i: number, id: string): void {
  const c = rascunho.value
  if (c) rascunho.value = renomearFase(c, c.fases[i]!.id, id)
}
function moverFaseI(i: number, passo: -1 | 1): void {
  const c = rascunho.value
  if (c) c.fases = moverFase(c.fases, i, passo, participantes.value)
}
async function removerFaseI(i: number): Promise<void> {
  const c = rascunho.value
  if (!c) return
  const f = c.fases[i]!
  const citam = saidasQueCitam(c, f.id).length
  const extra = citam ? ` ${citam} saída(s) citam esta fase e serão ajustadas.` : ''
  if (!(await ui.confirmar('Remover fase', `Remover "${f.nome}"?${extra}`, 'Remover', true))) return
  const r = removerFase(c, i, participantes.value)
  rascunho.value = { ...r, saidas: r.saidas ?? [] }
}
function adicionarFase(formato: FormatoFase): void {
  const c = rascunho.value
  if (c) c.fases = encadear([...c.fases, faseNova(c, formato, participantes.value)], participantes.value)
}

// ---------------------------------------------------------------- modo JSON

function entrarJson(): void {
  const c = rascunho.value
  if (!c) return
  textoFases.value = JSON.stringify(c.fases, null, 2)
  textoSaidas.value = JSON.stringify(c.saidas ?? [], null, 2)
  erroJson.value = null
  modoJson.value = true
}
/** Lê os textos de volta para o rascunho; false se o JSON não serve. */
function aplicarJson(): boolean {
  const c = rascunho.value
  if (!c) return false
  try {
    const fases = CompeticaoSchema.shape.fases.safeParse(JSON.parse(textoFases.value))
    const saidas = CompeticaoSchema.shape.saidas.safeParse(JSON.parse(textoSaidas.value || '[]'))
    const falha = (q: string, e: { issues: { path: PropertyKey[]; message: string }[] }) => `${q} ${e.issues[0]?.path.map(String).join('.')}: ${e.issues[0]?.message}`
    if (!fases.success) throw new Error(falha('fases', fases.error))
    if (!saidas.success) throw new Error(falha('saídas', saidas.error))
    c.fases = fases.data
    c.saidas = saidas.data ?? []
    erroJson.value = null
    return true
  } catch (e) {
    erroJson.value = `JSON inválido: ${(e as Error).message}`
    return false
  }
}
function sairJson(): void {
  if (aplicarJson()) modoJson.value = false
}

function selecionar(id: string): void {
  novo.value = false
  editor.competicaoSelecionada = id
  carregar(original.value)
}

function criar(): void {
  novo.value = true
  carregar({
    id: 'nova-competicao',
    nome: 'Nova competição',
    tipo: 'nacional',
    participantes: { regra: 'lista', times: [] },
    substituicoes: 3,
    fases: [{ id: 'liga', nome: 'Turno e returno', formato: 'pontos_corridos', pontos_corridos: { turnos: 2 } }],
  })
}

async function salvar(): Promise<void> {
  const c = rascunho.value
  if (!c) return
  if (modoJson.value && !aplicarJson()) return
  const limpo = copiar(c)
  limpo.fases = encadear(limpo.fases, participantes.value).map((f) => {
    if (f.zonas && !f.zonas.length) delete f.zonas
    return f
  })
  if (!limpo.saidas?.length) delete limpo.saidas
  const anterior = novo.value ? undefined : (editor.competicaoSelecionada ?? undefined)
  if (await editor.salvarCompeticao(limpo, anterior)) {
    novo.value = false
    editor.competicaoSelecionada = c.id
    carregar(original.value)
  }
}

async function remover(): Promise<void> {
  const c = original.value
  if (!c) return
  if (!(await ui.confirmar('Remover competição', `Remover ${c.nome} do pacote? O arquivo competicoes/${c.id}.json será apagado.`, 'Remover', true))) return
  if (await editor.removerCompeticao(c.id)) editor.competicaoSelecionada = competicoes.value[0]?.id ?? null
}

function definirQuantidade(v: string): void {
  const p = rascunho.value?.participantes
  if (!p) return
  if (v) p.quantidade = Number(v)
  else delete p.quantidade
}
</script>

<template>
  <div class="mestre-detalhe">
    <WePainel titulo="Competições" sem-corpo>
      <div class="lista-itens">
        <button v-for="c in competicoes" :key="c.id" type="button" :aria-current="!novo && c.id === editor.competicaoSelecionada" @click="selecionar(c.id)">
          {{ c.nome }}
          <WeTag v-if="problemas(c.id).some((p) => p.nivel === 'erro')" class="marcador" tipo="negativo">Erro</WeTag>
        </button>
      </div>
      <div class="we-panel__body"><WeBotao icone="nova" @click="criar">Nova competição</WeBotao></div>
    </WePainel>

    <WePainel v-if="rascunho" :titulo="novo ? 'Nova competição' : rascunho.nome" clube>
      <ul v-if="!novo && problemas(rascunho.id).length" class="problemas">
        <li v-for="(p, i) in problemas(rascunho.id)" :key="i" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
      </ul>

      <div class="campos">
        <label class="campo"><span class="we-lb">Id (nome do arquivo)</span><input v-model="rascunho.id" type="text" /></label>
        <label class="campo campos--largo"><span class="we-lb">Nome</span><input v-model="rascunho.nome" type="text" /></label>
        <label class="campo">
          <span class="we-lb">Tipo</span>
          <select v-model="rascunho.tipo">
            <option value="nacional">Nacional</option>
            <option value="estadual">Estadual</option>
            <option value="regional">Regional</option>
            <option value="continental">Continental</option>
          </select>
        </label>
        <label class="campo">
          <span class="we-lb">Substituições</span>
          <input :value="rascunho.substituicoes ?? 3" type="number" min="0" max="5" @input="(e) => (rascunho!.substituicoes = Number((e.target as HTMLInputElement).value))" />
        </label>
        <label class="campo">
          <span class="we-lb">Quantidade de times</span>
          <input :value="rascunho.participantes.quantidade ?? ''" type="number" min="2" @input="(e) => definirQuantidade((e.target as HTMLInputElement).value)" />
        </label>
      </div>

      <template v-if="lista">
        <h3 class="secao-form">Participantes ({{ lista.times.length }})</h3>
        <label class="campo">
          <span class="we-lb">Buscar time ({{ timesFiltrados.length }} de {{ times.length }})</span>
          <input v-model="buscaParticipantes" type="search" placeholder="Nome, sigla, estado ou país" autocomplete="off" spellcheck="false" />
        </label>
        <div class="participantes">
          <label v-for="t in timesFiltrados" :key="t.sigla" class="campo campo--check">
            <input type="checkbox" :checked="lista.times.includes(t.sigla)" @change="alternarTime(t.sigla)" />
            <WeEscudo :sigla="t.sigla" :cor="t.cores[0]" :src="editor.escudo(t.sigla)" />
            {{ t.nome }}
          </label>
        </div>
      </template>
      <p v-else class="we-lb">Participantes pela regra "{{ rascunho.participantes.regra }}" (editar no arquivo por enquanto).</p>

      <div class="cabeca-fases">
        <h3 class="secao-form">Fases</h3>
        <WeBotao icone="codigo" :ativo="modoJson" @click="modoJson ? sairJson() : entrarJson()">{{ modoJson ? 'Voltar ao visual' : 'Editar como JSON' }}</WeBotao>
      </div>

      <template v-if="!modoJson">
        <ol class="fluxo" aria-label="Caminho dos times pelas fases">
          <li class="fluxo__n">{{ participantes ?? '?' }} times</li>
          <template v-for="(f, i) in rascunho.fases" :key="f.id">
            <li class="fluxo__fase" :class="{ 'fluxo__fase--erro': resumos[i]?.problema }">
              <b>{{ f.nome }}</b>
              <span>{{ ROTULO_FORMATO[f.formato] }}</span>
            </li>
            <li class="fluxo__n">
              {{ resumos[i]?.problema ? '✕' : i === rascunho.fases.length - 1 && resumos[i]?.saem === 1 ? 'Campeão' : `${resumos[i]?.saem ?? '?'}` }}
            </li>
          </template>
        </ol>

        <div class="lista-fases">
          <CartaoFase
            v-for="(f, i) in rascunho.fases"
            :key="f.id"
            v-model="rascunho.fases[i]!"
            :indice="i"
            :total="rascunho.fases.length"
            :resumo="resumos[i]"
            :outros-ids="rascunho.fases.filter((_, k) => k !== i).map((x) => x.id)"
            @formato="(fm) => trocarFormatoFase(i, fm)"
            @renomear="(id) => renomearFaseId(i, id)"
            @mover="(p) => moverFaseI(i, p)"
            @remover="removerFaseI(i)"
          />
        </div>
        <div class="acoes">
          <span class="we-lb">Acrescentar fase:</span>
          <WeBotao v-for="fm in FORMATOS" :key="fm" @click="adicionarFase(fm)">{{ ROTULO_FORMATO[fm] }}</WeBotao>
        </div>

        <h3 class="secao-form">Saídas</h3>
        <EditorSaidas v-model="saidasRascunho" :competicao="rascunho" :destinos="destinos" :na-escada="naEscada" />
      </template>

      <template v-else>
        <p class="we-lb">Formato do arquivo em docs/spec/03-competicoes-calendario.md. Use para o que o visual ainda não cobre (ex.: "entram").</p>
        <label class="campo"><span class="we-lb">Fases</span><textarea v-model="textoFases" rows="18" spellcheck="false" aria-label="Fases em JSON"></textarea></label>
        <label class="campo"><span class="we-lb">Saídas</span><textarea v-model="textoSaidas" rows="6" spellcheck="false" aria-label="Saídas em JSON"></textarea></label>
      </template>
      <p v-if="erroJson" class="we-vl--negativo">{{ erroJson }}</p>

      <div class="acoes rodape-form">
        <WeBotao icone="salvar" :desabilitado="editor.ocupado" @click="salvar">Salvar competição</WeBotao>
        <WeBotao icone="descartar" @click="novo ? ((novo = false), carregar(original)) : carregar(original)">Descartar</WeBotao>
        <WeBotao v-if="!novo" icone="lixeira" @click="remover">Remover competição</WeBotao>
      </div>
    </WePainel>
    <WePainel v-else titulo="Competição"><p>Nenhuma competição. Crie uma nova.</p></WePainel>
  </div>
</template>

<style scoped>
.participantes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 4px var(--space-4);
}
.problemas {
  margin: 0;
  padding-left: 18px;
}
.cabeca-fases {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
}
.cabeca-fases .secao-form {
  flex: 1;
}
.fluxo {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
  font-size: 13px;
}
.fluxo__n {
  color: var(--texto-forte);
  font-weight: 700;
}
.fluxo__n:not(:first-child)::before {
  content: '→ ';
  color: var(--texto-suave);
  font-weight: 400;
}
.fluxo__n:not(:last-child)::after {
  content: ' →';
  color: var(--texto-suave);
  font-weight: 400;
}
.fluxo__fase {
  display: flex;
  flex-direction: column;
  padding: 3px 8px;
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-top: 3px solid var(--clube);
  border-radius: var(--radius-sm);
  line-height: 1.2;
}
.fluxo__fase span {
  font-size: 11px;
  color: var(--texto-suave);
}
.fluxo__fase--erro {
  border-top-color: var(--negativo);
}
.lista-fases {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.rodape-form {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--linha);
}
</style>
