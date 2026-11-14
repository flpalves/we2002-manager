<script setup lang="ts">
/**
 * Escada de divisões (divisoes.json): ordem das séries e, entre cada par, quantos trocam
 * (o mesmo número sobe e desce) e o critério de cada lado. Vale para as carreiras novas.
 */
import { computed, ref, watch } from 'vue'
import type { Competicao, Divisao, Divisoes } from '@shared/esquemas/pacote'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import CampoCriterio from './CampoCriterio.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar, igual } from './rascunho'

const editor = useEditor()
const ui = useUi()

const original = computed<Divisoes>(() => editor.aberto?.divisoes ?? { divisoes: [] })
const rascunho = ref<Divisoes>({ divisoes: [] })
watch(original, (d) => (rascunho.value = copiar(d)), { immediate: true })
const alterado = computed(() => !igual(rascunho.value, original.value))

const porId = computed(() => new Map((editor.aberto?.competicoes ?? []).map((c) => [c.id, c])))
const competicao = (id: string): Competicao | undefined => porId.value.get(id)
const tamanho = (id: string) => {
  const c = competicao(id)
  return c?.participantes.regra === 'lista' ? c.participantes.times.length : null
}
const nome = (id: string) => competicao(id)?.nome ?? id

/** Competições que podem entrar na escada (participantes por lista). */
const elegiveis = computed(() => (editor.aberto?.competicoes ?? []).filter((c) => c.participantes.regra === 'lista'))
const usadas = computed(() => new Set(rascunho.value.divisoes.map((d) => d.competicao)))
const livres = computed(() => elegiveis.value.filter((c) => !usadas.value.has(c.id)))
const opcoesPara = (d: Divisao) => elegiveis.value.filter((c) => c.id === d.competicao || !usadas.value.has(c.id))

const problemas = computed(() => (editor.aberto?.problemas ?? []).filter((p) => p.arquivo === 'divisoes.json'))

function adicionar(): void {
  const c = livres.value[0]
  if (!c) return
  const lista = rascunho.value.divisoes
  lista.push(lista.length ? { competicao: c.id, troca: 4 } : { competicao: c.id })
}

/** Mantém a 1ª divisão sem troca e as outras com troca (ao mover ou remover). */
function normalizar(): void {
  rascunho.value.divisoes = rascunho.value.divisoes.map((d, i) => {
    if (i === 0) return { competicao: d.competicao }
    return { ...d, troca: d.troca ?? 4 }
  })
}

function mover(i: number, passo: -1 | 1): void {
  const l = rascunho.value.divisoes
  const j = i + passo
  if (j < 0 || j >= l.length) return
  ;[l[i], l[j]] = [l[j]!, l[i]!]
  normalizar()
}

function remover(i: number): void {
  rascunho.value.divisoes.splice(i, 1)
  normalizar()
}

async function salvar(): Promise<void> {
  const limpo: Divisoes = {
    divisoes: rascunho.value.divisoes.map((d) => {
      const r: Divisao = { competicao: d.competicao }
      if (d.troca) r.troca = d.troca
      if (d.descem && d.descem.criterio !== 'posicao') r.descem = d.descem
      if (d.sobem && d.sobem.criterio !== 'posicao') r.sobem = d.sobem
      return r
    }),
  }
  await editor.salvarDivisoes(limpo)
}

async function descartar(): Promise<void> {
  if (await ui.confirmar('Descartar alterações', 'Voltar a escada para o que está salvo no pacote?', 'Descartar')) rascunho.value = copiar(original.value)
}
</script>

