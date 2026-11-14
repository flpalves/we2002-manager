import { criarRng, type Rng } from '../rng'
import { empatado } from '../competicoes/mataMata'
import type { Simulador } from '../competicoes/temporada'
import type { Partida, Resultado, Sigla } from '../competicoes/tipos'

/**
 * Simulador simples (Poisson pela força do elenco), rápido e sem elencos. Usado só nos testes
 * do calendário e das competições; a carreira usa o motor lance a lance (motor.ts + sessao.ts).
 */

export const PROVISORIO = {
  golsBase: 1.3,
  fatorCasa: 1.15,
  /** Quanto cada ponto de força (escala 1-20) muda os gols esperados. */
  pesoForca: 0.12,
  cobrancas: 5,
  acertoPenalti: 0.75,
}

export function poisson(lambda: number, rng: Rng): number {
  const limite = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng.proximo()
  } while (p > limite && k < 20)
  return k - 1
}

function penaltis(rng: Rng): [number, number] {
  let a = 0
  let b = 0
  for (let i = 0; i < PROVISORIO.cobrancas; i++) {
    if (rng.chance(PROVISORIO.acertoPenalti)) a++
    if (rng.chance(PROVISORIO.acertoPenalti)) b++
  }
  while (a === b) {
    const x = rng.chance(PROVISORIO.acertoPenalti)
    const y = rng.chance(PROVISORIO.acertoPenalti)
    if (x) a++
    if (y) b++
  }
  return [a, b]
}

export function criarSimuladorProvisorio(forca: (t: Sigla) => number, semente: number): Simulador {
  const raiz = criarRng(semente)
  return (p: Partida, ctx) => {
    const rng = raiz.derivar('partida', p.id)
    const dif = forca(p.casa) - forca(p.visitante)
    const lCasa = PROVISORIO.golsBase * PROVISORIO.fatorCasa * Math.exp(PROVISORIO.pesoForca * dif)
    const lFora = PROVISORIO.golsBase * Math.exp(-PROVISORIO.pesoForca * dif)
    const r: Resultado = {
      golsCasa: poisson(lCasa, rng),
      golsVisitante: poisson(lFora, rng),
      cartoesCasa: { amarelos: poisson(2, rng), vermelhos: rng.chance(0.06) ? 1 : 0 },
      cartoesVisitante: { amarelos: poisson(2.2, rng), vermelhos: rng.chance(0.07) ? 1 : 0 },
    }
    const mm = ctx.mataMata
    if (mm && p.jogo === mm.regra.jogos && empatado([...mm.anteriores, { ...p, resultado: r }], mm.regra)) {
      if (mm.regra.prorrogacao) {
        r.prorrogacao = true
        r.golsCasa += poisson(lCasa / 3, rng)
        r.golsVisitante += poisson(lFora / 3, rng)
      }
      if (empatado([...mm.anteriores, { ...p, resultado: r }], mm.regra)) {
        const [a, b] = penaltis(rng)
        r.penaltisCasa = a
        r.penaltisVisitante = b
      }
    }
    return r
  }
}
