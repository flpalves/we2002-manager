<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATRIBUTOS, type Atributos, type JogadorExterior, type JogadorSemClube } from '@shared/esquemas/pacote'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import CampoDinheiro from '../../componentes/CampoDinheiro.vue'
import CamposJogador from './CamposJogador.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { dinheiro } from '../../formato'
import { copiar, igual } from './rascunho'

/**
 * Jogadores sem clube do pacote (06, "Jogadores sem clube"): os disponíveis do exterior
 * (`exterior.json`, com clube de origem e taxa fixa) e os livres iniciais (`livres.json`, sem taxa).
 */

const editor = useEditor()
const ui = useUi()

interface Rascunho {
  exterior: JogadorExterior[]
  livres: JogadorSemClube[]
}

const semClube = computed(() => editor.aberto?.semClube ?? null)
const original = computed<Rascunho>(() => ({ exterior: semClube.value?.exterior?.jogadores ?? [], livres: semClube.value?.livres?.jogadores ?? [] }))
const rascunho = ref<Rascunho>(copiar(original.value))
const alterado = computed(() => !igual(rascunho.value, original.value))
watch(original, (o) => (rascunho.value = copiar(o)))

const invalidos = computed(() => semClube.value?.invalidos ?? [])
const temporadaInicial = computed(() => editor.aberto?.manifesto?.temporada_inicial ?? 2026)

const busca = ref('')
const lista = computed<JogadorSemClube[]>(() => (editor.listaSemClube === 'exterior' ? rascunho.value.exterior : rascunho.value.livres))
const visiveis = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return q ? lista.value.filter((j) => j.nome.toLowerCase().includes(q) || j.nome_we.toLowerCase().includes(q)) : lista.value
})

const jogador = computed(() => lista.value.find((j) => j.id === editor.semClubeSelecionado) ?? null)
const doExterior = computed(() => (jogador.value && editor.listaSemClube === 'exterior' ? (jogador.value as JogadorExterior) : null))
watch(
  [lista, () => editor.listaSemClube],
  () => {
    if (!lista.value.some((j) => j.id === editor.semClubeSelecionado)) editor.semClubeSelecionado = lista.value[0]?.id ?? null
  },
  { immediate: true },
)

const problemasDe = (id: string) => editor.aberto?.problemas.filter((p) => p.jogador === id) ?? []
const temErro = (id: string) => problemasDe(id).some((p) => p.nivel === 'erro')

/** Id novo, sem repetir nenhum jogador do pacote (times, exterior e livres). */
function idNovo(prefixo: 'ext' | 'liv'): string {
  const ids = new Set([
    ...(editor.aberto?.times.flatMap((t) => t.jogadores.map((j) => j.id)) ?? []),
    ...rascunho.value.exterior.map((j) => j.id),
    ...rascunho.value.livres.map((j) => j.id),
  ])
  let n = 1
  while (ids.has(`${prefixo}-novo-${n}`)) n++
  return `${prefixo}-novo-${n}`
}

const ORIGEM_PADRAO = { clube: 'A definir', pais: 'XXX' }
const TAXA_PADRAO = 100_000_000

function novoJogador(): void {
  const exterior = editor.listaSemClube === 'exterior'
  const id = idNovo(exterior ? 'ext' : 'liv')
  const n = id.split('-').at(-1)
  const base: JogadorSemClube = {
    id,
    nome: `Novo jogador ${n}`,
    nome_we: `NOVO ${n}`,
    posicao: 'CF',
    posicao_secundaria: null,
    idade: 25,
    nacionalidade: 'BRA',
    pe: 'destro',
    altura: 180,
    atributos: Object.fromEntries(ATRIBUTOS.map((a) => [a, 10])) as Atributos,
    outside: true,
    potencial: 12,
    resistencia: 10,
  }
  if (exterior) rascunho.value.exterior.push({ ...base, origem: { ...ORIGEM_PADRAO }, taxa: TAXA_PADRAO })
  else rascunho.value.livres.push(base)
  busca.value = ''
  editor.semClubeSelecionado = id
}

function tirarDaLista(id: string): void {
  const r = rascunho.value
  if (editor.listaSemClube === 'exterior') r.exterior = r.exterior.filter((j) => j.id !== id)
  else r.livres = r.livres.filter((j) => j.id !== id)
}

async function removerJogador(): Promise<void> {
  const j = jogador.value
  if (!j) return
  if (!(await ui.confirmar('Remover jogador', `Remover ${j.nome} dos sem clube? (Só vale depois de salvar.)`, 'Remover', true))) return
  const i = visiveis.value.indexOf(j)
  tirarDaLista(j.id)
  editor.semClubeSelecionado = visiveis.value[Math.min(i, visiveis.value.length - 1)]?.id ?? null
}

/** Exterior → livre perde origem e taxa; livre → exterior ganha origem e taxa a preencher. */
function mover(): void {
  const j = jogador.value
  if (!j) return
  tirarDaLista(j.id)
  if (editor.listaSemClube === 'exterior') {
    const { origem: _origem, taxa: _taxa, ...livre } = j as JogadorExterior
    void _origem
    void _taxa
    rascunho.value.livres.push(livre)
    editor.listaSemClube = 'livres'
  } else {
    rascunho.value.exterior.push({ ...j, origem: { ...ORIGEM_PADRAO }, taxa: TAXA_PADRAO })
    editor.listaSemClube = 'exterior'
  }
  busca.value = ''
  editor.semClubeSelecionado = j.id
}

