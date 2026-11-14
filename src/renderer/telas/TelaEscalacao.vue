<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Escalacao, JogadorElenco } from '@shared/esquemas/elenco'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import WeSeta from '../componentes/WeSeta.vue'
import WeCampo from '../componentes/WeCampo.vue'
import BarraCondicao from '../componentes/BarraCondicao.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import { useTela } from '../composables/useTela'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { nomePosicao, ORDEM_POSICAO } from '../formato'

const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()

const esc = ref<Escalacao | null>(null)
const jogadores = ref(new Map<string, JogadorElenco>())
const formacao = ref('')
const titulares = ref<(string | null)[]>([])
const reservas = ref<string[]>([])
const ocupado = ref(false)

type Selecao = { tipo: 'vaga'; indice: number } | { tipo: 'jogador'; id: string } | null
const sel = ref<Selecao>(null)

useTela(
  [
    { comando: 'acaoX', rotulo: 'Reserva / fora' },
    { comando: 'acaoY', rotulo: 'Sugestão da IA' },
  ],
  {
    acaoX: () => {
      if (sel.value?.tipo === 'jogador') void alternarReserva(sel.value.id)
    },
    acaoY: () => void sugerir(),
  },
)

function aplicar(e: Escalacao): void {
  esc.value = e
  formacao.value = e.formacao
  titulares.value = [...e.titulares]
  reservas.value = [...e.reservas]
}

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    const [e, el] = await Promise.all([chamar('escalacao:obter', undefined), chamar('elenco:listar', undefined)])
    jogadores.value = new Map(el.jogadores.map((j) => [j.id, j]))
    aplicar(e)
  } catch (err) {
    ui.avisar((err as Error).message)
  }
}
watch(() => [carreira.atual?.id, temporada.calendario?.passoAtual], carregar, { immediate: true })

const papeis = computed(() => esc.value?.formacoes.find((f) => f.id === formacao.value)?.papeis ?? [])

/** Indisponíveis no próximo jogo: lesionados e suspensos (na competição do próximo jogo, se der para saber). */
const desfalques = computed(() => {
  const s = new Set<string>()
  const comp = esc.value?.proximoJogo?.competicao
  for (const j of jogadores.value.values()) {
    if (j.lesaoSemanas > 0 || (comp ? j.suspenso.includes(comp) : j.suspenso.length > 0)) s.add(j.id)
  }
  return s
})

type Status = 'TIT' | 'RES' | 'FORA'
const statusDe = (id: string): Status => (titulares.value.includes(id) ? 'TIT' : reservas.value.includes(id) ? 'RES' : 'FORA')

const lista = computed(() => {
  const ordem: Record<Status, number> = { TIT: 0, RES: 1, FORA: 2 }
  const pos = (p: string) => ORDEM_POSICAO.indexOf(p)
  return [...jogadores.value.values()].sort((a, b) => {
    const sa = statusDe(a.id)
    const sb = statusDe(b.id)
    if (sa !== sb) return ordem[sa] - ordem[sb]
    if (sa === 'TIT') return titulares.value.indexOf(a.id) - titulares.value.indexOf(b.id)
    return pos(a.posicao) - pos(b.posicao) || b.geral - a.geral
  })
})

async function salvar(): Promise<void> {
  ocupado.value = true
  try {
    aplicar(await chamar('escalacao:salvar', { formacao: formacao.value, titulares: titulares.value, reservas: reservas.value }))
  } catch (e) {
    ui.avisar((e as Error).message)
    await carregar()
  } finally {
    ocupado.value = false
  }
}

/** Põe o jogador na vaga; quem estava nela fica com o lugar que era dele. */
function colocar(id: string, vaga: number): void {
  const t = [...titulares.value]
  const r = [...reservas.value]
  const ocupante = t[vaga] ?? null
  if (ocupante === id) return
  const k = t.indexOf(id)
  if (k >= 0) {
    t[k] = ocupante
  } else {
    const ri = r.indexOf(id)
    if (ri >= 0) {
      if (ocupante) r[ri] = ocupante
      else r.splice(ri, 1)
    }
  }
  t[vaga] = id
  titulares.value = t
  reservas.value = r
}

