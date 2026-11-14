// Expande o partida.json com os arquivos de time (data/times/*.json):
//  - cada jogador do time vira uma "edição" (nome, camisa, altura, atributos, posição, pé, idade, aparência)
//    na vaga correspondente do time fixo do save state (casa = Brasil, visitante = Holanda);
//  - o kit do time (arte desenhada e cor dos números) substitui a arte do lado.
// Edições escritas direto no partida.json vêm depois e têm prioridade.

import fs from "node:fs";
import path from "node:path";

export function carregarPartida(partidaPath, ROOT) {
  const partida = JSON.parse(fs.readFileSync(partidaPath, "utf8"));
  const edicoes = [];
  const times = {};
  partida.kits = partida.kits || {};
  for (const lado of ["casa", "visitante"]) {
    const ref = partida[lado] && partida[lado].time;
    if (!ref) continue;
    const time = JSON.parse(fs.readFileSync(path.resolve(ROOT, ref), "utf8"));
    partida[lado].nome = time.nome;
    // bandeira/escudo e nome para a tela: o partida.json tem prioridade
    for (const k of ["bandeira", "bandeira_ajuste", "nome_tela"]) {
      if (time[k] !== undefined && partida[lado][k] === undefined) partida[lado][k] = time[k];
    }
    for (const j of time.jogadores || []) {
      edicoes.push({ lado, jogador: j.vaga, nome: j.nome, camisa: j.camisa, altura: j.altura, atributos: j.atributos,
        posicao: j.posicao, pe: j.pe, idade: j.idade, outside: j.outside, aparencia: j.aparencia });
    }
    times[lado] = time;
  }
  // Uniforme: partida[lado].uniforme = "titular" | "reserva" | "auto" (padrão).
  // No "auto", o visitante usa o kit_reserva quando a camisa titular se confunde com a do mandante.
  for (const lado of ["casa", "visitante"]) {
    const time = times[lado];
    if (!time) continue;
    const pedido = (partida[lado] && partida[lado].uniforme) || "auto";
    let kit = time.kit, uniforme = "titular";
    if (time.kit_reserva && pedido === "reserva") { kit = time.kit_reserva; uniforme = "reserva"; }
    else if (time.kit_reserva && pedido === "auto" && lado === "visitante" && times.casa) {
      const kitCasa = partida[`uniforme_casa_usado`] === "reserva" ? times.casa.kit_reserva : times.casa.kit;
      if (kitCasa && conflitoKits(kitCasa, time.kit) && !conflitoKits(kitCasa, time.kit_reserva)) {
        kit = time.kit_reserva; uniforme = "reserva";
      }
    }
    if (lado === "casa") partida.uniforme_casa_usado = uniforme;
    partida[lado].uniforme_usado = uniforme;
    if (kit) {
      partida.kits[lado] = { ...(partida.kits[lado] || {}), ...kit, costa_modelo: kit.costa_modelo || "primeira" };
    }
  }
  // Junta tudo por (lado, jogador): o que vem depois sobrescreve campo a campo.
  const porVaga = new Map();
  for (const e of [...edicoes, ...(partida.edicoes || [])]) {
    const chave = `${e.lado === "visitante" ? "visitante" : "casa"}:${e.jogador}`;
    const atual = porVaga.get(chave) || {};
    const limpo = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined));
    porVaga.set(chave, { ...atual, ...limpo });
  }
  partida.edicoes = [...porVaga.values()];
  return partida;
}

// Cor média da camisa e distância entre duas camisas. Espelho de src/core/we/uniformes.ts:
// listras contam pela média; mangas e faixas entram com o peso da área (PESO_NA_CAMISA).
const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
const PESO_NA_CAMISA = { mangas: 0.2, faixa_diagonal: 0.25, faixa_peito: 0.2 };
function corCamisa(kit) {
  const d = (kit && kit.design) || {};
  const cores = (d.listras_verticais && d.listras_verticais.cores) || [d.camisa];
  const v = cores.map(rgb).filter(Boolean);
  if (!v.length) return null;
  let media = [0, 1, 2].map((i) => v.reduce((a, c) => a + c[i], 0) / v.length);
  for (const [hex, peso] of [[d.mangas, PESO_NA_CAMISA.mangas], [d.faixa_diagonal && d.faixa_diagonal.cor, PESO_NA_CAMISA.faixa_diagonal],
    [d.faixa_peito && d.faixa_peito.cor, PESO_NA_CAMISA.faixa_peito]]) {
    const c = rgb(hex);
    if (c) media = media.map((m, i) => m * (1 - peso) + c[i] * peso);
  }
  return media;
}
export function conflitoKits(a, b, limite = 140) {
  const ca = corCamisa(a), cb = corCamisa(b);
  if (!ca || !cb) return false;
  return Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]) < limite;
}