async function salvar(): Promise<void> {
  const r = copiar(rascunho.value)
  const temporada = semClube.value?.exterior?.temporada ?? temporadaInicial.value
  await editor.salvarSemClube(r.exterior.length ? { temporada, jogadores: r.exterior } : null, r.livres.length ? { jogadores: r.livres } : null)
}

function definirPais(valor: string): void {
  if (doExterior.value) doExterior.value.origem.pais = valor.toUpperCase()
}
</script>

<template>
  <WePainel v-if="invalidos.length" titulo="Arquivo fora do formato">
    <p class="we-vl--negativo">{{ invalidos.join(' e ') }} não passou no esquema: corrija o arquivo (veja a aba Validação) antes de editar aqui. Gravar agora apagaria o que está nele.</p>
  </WePainel>
  <div class="mestre-detalhe">
    <WePainel titulo="Sem clube" sem-corpo>
      <template #extra>{{ rascunho.exterior.length }} exterior · {{ rascunho.livres.length }} livres</template>
      <div class="we-panel__body">
        <div class="acoes" role="group" aria-label="Lista">
          <WeBotao :ativo="editor.listaSemClube === 'exterior'" @click="editor.listaSemClube = 'exterior'">Exterior ({{ rascunho.exterior.length }})</WeBotao>
          <WeBotao :ativo="editor.listaSemClube === 'livres'" @click="editor.listaSemClube = 'livres'">Livres ({{ rascunho.livres.length }})</WeBotao>
        </div>
        <label class="campo busca"><span class="we-lb">Buscar</span><input v-model="busca" type="text" maxlength="40" /></label>
        <p class="we-lb dica">
          {{ editor.listaSemClube === 'exterior' ? 'Jogadores de clubes de fora do jogo: taxa fixa, só na janela de transferências.' : 'Livres iniciais: sem taxa, contratáveis a qualquer momento.' }}
        </p>
      </div>
      <div class="lista-itens">
        <button v-for="j in visiveis" :key="j.id" type="button" :aria-current="j.id === editor.semClubeSelecionado" @click="editor.semClubeSelecionado = j.id">
          <span class="pos">{{ j.posicao }}</span>
          {{ j.nome }}
          <span v-if="'taxa' in j" class="taxa we-lb">{{ dinheiro((j as JogadorExterior).taxa) }}</span>
          <WeTag v-if="temErro(j.id)" class="marcador" tipo="negativo">Erro</WeTag>
        </button>
        <p v-if="!visiveis.length" class="we-lb vazio">{{ lista.length ? 'Nenhum jogador com esse nome.' : 'Nenhum jogador nesta lista.' }}</p>
      </div>
      <div class="we-panel__body acoes">
        <WeBotao icone="nova" @click="novoJogador">Novo jogador</WeBotao>
        <WeBotao icone="salvar" :desabilitado="!alterado || editor.ocupado || invalidos.length > 0" @click="salvar">Salvar</WeBotao>
      </div>
    </WePainel>

    <WePainel v-if="jogador" :titulo="jogador.nome" clube>
      <template #extra>{{ alterado ? 'alterações não salvas' : '' }}</template>

      <ul v-if="problemasDe(jogador.id).length" class="problemas">
        <li v-for="(p, i) in problemasDe(jogador.id)" :key="i" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
      </ul>

      <!-- O jogador do rascunho é editado no lugar pelos campos comuns. -->
      <CamposJogador :model-value="jogador">
        <template #meio>
          <template v-if="doExterior">
            <h3 class="secao-form">Exterior</h3>
            <div class="campos">
              <label class="campo campos--largo"><span class="we-lb">Clube de origem</span><input v-model="doExterior.origem.clube" type="text" maxlength="40" /></label>
              <label class="campo">
                <span class="we-lb">País (3 letras)</span>
                <input :value="doExterior.origem.pais" type="text" maxlength="3" :aria-invalid="!/^[A-Z]{3}$/.test(doExterior.origem.pais)" @input="(e) => definirPais((e.target as HTMLInputElement).value)" />
              </label>
              <CampoDinheiro v-model="doExterior.taxa" rotulo="Taxa de transferência (fixa)" />
            </div>
            <p class="we-lb">Aparece no Mercado como "joga no {{ doExterior.origem.clube }} ({{ doExterior.origem.pais }})". A taxa é recalculada pela idade a cada virada.</p>
          </template>
          <p v-else class="we-lb">Livre: sem taxa. O contrato e a camisa vêm na contratação.</p>
        </template>
      </CamposJogador>

      <div class="acoes rodape-form">
        <WeBotao icone="salvar" :desabilitado="!alterado || editor.ocupado || invalidos.length > 0" @click="salvar">Salvar</WeBotao>
        <WeBotao icone="descartar" :desabilitado="!alterado" @click="rascunho = copiar(original)">Descartar</WeBotao>
        <WeBotao icone="enviar" @click="mover">{{ editor.listaSemClube === 'exterior' ? 'Tornar livre' : 'Mover para o exterior' }}</WeBotao>
        <WeBotao icone="lixeira" @click="removerJogador">Remover jogador</WeBotao>
      </div>
    </WePainel>
    <WePainel v-else titulo="Jogador"><p>Selecione um jogador ou crie um novo.</p></WePainel>
  </div>
</template>

<style scoped>
.pos {
  width: 26px;
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--texto-suave);
}
.taxa {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.busca input {
  width: 100%;
}
.busca {
  margin-top: var(--space-3);
}
.dica {
  margin: var(--space-2) 0 0;
}
.vazio {
  padding: var(--space-2);
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
