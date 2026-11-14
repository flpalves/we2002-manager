<script setup lang="ts">
/**
 * Catálogo de notícias e eventos aleatórios do pacote (`noticias.json`, spec 09b): o que acontece,
 * quando (gatilho e condições), com que frequência (chance e intervalo mínimo) e as
 * consequências, inclusive as decisões do técnico. Vale para as carreiras novas deste pacote.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { MOMENTOS, TIPOS_NOTICIA, type EventoCatalogo, type Momento, type TipoNoticia } from '@shared/esquemas/noticias'
import { alvoDeJogador, eventoNovo, frequenciaEsperada, idLivre, limparEvento, validarCatalogo, type BaseFrequencia } from '@core/noticias/editor'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { MARCADORES, ROTULO_ALVO, ROTULO_MOMENTO, ROTULO_TIPO, TAG_TIPO, descreverEfeitoCatalogo, porcento, previaTexto } from '../../noticias'
import { decimal } from '@shared/dinheiro'
import ListaCondicoes from './ListaCondicoes.vue'
import ListaEfeitos from './ListaEfeitos.vue'
import { copiar, igual } from './rascunho'

/** Estimativa para o pós-jogo (o calendário real depende das competições do time). */
const JOGOS_POR_TEMPORADA = 60

const editor = useEditor()
const ui = useUi()

const dados = computed(() => editor.aberto!.noticias)
const rascunho = ref<EventoCatalogo[]>([])
const regras = ref({ fator_chance: 1, maximo_por_avaliacao: 1 })
const sel = ref(0)

function carregar(): void {
  rascunho.value = copiar(dados.value.catalogo)
  regras.value = copiar(dados.value.regras)
  const i = rascunho.value.findIndex((e) => e.id === editor.noticiaSelecionada)
  sel.value = i >= 0 ? i : Math.min(sel.value, Math.max(0, rascunho.value.length - 1))
}
watch(dados, carregar, { immediate: true })

const evento = computed(() => rascunho.value[sel.value] ?? null)
watch(evento, (e) => (editor.noticiaSelecionada = e?.id ?? null))

const alterado = computed(() => !igual(rascunho.value, dados.value.catalogo) || !igual(regras.value, dados.value.regras))
const problemas = computed(() => validarCatalogo(rascunho.value))
const temErro = computed(() => problemas.value.some((p) => p.nivel === 'erro'))
const problemasDe = (id: string) => problemas.value.filter((p) => p.evento === id)
const problemasGerais = computed(() => problemas.value.filter((p) => !p.evento))

// ------------------------------------------------------------------ lista e filtros

const filtroMomento = ref<Momento | ''>('')
const filtroTipo = ref<TipoNoticia | ''>('')
const busca = ref('')
const grupos = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  return MOMENTOS.filter((m) => !filtroMomento.value || m === filtroMomento.value)
    .map((m) => ({
      momento: m,
      itens: rascunho.value
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.gatilho.momento === m && (!filtroTipo.value || e.tipo === filtroTipo.value) && (!termo || e.id.includes(termo) || e.texto.toLowerCase().includes(termo))),
    }))
    .filter((g) => g.itens.length)
})

// ------------------------------------------------------------------ periodicidade

const base = computed<BaseFrequencia>(() => ({
  fatorChance: Number(regras.value.fator_chance) || 0,
  semanasPorTemporada: dados.value.semanas,
  janelas: dados.value.janelas,
  jogosPorTemporada: JOGOS_POR_TEMPORADA,
}))
const POR: Record<Momento, string> = { semana: 'por semana', pos_jogo: 'por jogo', janela_abre: 'por janela', janela_fecha: 'por janela', virada: 'por temporada' }

function resumoFrequencia(e: EventoCatalogo): string {
  const f = frequenciaEsperada(e, base.value)
  if (f.porTemporada === 0) return 'nunca'
  if (f.porTemporada >= 1) return `~${decimal(f.porTemporada, f.porTemporada >= 10 ? 0 : 1)}/temp.`
  return `1 a cada ${decimal(1 / f.porTemporada, 1)} temp.`
}