/** Troca dois jogadores de lugar (vaga, reserva ou fora). */
function trocar(a: string, b: string): void {
  const sa = statusDe(a)
  const sb = statusDe(b)
  if (sa === 'TIT') return colocar(b, titulares.value.indexOf(a))
  if (sb === 'TIT') return colocar(a, titulares.value.indexOf(b))
  const r = [...reservas.value]
  if (sa === 'RES' && sb === 'FORA') r[r.indexOf(a)] = b
  else if (sa === 'FORA' && sb === 'RES') r[r.indexOf(b)] = a
  reservas.value = r
}

async function clicarVaga(i: number): Promise<void> {
  const s = sel.value
  if (!s) {
    sel.value = { tipo: 'vaga', indice: i }
    return
  }
  sel.value = null
  if (s.tipo === 'vaga') {
    if (s.indice === i) return
    const t = [...titulares.value]
    ;[t[i], t[s.indice]] = [t[s.indice] ?? null, t[i] ?? null]
    titulares.value = t
  } else {
    colocar(s.id, i)
  }
  await salvar()
}

async function clicarJogador(id: string): Promise<void> {
  const s = sel.value
  if (!s) {
    sel.value = { tipo: 'jogador', id }
    return
  }
  sel.value = null
  if (s.tipo === 'vaga') colocar(id, s.indice)
  else if (s.id !== id) trocar(s.id, id)
  else return
  await salvar()
}

async function alternarReserva(id: string): Promise<void> {
  sel.value = null
  const st = statusDe(id)
  if (st === 'TIT') return ui.avisar('Titular: troque por outro jogador para tirá-lo do time.')
  if (st === 'RES') reservas.value = reservas.value.filter((x) => x !== id)
  else if (reservas.value.length >= 12) return ui.avisar('Já são 12 reservas (o máximo do WE).')
  else reservas.value = [...reservas.value, id]
  await salvar()
}

async function trocarFormacao(f: string): Promise<void> {
  if (f === formacao.value) return
  const ok = await ui.confirmar('Trocar a formação', `Mudar para ${f}? Os jogadores ficam nas mesmas vagas, e o entrosamento cai pela metade.`, 'Trocar')
  if (!ok) return
  formacao.value = f
  await salvar()
}

async function sugerir(): Promise<void> {
  ocupado.value = true
  try {
    aplicar(await chamar('escalacao:sugerir', { formacao: formacao.value }))
    sel.value = null
    ui.avisar('Escalação sugerida pela IA (titulares e reservas).')
  } catch (e) {
    ui.avisar((e as Error).message)
  } finally {
    ocupado.value = false
  }
}

