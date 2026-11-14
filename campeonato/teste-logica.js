// node teste-logica.js — confere tabela, classificação e leitura do resultado.json
'use strict';
const assert = require('assert');
const C = require('./campeonato');

const times = ['cor', 'spfc', 'pal', 'san'].map(id => ({ id, nome: id.toUpperCase(), sigla: id.toUpperCase() }));
const camp = C.novoCampeonato({ nome: 'Teste', times, idaVolta: true });

// 4 times, turno e returno: 6 rodadas, 12 jogos, 2 por rodada
assert.strictEqual(camp.jogos.length, 12);
assert.strictEqual(new Set(camp.jogos.map(j => j.rodada)).size, 6);
for (let r = 1; r <= 6; r++) {
  const js = camp.jogos.filter(j => j.rodada === r);
  assert.strictEqual(js.length, 2);
  assert.strictEqual(new Set(js.flatMap(j => [j.casa, j.visitante])).size, 4, `rodada ${r}: todo mundo joga uma vez`);
}
// cada par se enfrenta duas vezes, uma com cada mando
const pares = new Set(camp.jogos.map(j => `${j.casa}>${j.visitante}`));
assert.strictEqual(pares.size, 12);
// mando equilibrado: 3 jogos em casa para cada um
for (const t of times) assert.strictEqual(camp.jogos.filter(j => j.casa === t.id).length, 3, `mando de ${t.id}`);

// turno único: 3 rodadas, 6 jogos
assert.strictEqual(C.novoCampeonato({ times, idaVolta: false }).jogos.length, 6);

// classificação
const enc = (j, c, v) => Object.assign(j, { status: 'encerrado', placar: { casa: c, visitante: v } });
const [a, b] = camp.jogos;
enc(a, 2, 0);
enc(b, 1, 1);
const cl = C.classificacao(camp);
assert.strictEqual(cl[0].id, a.casa);
assert.strictEqual(cl[0].pts, 3);
assert.strictEqual(cl[0].sg, 2);
assert.strictEqual(cl[cl.length - 1].id, a.visitante);
assert.deepStrictEqual(cl.map(l => l.pts).sort(), [0, 1, 1, 3]);

// resultado.json no formato da ponte
const r = C.normalizarResultado({
  partida_id: 'x', final: true,
  casa: { nome: 'Corinthians', gols: 1 }, visitante: { nome: 'SPFC', gols: 1 },
  gols: [
    { lado: 'visitante', vaga: 8, nome: 'Aurelio', minuto: 18, assistencia: 'Cardoso' },
    { lado: 'casa', vaga: 9, nome: 'Toninho', minuto: 35 },
  ],
  penaltis: { casa: 3, visitante: 4 },
});
assert.strictEqual(r.golsCasa, 1);
assert.strictEqual(r.golsVisitante, 1);
assert.strictEqual(r.gols[0].assistencia, 'Cardoso');
assert.deepStrictEqual(r.penaltis, { casa: 3, visitante: 4 });

// formato real da ponte (bridge/resultado.lua)
const real = C.normalizarResultado({
  partida_id: 'fla-flu-0001', final: false, penaltis: true, vencedor: 'visitante',
  casa: { nome: 'Flamengo', gols: 1, penaltis: 3 }, visitante: { nome: 'Fluminense', gols: 1, penaltis: 4 },
  gols: [{ lado: 'casa', minuto: 35, periodo: '1T', vaga: 9, nome: 'Toninho', assist_vaga: 8, assist_nome: 'Valadares' }],
});
assert.strictEqual(real.gols[0].assistencia, 'Valadares');
assert.deepStrictEqual(real.penaltis, { casa: 3, visitante: 4 });
assert.strictEqual(C.normalizarResultado({ casa: { gols: 0, penaltis: null }, visitante: { gols: 0, penaltis: null }, penaltis: false }).penaltis, null);

// artilharia usa os gols do jogo encerrado
a.gols = [{ lado: 'casa', nome: 'Toninho' }, { lado: 'casa', nome: 'Toninho' }];
const art = C.artilharia(camp);
assert.deepStrictEqual(art[0], { nome: 'Toninho', time: a.casa, gols: 2 });

// seu time sempre na vaga da casa (controle 1)
const jf = { casa: 'fla', visitante: 'cor' };
assert.deepStrictEqual(C.vagasDoJogo(jf, 'cor'), { slotCasa: 'cor', slotVisitante: 'fla', invertido: true });
assert.strictEqual(C.vagasDoJogo(jf, 'fla').invertido, false);
assert.strictEqual(C.vagasDoJogo(jf, null).invertido, false);
const inv = C.desinverter({ casaNome: 'Corinthians', visitanteNome: 'Flamengo', golsCasa: 2, golsVisitante: 0,
  gols: [{ lado: 'casa', nome: 'Toninho' }], penaltis: null }, true);
assert.strictEqual(inv.golsCasa, 0); assert.strictEqual(inv.golsVisitante, 2);
assert.strictEqual(inv.gols[0].lado, 'visitante');
assert.throws(() => C.novoCampeonato({ times, meuTime: 'xyz' }));

// simulação com os elencos reais, se estiverem disponíveis
const fs = require('fs');
const dir = process.env.TIMES_DIR;
if (dir && fs.existsSync(dir)) {
  const ler = n => JSON.parse(fs.readFileSync(`${dir}/${n}.json`, 'utf-8'));
  const nomes = ['corinthians', 'flamengo', 'fluminense', 'spfc'];
  for (const n of nomes) { const f = C.forcaTime(ler(n)); console.log(n.padEnd(12), 'ataque', f.ataque.toFixed(2), 'defesa', f.defesa.toFixed(2)); }
  let tot = 0, emp = 0, cv = 0; const N = 2000; const art = {};
  for (let i = 0; i < N; i++) {
    const r = C.simularPartida(ler('flamengo'), ler('spfc'));
    tot += r.placar.casa + r.placar.visitante;
    if (r.placar.casa === r.placar.visitante) emp++;
    if (r.placar.casa > r.placar.visitante) cv++;
    assert.strictEqual(r.gols.length, r.placar.casa + r.placar.visitante);
    r.gols.forEach(g => { art[g.nome] = (art[g.nome] || 0) + 1; });
  }
  console.log(`FLA x SPFC em ${N} simulações: ${(tot / N).toFixed(2)} gols/jogo, mandante vence ${(100 * cv / N).toFixed(0)}%, empate ${(100 * emp / N).toFixed(0)}%`);
  console.log('mais gols:', Object.entries(art).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', '));
}

console.log('ok: tabela, classificação, resultado.json, artilharia, seu time e simulação');
