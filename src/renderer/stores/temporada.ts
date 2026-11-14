import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Calendario, EdicaoResumo, Jogo, ResultadoContinuar, TimeResumo } from '@shared/esquemas/temporada'
import { chamar } from '../api'

/** Calendário, competições e times da carreira aberta (dados vêm prontos do main). */
export const useTemporada = defineStore('temporada', () => {
  const times = ref(new Map<string, TimeResumo>())
  const calendario = ref<Calendario | null>(null)
  const edicoes = ref<EdicaoResumo[]>([])
  const ultimo = ref<ResultadoContinuar | null>(null)
  const avancando = ref(false)

  const proximoJogo = computed<Jogo | null>(() => {
    const c = calendario.value
    if (!c) return null
    return c.passos.find((p) => p.indice >= c.passoAtual && p.jogo && !p.jogo.placar)?.jogo ?? null
  })

  /** O jogo do usuário é a data atual (ainda sem resultado): o CONTINUAR abre o pré-jogo. */
  const jogoNaDataAtual = computed<Jogo | null>(() => {
    const c = calendario.value
    if (!c || c.encerrada) return null
    const j = c.passos.find((p) => p.indice === c.passoAtual)?.jogo
    return j && !j.placar ? j : null
  })

  async function recarregar(): Promise<void> {
    const [cal, eds] = await Promise.all([chamar('temporada:calendario', undefined), chamar('temporada:edicoes', undefined)])
    calendario.value = cal
    edicoes.value = eds
  }

  async function carregar(): Promise<void> {
    const [ts, cal, eds] = await Promise.all([
      chamar('carreira:times', undefined),
      chamar('temporada:calendario', undefined),
      chamar('temporada:edicoes', undefined),
    ])
    times.value = new Map(ts.map((t) => [t.sigla, t]))
    calendario.value = cal
    edicoes.value = eds
  }

  function limpar(): void {
    times.value = new Map()
    calendario.value = null
    edicoes.value = []
    ultimo.value = null
  }

  async function continuar(): Promise<ResultadoContinuar> {
    avancando.value = true
    try {
      const r = await chamar('carreira:continuar', undefined)
      ultimo.value = r
      const [cal, eds] = await Promise.all([chamar('temporada:calendario', undefined), chamar('temporada:edicoes', undefined)])
      calendario.value = cal
      edicoes.value = eds
      return r
    } finally {
      avancando.value = false
    }
  }

  const nome = (sigla: string) => times.value.get(sigla)?.nome ?? sigla

  return { times, calendario, edicoes, ultimo, avancando, proximoJogo, jogoNaDataAtual, carregar, recarregar, limpar, continuar, nome }
})
