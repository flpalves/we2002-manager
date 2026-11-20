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
  definirVagasDaOrigem,
  tirarPuloDaOrigem,
  trocarFormato,
  type FormatoFase,
} from '@core/pacote/editorFases'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar } from './rascunho'
import CartaoFase from './CartaoFase.vue'
import EditorSaidas from './EditorSaidas.vue'
import EditorPremiacao from './EditorPremiacao.vue'
import EditorSegundaDivisao from './EditorSegundaDivisao.vue'
import WeListaTimes from '../../componentes/WeListaTimes.vue'
import EditorOrigensVagas from './EditorOrigensVagas.vue'
import EditorPuloClassificacao from './EditorPuloClassificacao.vue'
import { tamanhoDaCompeticao } from '@core/competicoes/vagas'

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

/** Vagas por origem alteradas (competição por vagas): gravadas nas origens ao salvar. */
const vagasOrigens = ref<Record<string, number>>({})
/** Origens cujo pulo próprio passa para esta competição ao salvar. */
const puloTrazido = ref<string[]>([])

function carregar(c: Competicao | null): void {
  rascunho.value = c ? { ...copiar(c), saidas: copiar(c.saidas ?? []) } : null
  vagasOrigens.value = {}
  puloTrazido.value = []
  modoJson.value = false
  erroJson.value = null
}
watch(original, (c) => !novo.value && carregar(c), { immediate: true })

const problemas = (id: string) => editor.aberto?.problemas.filter((p) => p.competicao === id) ?? []
const times = computed(() => [...(editor.aberto?.times ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)))

const lista = computed(() => (rascunho.value?.participantes.regra === 'lista' ? rascunho.value.participantes : null))
const ehEstadual = computed(() => rascunho.value?.tipo === 'estadual' || rascunho.value?.tipo === 'regional')
const recebeVagas = computed(() => {
  const p = rascunho.value?.participantes
  return p?.regra === 'classificados_de' || (p?.regra === 'lista' && !!p.por_vagas)
})
const pulaQuemJoga = computed({
  get: () => rascunho.value?.pula_quem_joga,
  set: (v) => {
    if (!rascunho.value) return
    if (v?.length) rascunho.value.pula_quem_joga = v
    else delete rascunho.value.pula_quem_joga
  },
})
const segundaDivisao = computed({
  get: () => rascunho.value?.segunda_divisao,
  set: (v) => {
    if (!rascunho.value) return
    if (v) rascunho.value.segunda_divisao = v
    else delete rascunho.value.segunda_divisao
  },
})
function definirPorVagas(sim: boolean): void {
  const l = lista.value
  if (!l) return
  if (sim) l.por_vagas = true
  else delete l.por_vagas
}
const timesDaLista = computed<string[]>({
  get: () => lista.value?.times ?? [],
  set: (v) => {
    if (lista.value) lista.value.times = v
  },
})
/** Quem já joga outro estadual/regional (um clube só joga um). */
const outroEstadual = computed(() => {
  const m = new Map<string, string>()
  for (const c of competicoes.value) {
    if (c.id === editor.competicaoSelecionada || (c.tipo !== 'estadual' && c.tipo !== 'regional') || c.participantes.regra !== 'lista') continue
    for (const t of c.participantes.times) m.set(t, c.nome)
  }
  return m
})
const observacaoParticipante = (sigla: string) => {
  const outro = ehEstadual.value ? outroEstadual.value.get(sigla) : undefined
  return outro ? `também no ${outro}` : null
}

// ---------------------------------------------------------------- fases

