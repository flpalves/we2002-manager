/** Dinheiro para leitura humana (interface e textos das notícias). O banco e o núcleo guardam centavos. */

export const decimal = (n: number, casas: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** 4_820_000_000 → "R$ 48,2 mi"; 85_000_000 → "R$ 850 mil"; 12_345 → "R$ 123". */
export function dinheiro(centavos: number): string {
  const sinal = centavos < 0 ? '−' : ''
  const reais = Math.abs(centavos) / 100
  let texto: string
  if (reais >= 1_000_000_000) texto = `${decimal(reais / 1_000_000_000, 1)} bi`
  else if (reais >= 1_000_000) texto = `${decimal(reais / 1_000_000, reais >= 100_000_000 ? 0 : 1)} mi`
  else if (reais >= 1_000) texto = `${decimal(Math.round(reais / 1_000), 0)} mil`
  else texto = decimal(Math.round(reais), 0)
  return `${sinal}R$ ${texto.replace(/,0 /, ' ')}`
}