const frequencia = computed(() => {
  const e = evento.value
  if (!e) return null
  const f = frequenciaEsperada(e, base.value)
  const linhas = [`Chance efetiva: ${porcento(f.porAvaliacao)} ${POR[e.gatilho.momento]} (${f.avaliacoes} ${f.avaliacoes === 1 ? 'avaliação' : 'avaliações'} por temporada).`]
  if (f.porTemporada === 0 || f.semanasEntre === null) linhas.push('Com esta chance o evento nunca acontece.')
  else {
    const vezes = f.porTemporada >= 1 ? `~${decimal(f.porTemporada, 1)} vez(es) por temporada` : `~1 vez a cada ${decimal(1 / f.porTemporada, 1)} temporadas`
    const entre = e.gatilho.momento === 'semana' || e.gatilho.momento === 'pos_jogo' ? `, em média 1 a cada ${decimal(f.semanasEntre, 0)} semanas` : ''
    linhas.push(`Se as condições valessem sempre: ${vezes}${entre}.`)
  }
  if (e.gatilho.momento === 'pos_jogo') linhas.push(`Pós-jogo estimado com ${JOGOS_POR_TEMPORADA} jogos por temporada.`)
  if (e.gatilho.condicoes.length) linhas.push('As condições reduzem isso: o evento só é sorteado quando elas valem.')
  return linhas
})

/** Teto de eventos por temporada somando o catálogo todo (sem o limite por avaliação). */
const totalTemporada = computed(() => rascunho.value.reduce((s, e) => s + frequenciaEsperada(e, base.value).porTemporada, 0))

// ------------------------------------------------------------------ texto

const campoTexto = ref<HTMLTextAreaElement | null>(null)
async function inserirMarcador(m: string): Promise<void> {
  const e = evento.value
  const el = campoTexto.value
  if (!e) return
  const ini = el?.selectionStart ?? e.texto.length
  const fim = el?.selectionEnd ?? ini
  e.texto = e.texto.slice(0, ini) + m + e.texto.slice(fim)
  await nextTick()
  el?.focus()
  el?.setSelectionRange(ini + m.length, ini + m.length)
}
const nomeTime = computed(() => editor.aberto?.times[0]?.nome ?? 'Seu Time')

// ------------------------------------------------------------------ edição

function definirChance(texto: string): void {
  const e = evento.value
  const v = Number(texto.replace(',', '.'))
  if (e && Number.isFinite(v)) e.chance = Math.min(100, Math.max(0, v)) / 100
}

function trocarAlvo(alvo: EventoCatalogo['alvo']): void {
  const e = evento.value
  if (!e) return
  e.alvo = alvo
  // Condições de jogador não valem para alvo de time (o evento nunca aconteceria).
  if (!alvoDeJogador(alvo)) e.gatilho.condicoes = e.gatilho.condicoes.filter((c) => !c.campo.startsWith('jogador.'))
}
function trocarMomento(m: Momento): void {
  const e = evento.value
  if (!e) return
  e.gatilho.momento = m
  if (m !== 'pos_jogo') e.gatilho.condicoes = e.gatilho.condicoes.filter((c) => !c.campo.startsWith('partida.'))
}

async function alternarDecisao(): Promise<void> {
  const e = evento.value
  if (!e) return
  if (!e.escolhas) {
    e.escolhas = [
      { id: 'aceitar', texto: 'Aceitar', efeitos: [] },
      { id: 'recusar', texto: 'Recusar', efeitos: [] },
    ]
    return
  }
  const comEfeito = e.escolhas.some((o) => o.efeitos.length || o.resultado)
  if (!comEfeito || (await ui.confirmar('Tirar a decisão', 'As opções e as consequências de cada uma serão apagadas.', 'Tirar'))) e.escolhas = null
}
function acrescentarOpcao(): void {
  const e = evento.value
  if (!e?.escolhas) return
  e.escolhas.push({ id: idLivre('opcao', e.escolhas.map((o) => o.id)), texto: 'Nova opção', efeitos: [] })
}

function selecionar(i: number): void {
  sel.value = i
}
function criar(): void {
  rascunho.value.push(eventoNovo(rascunho.value.map((e) => e.id)))
  sel.value = rascunho.value.length - 1
  filtroMomento.value = ''
  filtroTipo.value = ''
  busca.value = ''
}
function duplicar(): void {
  const e = evento.value
  if (!e) return
  const copia = { ...copiar(e), id: idLivre(`${e.id}-copia`, rascunho.value.map((x) => x.id)) }
  rascunho.value.splice(sel.value + 1, 0, copia)
  sel.value += 1
}
async function remover(): Promise<void> {
  const e = evento.value
  if (!e || !(await ui.confirmar('Remover evento', `Tirar "${e.id}" do catálogo? (Só vale depois de salvar.)`, 'Remover'))) return
  rascunho.value.splice(sel.value, 1)
  sel.value = Math.max(0, Math.min(sel.value, rascunho.value.length - 1))
}

