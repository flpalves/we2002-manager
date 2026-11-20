<script setup lang="ts">
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import PainelDestaques from '../componentes/PainelDestaques.vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { Sumula } from '@shared/esquemas/temporada'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeEscudo from '../componentes/WeEscudo.vue'
import WePlacar from '../componentes/WePlacar.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import { useTela } from '../composables/useTela'
import { useTemporada } from '../stores/temporada'
import { urlArquivoCarreira } from '../stores/carreira'
import { useUi } from '../stores/ui'
import { chamar } from '../api'

const rota = useRoute()
const router = useRouter()
const temporada = useTemporada()
const ui = useUi()
const s = ref<Sumula | null>(null)
/** Veio direto do jogo do usuário: mostra os destaques e o Voltar leva ao Início. */
const doJogo = computed(() => rota.query['destaques'] === '1')
const voltar = () => (doJogo.value ? void router.push({ name: 'inicio' }) : router.back())

useTela()

watch(
  () => rota.params['id'],
  async (id) => {
    if (typeof id !== 'string') return
    try {
      s.value = await chamar('partida:sumula', { id })
    } catch (e) {
      ui.avisar((e as Error).message)
    }
  },
  { immediate: true },
)

const time = (sigla: string) => temporada.times.get(sigla)
const minuto = (m: number, a: number) => (a > 0 ? `${m}+${a}'` : `${m}'`)

const ROTULO: Record<string, { texto: string; tag: 'positivo' | 'atencao' | 'negativo' | 'info' | 'padrao' }> = {
  gol: { texto: 'Gol', tag: 'positivo' },
  amarelo: { texto: 'Amarelo', tag: 'atencao' },
  vermelho: { texto: 'Vermelho', tag: 'negativo' },
  lesao: { texto: 'Lesão', tag: 'negativo' },
  substituicao: { texto: 'Troca', tag: 'info' },
}

function descricao(e: Sumula['eventos'][number]): string {
  if (e.tipo === 'gol') return `${e.jogador ?? '?'}${e.detalhe === 'cabeca' ? ' (de cabeça)' : ''}${e.outro ? ` · assist. ${e.outro}` : ''}`
  if (e.tipo === 'vermelho') return `${e.jogador ?? '?'}${e.detalhe === 'segundo_amarelo' ? ' (2º amarelo)' : ''}`
  if (e.tipo === 'lesao') {
    try {
      const d = JSON.parse(e.detalhe ?? '{}') as { gravidade?: string; semanas?: number }
      return `${e.jogador ?? '?'} · ${d.gravidade ?? ''}, ${d.semanas ?? '?'} semana(s)`
    } catch {
      return e.jogador ?? '?'
    }
  }
  if (e.tipo === 'substituicao') return `sai ${e.jogador ?? '?'}, entra ${e.outro ?? '?'}`
  return e.jogador ?? '?'
}

const penaltis = computed(() => {
  const p = s.value?.jogo.placar
  return p && p.penaltisCasa !== null ? `Pênaltis: ${p.penaltisCasa} x ${p.penaltisVisitante}` : ''
})
</script>

<template>
  <h1 class="titulo-tela">Súmula</h1>
  <template v-if="s">
    <WePainel :titulo="`${s.jogo.competicaoNome} · ${s.jogo.faseNome}${s.jogo.grupo ? ` · Grupo ${s.jogo.grupo}` : ''} · semana ${s.jogo.semana}`" clube>
      <div class="confronto">
        <div class="lado">
          <WeEscudo :sigla="s.jogo.casa" :cor="time(s.jogo.casa)?.cores[0]" :src="urlArquivoCarreira(time(s.jogo.casa)?.escudo ?? null)" tamanho="m" />
          <RouterLink class="nome nome--link" :to="{ name: 'time', params: { sigla: s.jogo.casa } }">{{ temporada.nome(s.jogo.casa) }}</RouterLink>
        </div>
        <div class="centro">
          <WePlacar :casa="s.jogo.placar?.golsCasa ?? null" :visitante="s.jogo.placar?.golsVisitante ?? null" />
          <span v-if="s.jogo.placar?.prorrogacao" class="we-lb">com prorrogação</span>
          <span v-if="penaltis" class="we-lb">{{ penaltis }}</span>
        </div>
        <div class="lado">
          <WeEscudo :sigla="s.jogo.visitante" :cor="time(s.jogo.visitante)?.cores[0]" :src="urlArquivoCarreira(time(s.jogo.visitante)?.escudo ?? null)" tamanho="m" />
          <RouterLink class="nome nome--link" :to="{ name: 'time', params: { sigla: s.jogo.visitante } }">{{ temporada.nome(s.jogo.visitante) }}</RouterLink>
        </div>
      </div>
      <div class="acoes">
        <WeBotao :icone="doJogo ? 'inicio' : 'voltar'" @click="voltar">{{ doJogo ? 'Ir para o Início' : 'Voltar' }}</WeBotao>
      </div>
    </WePainel>

    <PainelDestaques v-if="doJogo" :desde-semana="s.jogo.semana" />

    <div class="grade">
      <WePainel titulo="Lances" sem-corpo>
        <p v-if="!s.eventos.length" class="vazio">Sem lances registrados.</p>
        <WeTabela v-else>
          <tbody>
            <tr v-for="(e, i) in s.eventos" :key="i">
              <td class="min">{{ minuto(e.minuto, e.acrescimo) }}</td>
              <td><WeTag :tipo="ROTULO[e.tipo]!.tag">{{ ROTULO[e.tipo]!.texto }}</WeTag></td>
              <td><TimeDaCarreira :sigla="e.time" /></td>
              <td>{{ descricao(e) }}</td>
            </tr>
          </tbody>
        </WeTabela>
      </WePainel>

      <WePainel v-for="lado in (['casa', 'visitante'] as const)" :key="lado" :titulo="temporada.nome(lado === 'casa' ? s.jogo.casa : s.jogo.visitante)" sem-corpo>
        <WeTabela>
          <thead>
            <tr><th>Nº</th><th>Pos.</th><th>Jogador</th><th>Min.</th></tr>
          </thead>
          <tbody>
            <tr v-for="a in s[lado]" :key="a.jogador">
              <td>{{ a.camisa }}</td>
              <td>{{ a.posicao }}</td>
              <td>{{ a.jogador }} <WeTag v-if="!a.titular" tipo="info">Entrou</WeTag></td>
              <td>{{ a.minutos }}'</td>
            </tr>
          </tbody>
        </WeTabela>
      </WePainel>
    </div>
  </template>
</template>

<style scoped>
.confronto {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-2) 0;
}
.lado {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}
.nome {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--texto-forte);
}
.centro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.min {
  width: 44px;
  font-family: var(--font-display);
  font-weight: 600;
}
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.nome--link {
  color: inherit;
  text-decoration: none;
}
.nome--link:hover {
  text-decoration: underline;
}
</style>
