// Campos do registro de 12 bytes do jogador além dos 15 atributos, da camisa e da altura
// (mapa completo em docs/offsets.md, 11/11/2026). Mesma tabela da ponte Lua (bridge/we2002.lua).
//
// No arquivo do time (data/times/*.json), por jogador, todos opcionais (ausente = mantém o original):
//   posicao:  "GK" | "CB" | "LB"/"RB" (SB) | "DH" | "LH"/"RH" (SH) | "OH" | "CF" | "LW"/"RW" (WG)
//   pe:       "destro" | "canhoto" | "ambidestro"
//   idade:    15 a 46
//   outside:  true | false
//   atributos.AGR: 12 a 19 (agressividade, AGREC. no menu)
//   aparencia: { pele: 1-4 (clara → escura), fisico: "A"-"H" (magro → forte), cabelo: "a1"…"p1",
//                cor_cabelo: "A"-"H", barba: "A"-"G" (A = sem barba), cor_barba: "A"-"G", chuteira: "A"-"H" }

export const POSICOES = { GK: 0, CB: 1, SW: 1, SB: 2, LB: 2, RB: 2, WB: 2, DH: 3, DM: 3, CH: 3,
  SH: 4, LH: 4, RH: 4, OH: 5, AM: 5, CF: 6, SS: 6, WG: 7, LW: 7, RW: 7, WF: 7 };
export const PES = { destro: 0, canhoto: 1, ambidestro: 2 };
export const CABELOS = ["a1", "a2", "a3", "b1", "b2", "b3", "b4", "b5", "b6", "c1", "c2", "d1", "d2", "e1", "e2", "f1",
  "f2", "f3", "g1", "h1", "i1", "i2", "i3", "j1", "k1", "l1", "l2", "l3", "m1", "n1", "o1", "p1"];

const letra = (v, max) => {
  if (typeof v !== "string" || v.length !== 1) return null;
  const n = v.toUpperCase().charCodeAt(0) - 65;
  return n >= 0 && n <= max ? n : null;
};
const faixa = (v, a, b) => Math.max(a, Math.min(b, Math.floor(v)));

// Lista de [word (0-2), bit inicial, bits, valor] a gravar.
export function camposRegistro(e) {
  const c = [];
  const put = (w, sh, nb, v) => { if (v !== null && v !== undefined) c.push([w, sh, nb, v]); };
  if (typeof e.posicao === "string") put(0, 0, 3, POSICOES[e.posicao.toUpperCase()] ?? null);
  if (typeof e.pe === "string") put(2, 30, 2, PES[e.pe.toLowerCase()] ?? null);
  if (typeof e.idade === "number") put(1, 5, 5, faixa(e.idade - 15, 0, 31));
  if (typeof e.outside === "boolean") put(0, 31, 1, e.outside ? 1 : 0);
  const ag = e.atributos && typeof e.atributos === "object" ? e.atributos.AGR : undefined;
  if (typeof ag === "number") put(2, 24, 3, faixa(ag - 12, 0, 7));
  const a = e.aparencia && typeof e.aparencia === "object" ? e.aparencia : {};
  if (typeof a.pele === "number") put(1, 0, 2, faixa(a.pele - 1, 0, 3));
  put(1, 2, 3, letra(a.fisico, 7));
  if (typeof a.cabelo === "string") { const i = CABELOS.indexOf(a.cabelo.toLowerCase()); put(0, 4, 5, i >= 0 ? i : null); }
  else if (typeof a.cabelo === "number") put(0, 4, 5, faixa(a.cabelo, 0, 31));
  put(0, 9, 3, letra(a.cor_cabelo, 7));
  put(0, 13, 3, letra(a.barba, 6));
  put(0, 17, 3, letra(a.cor_barba, 6));
  put(2, 27, 3, letra(a.chuteira, 7));
  return c;
}

export function aplicarCampos(w, campos) {
  for (const [i, sh, nb, v] of campos) {
    const mask = ((((1 << nb) >>> 0) - 1) << sh) >>> 0;
    w[i] = ((w[i] & ~mask) | ((v << sh) & mask)) >>> 0;
  }
  return w;
}