<template>
  <WePainel titulo="Divisões" clube>
    <template #extra>{{ rascunho.divisoes.length }} divisão(ões)</template>
    <p class="we-lb">
      Da mais alta para a mais baixa. Entre cada par, o mesmo número sobe e desce. Vale para as carreiras novas deste pacote; as saídas de acesso/rebaixamento
      escritas nas competições da escada são substituídas.
    </p>

    <p v-if="!rascunho.divisoes.length" class="vazio">Nenhuma divisão. Sem escada, acesso e rebaixamento vêm só das saídas de cada competição.</p>

    <ol class="escada">
      <li v-for="(d, i) in rascunho.divisoes" :key="i" class="degrau-bloco">
        <div v-if="i > 0" class="troca">
          <div class="troca__numero">
            <label class="campo">
              <span class="we-lb">Trocam</span>
              <input v-model.number="d.troca" type="number" min="1" :aria-label="`Times que trocam entre ${nome(rascunho.divisoes[i - 1]!.competicao)} e ${nome(d.competicao)}`" />
            </label>
            <span class="troca__setas" aria-hidden="true">
              <span class="seta seta--desce">▼ {{ d.troca ?? 0 }}</span>
              <span class="seta seta--sobe">▲ {{ d.troca ?? 0 }}</span>
            </span>
          </div>
          <CampoCriterio
            v-model="d.descem"
            :competicao="competicao(rascunho.divisoes[i - 1]!.competicao)"
            lado="ultimos"
            :troca="d.troca ?? 0"
            :rotulo="`Descem de ${nome(rascunho.divisoes[i - 1]!.competicao)}`"
          />
          <CampoCriterio v-model="d.sobem" :competicao="competicao(d.competicao)" lado="primeiros" :troca="d.troca ?? 0" :rotulo="`Sobem de ${nome(d.competicao)}`" />
        </div>

        <div class="degrau">
          <span class="degrau__n">{{ i + 1 }}</span>
          <label class="campo degrau__comp">
            <span class="we-lb">Competição</span>
            <select v-model="d.competicao">
              <option v-for="c in opcoesPara(d)" :key="c.id" :value="c.id">{{ c.nome }}</option>
            </select>
          </label>
          <span class="degrau__tam">{{ tamanho(d.competicao) ?? '—' }} times</span>
          <div class="acoes">
            <WeBotao icone="subir" :desabilitado="i === 0" @click="mover(i, -1)">Subir</WeBotao>
            <WeBotao icone="descer" :desabilitado="i === rascunho.divisoes.length - 1" @click="mover(i, 1)">Descer</WeBotao>
            <WeBotao icone="lixeira" @click="remover(i)">Remover</WeBotao>
          </div>
        </div>
      </li>
    </ol>

    <div class="acoes">
      <WeBotao icone="nova" :desabilitado="!livres.length" @click="adicionar">Adicionar divisão</WeBotao>
      <span v-if="!livres.length && elegiveis.length" class="we-lb">Todas as competições por lista já estão na escada.</span>
    </div>

    <ul v-if="problemas.length" class="problemas">
      <li v-for="(p, k) in problemas" :key="k" :class="p.nivel === 'erro' ? 'we-vl--negativo' : 'we-vl--atencao'">{{ p.mensagem }}</li>
    </ul>

    <div class="acoes rodape-form">
      <WeBotao icone="salvar" variante="principal" :desabilitado="editor.ocupado || !alterado" @click="salvar">Salvar divisões</WeBotao>
      <WeBotao icone="descartar" :desabilitado="!alterado" @click="descartar">Descartar</WeBotao>
      <span v-if="alterado" class="we-lb">Alterações não salvas (a validação acima é da versão salva).</span>
    </div>
  </WePainel>
</template>

<style scoped>
.vazio {
  margin: 0;
}
.escada {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.degrau {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--clube);
  border-radius: var(--radius-sm);
}
.degrau__n {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  min-width: 28px;
  color: var(--texto-forte);
  align-self: center;
}
.degrau__comp {
  flex: 1;
  max-width: 320px;
}
.degrau__tam {
  align-self: center;
  font-family: var(--font-display);
  color: var(--texto-suave);
  min-width: 70px;
}
.troca {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  gap: var(--space-4);
  margin-left: 18px;
  padding: var(--space-2) var(--space-3);
  border-left: 2px dashed var(--linha-forte);
}
.troca__numero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.troca__numero input {
  width: 70px;
}
.troca__setas {
  display: flex;
  gap: var(--space-2);
  font-family: var(--font-display);
  font-weight: 700;
}
.seta--desce {
  color: var(--negativo);
}
.seta--sobe {
  color: var(--positivo);
}
.problemas {
  margin: 0;
  padding-left: 18px;
}
</style>