const regrasParaGravar = () => ({
  fator_chance: Number(regras.value.fator_chance) === dados.value.regrasPadrao.fator_chance ? null : Number(regras.value.fator_chance),
  maximo_por_avaliacao: Number(regras.value.maximo_por_avaliacao) === dados.value.regrasPadrao.maximo_por_avaliacao ? null : Number(regras.value.maximo_por_avaliacao),
})

async function salvar(): Promise<void> {
  await editor.salvarNoticias(rascunho.value.map((e) => limparEvento(copiar(e))), regrasParaGravar())
}
async function restaurarPadrao(): Promise<void> {
  if (await ui.confirmar('Voltar ao catálogo padrão', 'Apagar o noticias.json deste pacote e usar os eventos e as regras padrão do jogo?', 'Voltar ao padrão')) {
    await editor.salvarNoticias(null, { fator_chance: null, maximo_por_avaliacao: null })
  }
}
async function descartar(): Promise<void> {
  if (await ui.confirmar('Descartar alterações', 'Voltar o catálogo para o que está salvo?', 'Descartar')) carregar()
}
</script>

<template>
  <WePainel titulo="Notícias e eventos" clube>
    <template #extra>
      <WeTag :tipo="dados.doPacote ? 'info' : undefined">{{ dados.doPacote ? 'Do pacote' : 'Catálogo padrão' }}</WeTag>
    </template>
    <p class="we-lb">
      Eventos aleatórios que viram notícia na carreira: quando podem acontecer, com que frequência e o que mudam. O catálogo é copiado para a carreira na criação: vale para as carreiras
      novas deste pacote.
      <template v-if="!dados.doPacote"> O pacote ainda não tem noticias.json: ao salvar, o catálogo padrão editado passa a ser o do pacote.</template>
    </p>
    <p v-if="dados.arquivoInvalido" class="we-vl--negativo">O noticias.json do pacote está inválido (veja Validação); salvar aqui substitui o arquivo.</p>
    <div class="campos regras">
      <label class="campo">
        <span class="we-lb">Multiplicador das chances</span>
        <input v-model.number="regras.fator_chance" type="number" min="0" max="10" step="0.1" />
      </label>
      <label class="campo">
        <span class="we-lb">Eventos por avaliação (máx.)</span>
        <input v-model.number="regras.maximo_por_avaliacao" type="number" min="1" max="10" step="1" />
      </label>
      <p class="regras__nota we-lb">
        Padrão do jogo: ×{{ decimal(dados.regrasPadrao.fator_chance, 1) }} e {{ dados.regrasPadrao.maximo_por_avaliacao }} por avaliação. Somando o catálogo, até
        ~{{ decimal(totalTemporada, 0) }} eventos por temporada (teto, se as condições valessem sempre).
      </p>
    </div>
    <ul v-if="problemasGerais.length" class="problemas">
      <li v-for="(p, k) in problemasGerais" :key="k" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
    </ul>
    <div class="acoes">
      <WeBotao icone="salvar" variante="principal" :desabilitado="editor.ocupado || !alterado || temErro" @click="salvar">Salvar notícias</WeBotao>
      <WeBotao icone="descartar" :desabilitado="!alterado" @click="descartar">Descartar</WeBotao>
      <WeBotao icone="restaurar" :desabilitado="editor.ocupado || !dados.doPacote" @click="restaurarPadrao">Voltar ao padrão</WeBotao>
      <span v-if="temErro" class="we-vl--negativo">Corrija os erros para salvar.</span>
    </div>
  </WePainel>

  <div class="mestre-detalhe">
    <WePainel :titulo="`Eventos (${rascunho.length})`" sem-corpo>
      <div class="we-panel__body filtros">
        <label class="campo">
          <span class="we-lb">Buscar</span>
          <input v-model="busca" type="search" placeholder="Id ou texto" autocomplete="off" spellcheck="false" />
        </label>
        <label class="campo">
          <span class="we-lb">Momento</span>
          <select v-model="filtroMomento">
            <option value="">Todos</option>
            <option v-for="m in MOMENTOS" :key="m" :value="m">{{ ROTULO_MOMENTO[m] }}</option>
          </select>
        </label>
        <label class="campo">
          <span class="we-lb">Tipo</span>
          <select v-model="filtroTipo">
            <option value="">Todos</option>
            <option v-for="t in TIPOS_NOTICIA" :key="t" :value="t">{{ ROTULO_TIPO[t] }}</option>
          </select>
        </label>
      </div>
      <div class="lista-itens">
        <template v-for="g in grupos" :key="g.momento">
          <span class="grupo">{{ ROTULO_MOMENTO[g.momento] }}</span>
          <button v-for="{ e, i } in g.itens" :key="i" type="button" :aria-current="i === sel" @click="selecionar(i)">
            <span class="item">
              <span class="item__id">{{ e.id }}</span>
              <span class="item__sub">
                <WeTag :tipo="TAG_TIPO[e.tipo]">{{ ROTULO_TIPO[e.tipo] }}</WeTag>
                {{ resumoFrequencia(e) }}<template v-if="e.escolhas"> · decisão</template>
              </span>
            </span>
            <WeTag v-if="problemasDe(e.id).some((p) => p.nivel === 'erro')" class="marcador" tipo="negativo">Erro</WeTag>
            <WeTag v-else-if="problemasDe(e.id).length" class="marcador" tipo="atencao">Aviso</WeTag>
          </button>
        </template>
        <p v-if="!grupos.length" class="we-panel__body we-lb">Nenhum evento com esses filtros.</p>
      </div>
      <div class="we-panel__body"><WeBotao icone="nova" @click="criar">Novo evento</WeBotao></div>
    </WePainel>

    <WePainel v-if="evento" :titulo="evento.id" clube>
      <ul v-if="problemasDe(evento.id).length" class="problemas">
        <li v-for="(p, k) in problemasDe(evento.id)" :key="k" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
      </ul>

      <h3 class="secao-form">Notícia</h3>
      <div class="campos">
        <label class="campo">
          <span class="we-lb">Id</span>
          <input v-model.trim="evento.id" type="text" spellcheck="false" />
        </label>
        <label class="campo">
          <span class="we-lb">Tipo (etiqueta)</span>
          <select v-model="evento.tipo">
            <option v-for="t in TIPOS_NOTICIA" :key="t" :value="t">{{ ROTULO_TIPO[t] }}</option>
          </select>
        </label>
        <label class="campo campos--largo">
          <span class="we-lb">Texto</span>
          <textarea ref="campoTexto" v-model="evento.texto" class="texto" rows="2"></textarea>
        </label>
      </div>
      <div class="acoes marcadores">
        <span class="we-lb">Inserir:</span>
        <WeBotao v-for="m in MARCADORES" :key="m.marcador" @click="inserirMarcador(m.marcador)">{{ m.rotulo }}</WeBotao>
      </div>
      <div class="previa">
        <WeTag :tipo="TAG_TIPO[evento.tipo]">{{ ROTULO_TIPO[evento.tipo] }}</WeTag>
        <span>{{ previaTexto(evento.texto, evento, nomeTime) }}</span>
      </div>

      <h3 class="secao-form">Quando e com que frequência</h3>
      <div class="campos">
        <label class="campo">
          <span class="we-lb">Momento</span>
          <select :value="evento.gatilho.momento" @change="(ev) => trocarMomento((ev.target as HTMLSelectElement).value as Momento)">
            <option v-for="m in MOMENTOS" :key="m" :value="m">{{ ROTULO_MOMENTO[m] }}</option>
          </select>
        </label>
        <label class="campo">
          <span class="we-lb">Chance por avaliação (%)</span>
          <input :value="Math.round(evento.chance * 10000) / 100" type="number" min="0" max="100" step="0.5" @change="(ev) => definirChance((ev.target as HTMLInputElement).value)" />
        </label>
        <label class="campo">
          <span class="we-lb">Não repetir antes de (semanas)</span>
          <input v-model.number="evento.intervalo_minimo_semanas" type="number" min="0" max="520" step="1" />
        </label>
        <label class="campo">
          <span class="we-lb">Com quem acontece</span>
          <select :value="evento.alvo" @change="(ev) => trocarAlvo((ev.target as HTMLSelectElement).value as EventoCatalogo['alvo'])">
            <option v-for="(r, a) in ROTULO_ALVO" :key="a" :value="a">{{ r }}</option>
          </select>
        </label>
      </div>
      <ul v-if="frequencia" class="frequencia">
        <li v-for="(l, k) in frequencia" :key="k">{{ l }}</li>
      </ul>

      <h3 class="secao-form">Condições</h3>
      <ListaCondicoes v-model="evento.gatilho.condicoes" :momento="evento.gatilho.momento" :por-jogador="alvoDeJogador(evento.alvo)" />

      <h3 class="secao-form">Consequências{{ evento.escolhas ? ' (em qualquer opção)' : '' }}</h3>
      <ListaEfeitos v-model="evento.efeitos" :por-jogador="alvoDeJogador(evento.alvo)" rotulo="Consequências do evento" />

      <div class="cabeca-decisao">
        <h3 class="secao-form">Decisão do técnico</h3>
        <WeBotao :ativo="!!evento.escolhas" @click="alternarDecisao">{{ evento.escolhas ? 'Tirar a decisão' : 'Pedir decisão' }}</WeBotao>
      </div>
      <p class="we-lb">
        <template v-if="evento.escolhas">A notícia fica pendente e trava o Continuar até o técnico escolher uma opção; as consequências de cada opção valem na resposta.</template>
        <template v-else>Sem decisão: as consequências valem assim que o evento acontece.</template>
      </p>
      <div v-if="evento.escolhas" class="opcoes">
        <div v-for="(o, k) in evento.escolhas" :key="k" class="opcao">
          <div class="campos">
            <label class="campo">
              <span class="we-lb">Id da opção</span>
              <input v-model.trim="o.id" type="text" spellcheck="false" />
            </label>
            <label class="campo opcao__texto">
              <span class="we-lb">Texto do botão</span>
              <input v-model="o.texto" type="text" maxlength="60" />
            </label>
            <label class="campo campos--largo">
              <span class="we-lb">Resultado (aparece depois da escolha, opcional)</span>
              <input :value="o.resultado ?? ''" type="text" @input="(ev) => (o.resultado = (ev.target as HTMLInputElement).value)" />
            </label>
          </div>
          <ListaEfeitos v-model="o.efeitos" :por-jogador="alvoDeJogador(evento.alvo)" :rotulo="`Consequências da opção ${k + 1}`" />
          <p v-if="o.efeitos.length" class="opcao__resumo">{{ o.texto }}: {{ o.efeitos.map(descreverEfeitoCatalogo).join(' · ') }}</p>
          <div class="acoes">
            <WeBotao icone="lixeira" :desabilitado="evento.escolhas.length <= 2" @click="evento.escolhas.splice(k, 1)">Remover opção</WeBotao>
          </div>
        </div>
        <div class="acoes"><WeBotao icone="nova" @click="acrescentarOpcao">Acrescentar opção</WeBotao></div>
      </div>

      <div class="acoes rodape-form">
        <WeBotao icone="nova" @click="duplicar">Duplicar evento</WeBotao>
        <WeBotao icone="lixeira" @click="remover">Remover evento</WeBotao>
      </div>
    </WePainel>
    <WePainel v-else titulo="Evento"><p>Nenhum evento no catálogo. Crie um novo.</p></WePainel>
  </div>
</template>

<style scoped>
.regras {
  align-items: end;
}
.regras__nota {
  grid-column: span 2;
  margin: 0;
}
.filtros {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.grupo {
  padding: 6px 10px 2px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--texto-suave);
}
.item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.item__id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item__sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 400;
  color: var(--texto-suave);
}
.texto {
  font-family: inherit;
  font-size: inherit;
}
.marcadores {
  align-items: center;
  margin-top: var(--space-2);
}
.previa {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-radius: var(--radius-sm);
}
.frequencia {
  margin: var(--space-2) 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--texto-suave);
}
.cabeca-decisao {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
}
.cabeca-decisao .secao-form {
  flex: 1;
}
.opcoes {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.opcao {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--linha-forte);
  border-radius: var(--radius-sm);
}
.opcao__texto {
  grid-column: span 2;
}
.opcao__resumo {
  margin: 0;
  font-size: 13px;
  color: var(--texto-suave);
}
.problemas {
  margin: 0;
  padding-left: 18px;
}
</style>
