import { PADROES, type Regras } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { escalar } from '@core/partida/ia'
import { simularPartida } from '@core/partida/motor'
import { elencoSintetico } from './elencos'

export interface MetricasLote {
  jogos: number
  golsPorJogo: number
  empates: number
  vantagemMandante: number
  amarelosPorJogo: number
  vermelhosPorJogo: number
  lesoesPorJogo: number
  substituicoesPorJogo: number
  /** Só quando `diferenca` > 0: % de vitórias do time mais forte (mando alternado). */
  vitoriasDoMaisForte: number
}

/** Roda `n` jogos entre times sorteados (média 11; o "forte" tem +diferenca em tudo). */
export function rodarLote(n: number, diferenca = 0, regras: Regras = PADROES, semente = 1): MetricasLote {
  const rng = criarRng(semente)
  let gols = 0
  let golsCasa = 0
  let golsFora = 0
  let empates = 0
  let amarelos = 0
  let vermelhos = 0
  let lesoes = 0
  let subs = 0
  let fortesVencem = 0
  for (let i = 0; i < n; i++) {
    const r = rng.derivar('jogo', i)
    const forteEmCasa = i % 2 === 0
    const a = elencoSintetico('A', r, 11 + (diferenca > 0 && forteEmCasa ? diferenca : 0))
    const b = elencoSintetico('B', r, 11 + (diferenca > 0 && !forteEmCasa ? diferenca : 0))
    const op = { formacao: '4-4-2A', prioridade: 'liga' as const }
    const s = simularPartida({
      casa: { sigla: 'A', escalacao: escalar(a, op, regras), entrosamento: 50 },
      visitante: { sigla: 'B', escalacao: escalar(b, op, regras), entrosamento: 50 },
      ocupacao: 0.6,
      substituicoes: 3,
      regras,
      rng: r.derivar('motor'),
    })
    gols += s.golsCasa + s.golsVisitante
    golsCasa += s.golsCasa
    golsFora += s.golsVisitante
    if (s.golsCasa === s.golsVisitante) empates++
    amarelos += s.amarelos.casa + s.amarelos.visitante
    vermelhos += s.vermelhos.casa + s.vermelhos.visitante
    lesoes += s.detalhe.eventos.filter((e) => e.tipo === 'lesao').length
    subs += s.detalhe.eventos.filter((e) => e.tipo === 'substituicao').length
    const forte = forteEmCasa ? s.golsCasa - s.golsVisitante : s.golsVisitante - s.golsCasa
    if (forte > 0) fortesVencem++
  }
  return {
    jogos: n,
    golsPorJogo: gols / n,
    empates: empates / n,
    vantagemMandante: (golsCasa - golsFora) / n,
    amarelosPorJogo: amarelos / n,
    vermelhosPorJogo: vermelhos / n,
    lesoesPorJogo: lesoes / n,
    substituicoesPorJogo: subs / n,
    vitoriasDoMaisForte: fortesVencem / n,
  }
}
