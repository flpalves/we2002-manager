import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { escalar } from '@core/partida/ia'
import { aplicarEscalacaoSalva, validarEscalacaoSalva, type EscalacaoSalva } from '@core/partida/escalacaoSalva'
import { elencoSintetico } from '../helpers/elencos'

const elenco = elencoSintetico('A', criarRng(3), 12)
const ids = (js: { id: string }[]) => js.map((j) => j.id)

function salvaDaIa(): EscalacaoSalva {
  const e = escalar(elenco, { formacao: '4-4-2A', prioridade: 'liga' }, PADROES)
  return { formacao: e.formacao, titulares: ids(e.titulares), reservas: ids(e.reservas) }
}

describe('escalação salva do usuário', () => {
  it('com todos disponíveis, sai exatamente como foi salva', () => {
    const base = salvaDaIa()
    const doisReservas = ids(elenco).filter((id) => !base.titulares.includes(id)).slice(-2)
    const salva: EscalacaoSalva = { ...base, reservas: doisReservas }
    const e = aplicarEscalacaoSalva(salva, elenco, PADROES)
    expect(ids(e.titulares)).toEqual(salva.titulares)
    expect(e.formacao).toBe(salva.formacao)
    expect(e.reservas.slice(0, 2).map((j) => j.id)).toEqual(doisReservas) // os escolhidos primeiro
    expect(e.reservas).toHaveLength(12) // completa a convocação do WE
    expect(e.substituidos).toEqual([])
  })

  it('desfalque: só a vaga dele muda, e de preferência com um reserva escolhido', () => {
    const salva = salvaDaIa()
    const fora = salva.titulares[3]!
    const e = aplicarEscalacaoSalva(salva, elenco.filter((j) => j.id !== fora), PADROES)
    expect(e.substituidos).toEqual([fora])
    expect(ids(e.titulares).filter((id, i) => id !== salva.titulares[i])).toHaveLength(1)
    expect(ids(e.titulares)).not.toContain(fora)
    expect(new Set([...ids(e.titulares), ...ids(e.reservas)]).size).toBe(22) // 22 disponíveis
  })

  it('vagas vazias são preenchidas pela IA e ninguém aparece duas vezes', () => {
    const salva: EscalacaoSalva = { formacao: '5-3-2', titulares: ['A0', null, null, null, null, null, null, null, null, null, 'A19'], reservas: ['A19', 'A1'] }
    const e = aplicarEscalacaoSalva(salva, elenco, PADROES)
    expect(e.titulares).toHaveLength(11)
    expect(e.titulares[0]!.id).toBe('A0')
    expect(e.titulares[10]!.id).toBe('A19')
    expect(ids(e.reservas)).not.toContain('A19')
    expect(new Set([...ids(e.titulares), ...ids(e.reservas)]).size).toBe(23)
  })

  it('validação para salvar', () => {
    const doElenco = new Set(ids(elenco))
    const ok = salvaDaIa()
    expect(validarEscalacaoSalva(ok, doElenco)).toBeNull()
    expect(validarEscalacaoSalva({ ...ok, formacao: '3-4-3' }, doElenco)).toMatch(/Formação/)
    expect(validarEscalacaoSalva({ ...ok, titulares: ok.titulares.slice(0, 10) }, doElenco)).toMatch(/11/)
    expect(validarEscalacaoSalva({ ...ok, reservas: [ok.titulares[0]!] }, doElenco)).toMatch(/repetido/)
    expect(validarEscalacaoSalva({ ...ok, reservas: ['X9'] }, doElenco)).toMatch(/elenco/)
    expect(validarEscalacaoSalva({ ...ok, reservas: Array.from({ length: 13 }, (_, i) => `A${i}`) }, doElenco)).toMatch(/12/)
  })
})