async function automatica(): Promise<void> {
  try {
    aplicar(await chamar('escalacao:automatica', undefined))
    sel.value = null
    ui.avisar('A IA vai escalar o time a cada jogo.')
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

const selecionadaVaga = computed(() => (sel.value?.tipo === 'vaga' ? sel.value.indice : null))
const selecionadoJogador = computed(() => (sel.value?.tipo === 'jogador' ? sel.value.id : null))
const dica = computed(() => {
  if (!sel.value) return 'Escolha uma vaga ou um jogador; depois escolha com quem trocar.'
  if (sel.value.tipo === 'vaga') return 'Agora escolha o jogador (ou outra vaga) para essa posição.'
  return 'Agora escolha a vaga ou o jogador para trocar. X põe/tira dos reservas.'
})
const substituidosNoJogo = computed(() => (esc.value?.noProximoJogo?.substituidos ?? []).map((id) => jogadores.value.get(id)?.nome ?? id))
</script>

<template>
  <h1 class="titulo-tela">Escalação</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para escalar o time.</p></WePainel>
  <template v-else-if="esc">
    <div class="resumo">
      <span class="we-kv">
        <span class="we-lb">Modo</span>
        <WeTag :tipo="esc.automatica ? 'info' : 'tit'">{{ esc.automatica ? 'Automática (IA escala a cada jogo)' : 'Manual' }}</WeTag>
      </span>
      <span v-if="esc.proximoJogo" class="we-kv">
        <span class="we-lb">Próximo jogo</span>
        <span class="we-vl">{{ esc.proximoJogo.emCasa ? 'em casa' : 'fora' }} contra</span>
        <TimeDaCarreira :sigla="esc.proximoJogo.adversario" />
        <span class="we-lb">{{ esc.proximoJogo.competicao }}</span>
      </span>
      <span class="we-kv"><span class="we-lb">Entrosamento</span><span class="we-vl">{{ esc.entrosamento }}</span></span>
    </div>

    <div class="duas">
      <WePainel :titulo="`Formação ${formacao}`" clube>
        <div class="formacoes">
          <WeBotao v-for="f in esc.formacoes" :key="f.id" :ativo="formacao === f.id" :desabilitado="ocupado" @click="trocarFormacao(f.id)">{{ f.id }}</WeBotao>
        </div>
        <WeCampo :papeis="papeis" :titulares="titulares" :jogadores="jogadores" :selecionada="selecionadaVaga" :desfalques="desfalques" @vaga="clicarVaga" />
        <p class="we-lb dica">{{ dica }}</p>
        <p v-if="substituidosNoJogo.length" class="we-vl--atencao">Fora do próximo jogo (a IA põe outro na vaga): {{ substituidosNoJogo.join(', ') }}.</p>
        <div class="acoes">
          <WeBotao icone="ideia" variante="principal" :desabilitado="ocupado" @click="sugerir">Sugestão da IA</WeBotao>
          <WeBotao v-if="!esc.automatica" icone="restaurar" :desabilitado="ocupado" @click="automatica">Deixar automática</WeBotao>
        </div>
      </WePainel>

      <WePainel :titulo="`Convocação: ${titulares.filter(Boolean).length} titulares · ${reservas.length} reservas`" sem-corpo>
        <WeTabela>
          <thead>
            <tr><th></th><th>Nº</th><th>Pos.</th><th>Jogador</th><th>Geral</th><th>Condição</th><th>Seta</th><th>Situação</th></tr>
          </thead>
          <tbody>
            <tr v-for="j in lista" :key="j.id" :class="{ sel: selecionadoJogador === j.id }">
              <td>
                <WeTag :tipo="statusDe(j.id) === 'TIT' ? 'tit' : statusDe(j.id) === 'FORA' ? 'fora' : 'padrao'">{{ statusDe(j.id) }}</WeTag>
              </td>
              <td>{{ j.camisa }}</td>
              <td>{{ nomePosicao(j.posicao) }}</td>
              <td><button type="button" class="link" @click="clicarJogador(j.id)">{{ j.nome }}</button></td>
              <td class="geral">{{ j.geral }}</td>
              <td><BarraCondicao :valor="j.condicao" /></td>
              <td><WeSeta :nivel="j.seta" /></td>
              <td>
                <span class="tags">
                  <WeTag v-if="j.lesaoSemanas" tipo="negativo">Lesão {{ j.lesaoSemanas }} sem.</WeTag>
                  <WeTag v-for="c in j.suspenso" :key="c" tipo="negativo" :title="c">Suspenso</WeTag>
                  <WeTag v-for="c in j.pendurado" :key="`p${c}`" tipo="atencao" :title="c">Pendurado</WeTag>
                  <WeBotao v-if="statusDe(j.id) !== 'TIT'" :icone="statusDe(j.id) === 'RES' ? 'descartar' : 'nova'" class="mini" :desabilitado="ocupado" @click="alternarReserva(j.id)">
                    {{ statusDe(j.id) === 'RES' ? 'Tirar' : 'Convocar' }}
                  </WeBotao>
                </span>
              </td>
            </tr>
          </tbody>
        </WeTabela>
      </WePainel>
    </div>
  </template>
</template>

<style scoped>
.resumo {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  align-items: center;
}
.resumo .we-kv {
  gap: 6px;
}
.duas {
  display: grid;
  grid-template-columns: minmax(380px, 1fr) minmax(0, 1.25fr);
  gap: var(--gap-painel);
  align-items: start;
}
.formacoes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--space-3);
}
.formacoes .we-btn {
  padding: 4px 10px;
}
.dica {
  margin: var(--space-3) 0 0;
}
.acoes {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.tags {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.mini {
  padding: 2px 8px;
  font-size: 11px;
}
.geral {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--texto-forte);
}
.link {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--texto-forte);
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.link:hover,
.link:focus-visible {
  text-decoration: underline;
}
tr.sel td {
  background: var(--painel-alt);
  box-shadow: inset 0 0 0 1px var(--atencao);
}
</style>