// Quantos começam (por vagas: a quantidade configurada, não os garantidos).
const participantes = computed(() => (rascunho.value ? tamanhoDaCompeticao(rascunho.value) : null))
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
  const pr = limpo.premiacao
  if (pr) {
    if (pr.por_posicao) {
      while (pr.por_posicao.length && !pr.por_posicao[pr.por_posicao.length - 1]) pr.por_posicao.pop()
      if (!pr.por_posicao.length) delete pr.por_posicao
    }
    if (!pr.participacao) delete pr.participacao
    if (!pr.participacao && !pr.por_posicao && !pr.por_fase) delete limpo.premiacao
  }
  const anterior = novo.value ? undefined : (editor.competicaoSelecionada ?? undefined)
  // Guardadas antes de salvar: o recarregamento do pacote recarrega o rascunho e zera as pendentes.
  const vagas = limpo.participantes.regra === 'lista' && limpo.participantes.por_vagas ? { ...vagasOrigens.value } : {}
  const trazidas = [...puloTrazido.value]
  if (await editor.salvarCompeticao(limpo, anterior)) {
    // Origens: vagas alteradas viram saídas; pulo trazido para cá sai das saídas delas (um arquivo cada).
    for (const id of new Set([...Object.keys(vagas), ...trazidas])) {
      let origem = competicoes.value.find((x) => x.id === id)
      if (!origem) continue
      if (vagas[id] !== undefined) origem = definirVagasDaOrigem(origem, limpo.id, vagas[id])
      if (trazidas.includes(id)) origem = tirarPuloDaOrigem(origem, limpo.id)
      await editor.salvarCompeticao(origem, id)
    }
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
        <h3 class="secao-form">
          <template v-if="lista.por_vagas">Garantidos ({{ lista.times.length }})</template>
          <template v-else>Participantes ({{ lista.times.length }}<template v-if="rascunho.participantes.quantidade"> de {{ rascunho.participantes.quantidade }}</template>)</template>
        </h3>
        <label class="campo campo--check">
          <input type="checkbox" :checked="!!lista.por_vagas" @change="(e) => definirPorVagas((e.target as HTMLInputElement).checked)" />
          Participantes definidos no ano pelas vagas dos estaduais/regionais (ex.: Série D)
        </label>
        <p v-if="lista.por_vagas" class="we-lb">
          Garantidos: quem já tem lugar sem depender das vagas. O jogo põe aqui, na virada, quem chega por acesso ou rebaixamento (ex.: os que caem da Série C). Na 1ª temporada
          deixe vazio para o jogo definir todos pelas vagas. Preencha "Quantidade de times" acima.
        </p>
        <WeListaTimes
          v-model="timesDaLista"
          :times="times"
          :rotulo="lista.por_vagas ? 'Garantidos' : 'Participantes'"
          :escudo="editor.escudo"
          :observacao="observacaoParticipante"
          :vazio="lista.por_vagas ? 'Nenhum garantido: todos virão das vagas.' : 'Nenhum clube incluído.'"
        />
        <template v-if="lista.por_vagas">
          <h3 class="secao-form">Vagas por origem</h3>
          <EditorOrigensVagas v-model="vagasOrigens" :competicao="rascunho" :id-salvo="novo ? null : editor.competicaoSelecionada" :competicoes="competicoes" />
        </template>
      </template>
      <template v-if="recebeVagas">
        <h3 class="secao-form">Classificação: pular quem joga</h3>
        <EditorPuloClassificacao
          v-model="pulaQuemJoga"
          v-model:trazidas="puloTrazido"
          :competicao="rascunho"
          :id-salvo="novo ? null : editor.competicaoSelecionada"
          :competicoes="competicoes"
        />
      </template>
      <template v-if="lista && ehEstadual">
        <h3 class="secao-form">Segunda divisão</h3>
        <EditorSegundaDivisao v-model="segundaDivisao" :competicao="rascunho" :times="times" :competicoes="competicoes" :escudo="editor.escudo" />
      </template>
      <p v-if="!lista" class="we-lb">Participantes pela regra "{{ rascunho.participantes.regra }}" (editar no arquivo por enquanto).</p>

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

      <h3 class="secao-form">Premiação</h3>
      <EditorPremiacao v-model="rascunho.premiacao" :participantes="participantes" />
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
