'use strict';
/* global we */

let E = null;            // último estado vindo do processo principal
let aba = 'calendario';  // calendario | artilharia
let manualAberto = null; // id do jogo com o formulário de placar manual aberto
let selecao = new Set(); // times escolhidos na tela de novo campeonato
let criando = false;     // tela de novo campeonato forçada
let meuEscolhido = null; // seu time na tela de novo campeonato
let tela = null;         // 'campeonato' | 'amistoso' (null: decide no primeiro estado)
const amForm = { casa: null, visitante: null, cenario: 'p1_cpu', mataMata: false, emulador: null };
// escolha de uniformes do jogo na tela: chave = 'am:<casa>:<vis>' ou 'j:<jogo>'
let uniSel = { chave: null, casaId: null, visId: null, casa: 'auto', visitante: 'auto', previa: null, pedindo: false };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ehMeu = j => !!E.campeonato.meuTime && (j.casa === E.campeonato.meuTime || j.visitante === E.campeonato.meuTime);
const timeDe = id => E.campeonato.times.find(t => t.id === id) || { nome: id, sigla: '?' };

function escudo(t, peq = false) {
  const cor = t.cor || '#2a382d';
  const borda = t.cor2 || '#93a596';
  const txt = peq ? '' : esc(t.sigla);
  const corTxt = luminancia(cor) > 0.55 ? '#111' : '#fff';
  return `<span class="escudo${peq ? ' peq' : ''}" style="background:${esc(cor)};border-color:${esc(borda)};color:${corTxt}">${txt}</span>`;
}
function luminancia(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function aviso(msg, ok = false) {
  const el = $('#aviso');
  el.textContent = msg;
  el.className = 'aviso' + (ok ? ' ok' : '');
  el.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.hidden = true; }, ok ? 3500 : 7000);
}

async function acao(fn, msgOk) {
  try {
    const r = await fn();
    E = r.estado || r;
    render();
    if (msgOk) aviso(typeof msgOk === 'function' ? msgOk(r) : msgOk, true);
  } catch (err) { aviso(err.message); }
}

async function recarregar() {
  try {
    E = await we.estado();
    if (tela === null) tela = E.amistoso && E.amistoso.status === 'em_andamento' ? 'amistoso' : 'campeonato';
    if (tela === 'times' && ed) return;
    render();
  } catch (err) { aviso(err.message); }
}

// ---------------- telas ----------------
function render() {
  const c = E.campeonato;
  const amVivo = E.amistoso && E.amistoso.status === 'em_andamento';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('ativa', b.dataset.tela === tela));
  $('#btn-amistoso').textContent = amVivo ? 'Amistoso · ao vivo' : 'Amistoso';
  $('#btn-amistoso').classList.toggle('vivo', !!amVivo);
  if (tela === 'amistoso') { $('#btn-novo').hidden = true; renderAmistoso(); return; }
  if (tela === 'times') { $('#btn-novo').hidden = true; renderTimes(); return; }
  $('#btn-novo').hidden = !c || criando;
  if (!c || criando) { renderSetup(); return; }
  const feitos = c.jogos.filter(j => j.status === 'encerrado').length;
  $('#titulo-camp').innerHTML = `<strong>${esc(c.nome)}</strong> · ${feitos}/${c.jogos.length} jogos · ${c.idaVolta ? 'turno e returno' : 'turno único'}
    <label class="meu-sel">Seu time
      <select id="sel-meu">
        <option value="">nenhum</option>
        ${c.times.map(t => `<option value="${esc(t.id)}" ${t.id === c.meuTime ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}
      </select></label>`;
  $('#app').innerHTML = `
    <div class="grade">
      <div class="coluna">
        ${cartaoProximo()}
        <section class="cartao">
          <div class="abas">
            <button class="aba ${aba === 'calendario' ? 'ativa' : ''}" data-aba="calendario">Calendário</button>
            <button class="aba ${aba === 'artilharia' ? 'ativa' : ''}" data-aba="artilharia">Artilharia</button>
          </div>
          ${aba === 'calendario' ? calendario() : artilharia()}
        </section>
      </div>
      <div class="coluna">${tabela()}</div>
    </div>`;
}

function cartaoProximo() {
  const c = E.campeonato;
  const j = c.jogos.find(x => x.id === E.proximoJogoId);
  if (!j) {
    const campeao = E.classificacao[0];
    return `<section class="cartao"><h2>Campeonato encerrado</h2>
      <div class="placar"><div></div><div class="time">${escudo(timeDe(campeao.id))}<span class="nome">${esc(campeao.nome)}</span><span class="lado">Campeão · ${campeao.pts} pts</span></div><div></div></div></section>`;
  }
  const casa = timeDe(j.casa), vis = timeDe(j.visitante);
  const vivo = j.status === 'em_andamento';
  const meu = ehMeu(j);
  const r = vivo ? E.resultadoAoVivo : null;
  const valido = r && r.conferencia && r.conferencia.ok;

  let marcador = `<div class="marcador vazio">– x –</div>`;
  let gols = '', pen = '', alerta = '';
  if (valido) {
    marcador = `<div class="marcador">${r.golsCasa} x ${r.golsVisitante}</div>`;
    gols = listaGols(r.gols);
    if (r.penaltis) pen = `<div class="pen">Pênaltis ${r.penaltis.casa ?? 0} x ${r.penaltis.visitante ?? 0}</div>`;
  } else if (vivo && r && !r.conferencia.ok) {
    alerta = `<div class="alerta">Aguardando o resultado desta partida (${esc(r.conferencia.motivo)}).</div>`;
  } else if (vivo) {
    alerta = `<div class="alerta">Aguardando o <code>data/resultado.json</code>. Ele aparece aqui sozinho quando a ponte gravar.</div>`;
  }

  const status = vivo
    ? (valido && r.final ? `<span class="status fim">Fim de jogo</span>` : `<span class="status vivo">${valido ? 'Parcial' : 'Em andamento'}</span>`)
    : `<span class="status ${meu ? 'meu' : ''}">${meu ? 'Seu jogo' : 'Próximo jogo'}</span>`;

  const emuls = Object.entries(E.config.emuladores)
    .map(([k, v]) => `<option value="${esc(k)}" ${k === E.config.emuladorPadrao ? 'selected' : ''}>${esc(v.nome)}</option>`).join('');

  const outrosPendentes = c.jogos.filter(x => x.rodada === j.rodada && x.status === 'agendado' && !ehMeu(x)).length;
  const botoes = vivo ? `
      <button class="btn primario" data-acao="confirmar" data-id="${j.id}" ${valido ? '' : 'disabled'}>Confirmar resultado</button>
      <button class="btn" data-acao="manual" data-id="${j.id}">Lançar placar</button>
      <button class="btn fantasma perigo" data-acao="cancelar" data-id="${j.id}">Cancelar partida</button>`
    : meu || !c.meuTime ? `
      <select id="emulador">${emuls}</select>
      ${temEstado('p1_p2') ? `<select id="opcao-controle"><option value="">${meu ? 'Você x CPU' : 'P1 (casa) x CPU'}</option><option value="p1_p2">2 jogadores (P1 x P2)</option></select>` : ''}
      <button class="btn primario" data-acao="jogar" data-id="${j.id}">Iniciar partida</button>
      <button class="btn" data-acao="manual" data-id="${j.id}">Lançar placar</button>
      <button class="link" data-acao="preparar" data-id="${j.id}">só gravar partida.json</button>`
    : `
      <button class="btn primario" data-acao="simular" data-id="${j.id}">Simular</button>
      ${temEstado('cpu_cpu') ? `<button class="btn" data-acao="assistir" data-id="${j.id}">Assistir CPU x CPU</button>` : ''}
      ${outrosPendentes > 1 ? `<button class="btn" data-acao="simular-rodada" data-rodada="${j.rodada}">Simular os ${outrosPendentes} jogos da rodada</button>` : ''}
      <button class="btn" data-acao="manual" data-id="${j.id}">Lançar placar</button>
      <button class="link" data-acao="jogar" data-id="${j.id}">jogar no emulador</button>`;

  return `<section class="cartao">
    <div class="prox-cab"><h2>Rodada ${j.rodada}</h2>${status}</div>
    <div class="placar">
      <div class="time">${escudo(casa)}<span class="nome">${esc(casa.nome)}</span><span class="lado">Casa</span></div>
      ${marcador}
      <div class="time">${escudo(vis)}<span class="nome">${esc(vis.nome)}</span><span class="lado">Visitante</span></div>
    </div>
    ${pen}${gols}${alerta}
    ${vivo ? linhaUsados(casa, vis, j.uniformes) : (prepararUniformes('j:' + j.id, j.casa, j.visitante), blocoUniformes(casa, vis))}
    <div class="acoes">${botoes}</div>
    ${manualAberto === j.id ? formManual(j) : ''}
    ${vivo ? '' : dicaJogo(j, meu, casa, vis)}
  </section>`;
}

function dicaJogo(j, meu, casa, vis) {
  const c = E.campeonato;
  if (meu) {
    const eu = timeDe(c.meuTime);
    const fora = j.visitante === c.meuTime;
    if (fora && temEstado('cpu_p1'))
      return `<div class="dica">Você controla o <b>${esc(eu.nome)}</b> como visitante (estado CPU x P1): ele entra na vaga da Holanda, à direita do placar.</div>`;
    return `<div class="dica">Você controla o <b>${esc(eu.nome)}</b> no controle 1. No emulador ele entra na vaga do Brasil (lado esquerdo do placar)${fora ? ', mesmo jogando fora de casa (falta o estado CPU x P1): o app desinverte o placar na tabela' : ''}.</div>`;
  }
  if (c.meuTime) return `<div class="dica">Jogo sem o seu time. A simulação usa os atributos dos titulares, com uma pequena vantagem para o mandante.</div>`;
  return `<div class="dica">Iniciar grava o <code>data/partida.json</code> e abre o emulador. ${esc(casa.nome)} entra no lugar do Brasil (controle 1) e ${esc(vis.nome)} no da Holanda.</div>`;
}

const temEstado = id => ((E.config && E.config.estados) || []).includes(id);

function listaGols(gols) {
  if (!gols || !gols.length) return '';
  return `<ul class="gols">${gols.map(g => {
    const min = g.minuto != null ? `<span class="min">${g.minuto}'</span>` : '';
    const txt = `<b>${esc(g.nome)}</b>${g.contra ? ' (contra)' : ''}${g.assistencia ? ` <small>(${esc(g.assistencia)})</small>` : ''}`;
    return g.lado === 'visitante' ? `<li class="visitante">${txt}${min}</li>` : `<li class="casa">${min}${txt}</li>`;
  }).join('')}</ul>`;
}

function formManual(j) {
  return `<form class="manual" data-form="manual" data-id="${j.id}">
    <span>${esc(timeDe(j.casa).sigla)}</span>
    <input type="number" min="0" max="99" name="casa" value="${j.placar ? j.placar.casa : 0}" required>
    <span>x</span>
    <input type="number" min="0" max="99" name="visitante" value="${j.placar ? j.placar.visitante : 0}" required>
    <span>${esc(timeDe(j.visitante).sigla)}</span>
    <button class="btn primario peq" type="submit">Salvar</button>
    <button class="link" type="button" data-acao="fechar-manual">cancelar</button>
  </form>`;
}

function tabela() {
  const linhas = E.classificacao.map(l => `
    <tr class="${l.pos === 1 && l.j > 0 ? 'lider' : ''} ${l.id === E.campeonato.meuTime ? 'meu' : ''}">
      <td class="pos">${l.pos}</td>
      <td class="esq"><div class="time-cel">${escudo(timeDe(l.id), true)}${esc(l.nome)}</div></td>
      <td class="pts">${l.pts}</td><td>${l.j}</td><td>${l.v}</td><td>${l.e}</td><td>${l.d}</td>
      <td>${l.gp}</td><td>${l.gc}</td><td>${l.sg > 0 ? '+' : ''}${l.sg}</td>
      <td><span class="forma">${l.ultimos.map(u => `<i class="${u}">${u}</i>`).join('')}</span></td>
    </tr>`).join('');
  return `<section class="cartao"><h2>Classificação</h2>
    <table>
      <thead><tr><th>#</th><th class="esq">Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>Últimos</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="dica">Desempate: pontos, vitórias, saldo de gols, gols pró. Disputa de pênaltis não conta na tabela.</div>
  </section>`;
}

function calendario() {
  const c = E.campeonato;
  const rodadas = [...new Set(c.jogos.map(j => j.rodada))];
  return `<div class="rodadas">${rodadas.map(r => {
    const jogos = c.jogos.filter(j => j.rodada === r);
    const turno = c.idaVolta ? (r <= rodadas.length / 2 ? 'Turno' : 'Returno') : '';
    return `<div class="rodada"><h3><span>Rodada ${r}</span><span>${turno}</span></h3>${jogos.map(jogoLinha).join('')}</div>`;
  }).join('')}</div>`;
}

function jogoLinha(j) {
  const casa = timeDe(j.casa), vis = timeDe(j.visitante);
  let meio = `<span class="meio pend">x</span>`;
  let cv = '', vv = '';
  if (j.status === 'encerrado') {
    const origem = { manual: 'Placar lançado à mão', simulado: 'Jogo simulado', jogo: 'Placar lido do jogo' }[j.origem] || '';
    meio = `<span class="meio" title="${origem}">${j.placar.casa} x ${j.placar.visitante}</span>`;
    if (j.placar.casa > j.placar.visitante) cv = 'vencedor';
    if (j.placar.casa < j.placar.visitante) vv = 'vencedor';
  } else if (j.status === 'em_andamento') {
    meio = `<span class="meio vivo">ao vivo</span>`;
  }
  let acoes = '';
  if (j.status === 'encerrado') {
    const n = (j.gols || []).length;
    const tag = j.origem === 'simulado' ? 'simulado' : j.origem === 'manual' ? 'placar manual' : '';
    acoes = `<div class="jogo-acoes">${[tag, n ? `${n} gol${n > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
      <button class="link" data-acao="reabrir" data-id="${j.id}">reabrir</button></div>`;
  } else if (j.status === 'agendado' && j.id !== E.proximoJogoId) {
    acoes = E.campeonato.meuTime && !ehMeu(j)
      ? `<div class="jogo-acoes"><button class="link" data-acao="simular" data-id="${j.id}">simular</button></div>`
      : `<div class="jogo-acoes"><button class="link" data-acao="jogar-este" data-id="${j.id}">jogar agora</button></div>`;
  }
  const meuNome = id => (id === E.campeonato.meuTime ? ' meu' : '');
  return `<div class="jogo ${j.id === E.proximoJogoId ? 'proximo' : ''} ${ehMeu(j) ? 'jogo-meu' : ''}">
    <div class="c ${cv}${meuNome(j.casa)}">${esc(casa.nome)} ${escudo(casa, true)}</div>
    ${meio}
    <div class="v ${vv}${meuNome(j.visitante)}">${escudo(vis, true)} ${esc(vis.nome)}</div>
    ${acoes}
  </div>`;
}

function artilharia() {
  const a = E.artilharia;
  if (!a.length) return `<div class="vazio-msg">Ainda não há gols registrados com autor. Os placares lançados à mão não entram aqui.</div>`;
  return `<ul class="artilharia">${a.map((x, i) => `
    <li><span>${i + 1}. <b>${esc(x.nome)}</b> <small style="color:var(--suave)">${esc(timeDe(x.time).nome)}</small></span><span class="n">${x.gols}</span></li>`).join('')}</ul>`;
}

function renderSetup() {
  $('#titulo-camp').textContent = '';
  const times = E.timesDisponiveis;
  if (!selecao.size && times.length) times.slice(0, 4).forEach(t => selecao.add(t.id));
  if (meuEscolhido && !selecao.has(meuEscolhido)) meuEscolhido = null;
  const cards = times.map(t => `
    <label class="time-op ${selecao.has(t.id) ? 'sel' : ''}">
      <input type="checkbox" data-time="${esc(t.id)}" ${selecao.has(t.id) ? 'checked' : ''}>
      ${escudo(t)}
      <span>${esc(t.nome)}<small>${esc(t.arquivo.split('/').pop())} · ${t.jogadores} jogadores</small></span>
    </label>`).join('');
  $('#app').innerHTML = `
    <section class="cartao setup">
      <h1>Novo campeonato</h1>
      <p>Pontos corridos. A ordem dos jogos e o mando são sorteados.</p>
      <div class="campo"><label>Nome</label><input type="text" id="nome-camp" value="Torneio WE2002" maxlength="60"></div>
      <div class="campo"><label>Times (${selecao.size} escolhidos · lidos de <code>${esc(E.pastaTimes)}</code>)</label></div>
      ${times.length ? `<div class="times-sel">${cards}</div>` : `<div class="alerta">Nenhum time encontrado em data/times. Confira o "raizProjeto" no config.json.</div>`}
      <div class="campo"><label>Seu time (você joga as partidas dele no controle 1; as outras são simuladas)</label>
        <div class="meus">${[...selecao].map(id => times.find(t => t.id === id)).filter(Boolean).map(t => `
          <button class="meu-op ${meuEscolhido === t.id ? 'sel' : ''}" data-acao="escolher-meu" data-time="${esc(t.id)}">${escudo(t, true)} ${esc(t.nome)}</button>`).join('')}
          <button class="meu-op ${meuEscolhido === null ? 'sel' : ''}" data-acao="escolher-meu" data-time="">Nenhum</button>
        </div></div>
      <label class="check"><input type="checkbox" id="ida-volta" checked> Turno e returno (cada time joga em casa e fora contra cada adversário)</label>
      <div class="acoes">
        <button class="btn primario" data-acao="criar" ${selecao.size < 2 ? 'disabled' : ''}>Criar campeonato</button>
        ${E.campeonato ? `<button class="btn fantasma" data-acao="voltar">Voltar ao campeonato atual</button>` : ''}
      </div>
      ${E.campeonato ? `<div class="dica">O campeonato atual fica guardado numa cópia em data/ antes de ser substituído.</div>` : ''}
    </section>`;
}



// ---------------- uniformes ----------------
const uniInfo = id => ((E.timesDisponiveis || []).find(t => t.id === id) || {}).uniformes || {};
const ROT_UNI = { auto: 'Auto', titular: 'Titular', reserva: 'Reserva' };

function miniKit(k, peq = false) {
  if (!k) return `<span class="mini-kit vazio${peq ? ' peq' : ''}" title="sem uniforme">–</span>`;
  const camisa = k.listras && k.listras.length
    ? `repeating-linear-gradient(90deg, ${k.listras.map((c, i) => `${c} ${i * 5}px ${(i + 1) * 5}px`).join(', ')})`
    : (k.camisa || '#777');
  return `<span class="mini-kit${peq ? ' peq' : ''}">
    <span class="mk-camisa" style="background:${esc(camisa)};border-color:${esc(k.detalhe || '#555')};color:${esc(k.numero || '#fff')}">${peq ? '' : '10'}</span>
    <span class="mk-calcao" style="background:${esc(k.calcao || '#555')}"></span>
    <span class="mk-meiao" style="background:${esc(k.meiao || '#555')}"></span></span>`;
}

function prepararUniformes(chave, casaId, visId) {
  if (uniSel.chave !== chave) uniSel = { chave, casaId, visId, casa: 'auto', visitante: 'auto', previa: null, pedindo: false };
  if (!uniSel.previa && !uniSel.pedindo) atualizarPreviaUniformes();
}
async function atualizarPreviaUniformes() {
  const k = uniSel.chave;
  uniSel.pedindo = true;
  let r;
  try { r = await we.uniformesPrevia({ casaId: uniSel.casaId, visitanteId: uniSel.visId, casa: uniSel.casa, visitante: uniSel.visitante }); }
  catch (err) { r = { erro: err.message }; }
  if (uniSel.chave !== k) return;
  uniSel.previa = r; uniSel.pedindo = false;
  if (tela !== 'times') render();
}
const pedidosUniforme = chave => (uniSel.chave === chave ? { casa: uniSel.casa, visitante: uniSel.visitante } : null);

// Escolha antes do jogo: Auto / Titular / Reserva para cada time (mando real).
function blocoUniformes(casa, vis) {
  const p = uniSel.previa && !uniSel.previa.erro ? uniSel.previa : null;
  const lado = (l, t) => {
    const u = uniInfo(t.id), ped = uniSel[l];
    const usado = p ? p[l] : ped === 'reserva' ? 'reserva' : 'titular';
    const ops = ['auto', 'titular', 'reserva'].map(o => `<button class="seg ${ped === o ? 'sel' : ''}" data-acao="uni" data-lado="${l}" data-u="${o}"
        ${o === 'reserva' && !u.reserva ? 'disabled title="Este time não tem uniforme reserva (crie no editor de times)"' : ''}>${ROT_UNI[o]}</button>`).join('');
    return `<div class="uni-lado">${miniKit(usado === 'reserva' ? u.reserva : u.titular)}
      <div><div class="uni-nome">${esc(t.nome)} <small>${usado === 'reserva' ? 'reserva' : 'titular'}${ped === 'auto' ? ' · auto' : ''}</small></div>
      <div class="segs">${ops}</div></div></div>`;
  };
  return `<div class="uniformes"><span class="rot">Uniformes</span>${lado('casa', casa)}${lado('visitante', vis)}</div>
    ${p && p.aviso ? `<div class="alerta">As camisas dos dois times ficam parecidas: troque um dos uniformes.</div>` : ''}
    <div class="dica">Auto: o visitante veste a reserva quando a camisa dele se confunde com a do mandante.</div>`;
}

// Uniformes já usados num jogo em andamento.
function linhaUsados(casa, vis, usados) {
  if (!usados) return '';
  const u = (t, x) => { const k = uniInfo(t.id); return `${miniKit(x === 'reserva' ? k.reserva : k.titular, true)} ${esc(t.nome)} <small>${x}</small>`; };
  return `<div class="usados">${u(casa, usados.casa)}<span class="sep-x">x</span>${u(vis, usados.visitante)}</div>`;
}

// ---------------- amistoso ----------------
const CENARIOS = [
  { id: 'p1_cpu', titulo: 'P1 x CPU', quem: t => `Você joga com o ${t.casa}` },
  { id: 'cpu_cpu', titulo: 'CPU x CPU', quem: () => 'Você só assiste' },
  { id: 'cpu_p1', titulo: 'CPU x P1', quem: t => `Você joga com o ${t.visitante}` },
];

function renderAmistoso() {
  $('#titulo-camp').innerHTML = `<strong>Amistoso</strong> · não conta para o campeonato`;
  const a = E.amistoso;
  if (a && a.status === 'em_andamento') { $('#app').innerHTML = `<section class="cartao amistoso">${amistosoVivo(a)}</section>`; return; }

  const times = E.timesDisponiveis;
  const acha = id => times.find(t => t.id === id);
  if (!acha(amForm.casa)) amForm.casa = (E.campeonato && acha(E.campeonato.meuTime) && E.campeonato.meuTime) || (times[0] && times[0].id) || null;
  if (!acha(amForm.visitante) || amForm.visitante === amForm.casa)
    amForm.visitante = (times.find(t => t.id !== amForm.casa) || {}).id || null;
  if (!temEstado(amForm.cenario)) amForm.cenario = (CENARIOS.find(x => temEstado(x.id)) || CENARIOS[0]).id;
  if (!amForm.emulador) amForm.emulador = E.config.emuladorPadrao;

  if (times.length < 2) {
    $('#app').innerHTML = `<section class="cartao amistoso"><h1>Amistoso</h1><div class="alerta">É preciso ter pelo menos dois times em <code>${esc(E.pastaTimes)}</code>.</div></section>`;
    return;
  }
  const casa = acha(amForm.casa), vis = acha(amForm.visitante);
  const opcoes = sel => times.map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(t.nome)}</option>`).join('');
  const nomes = { casa: casa.nome, visitante: vis.nome };
  const cenarios = CENARIOS.map(x => {
    const ok = temEstado(x.id);
    return `<button class="cenario ${amForm.cenario === x.id ? 'sel' : ''}" data-acao="am-cenario" data-c="${x.id}" ${ok ? '' : 'disabled title="Falta o estado base deste cenário em states/"'}>
      <b>${x.titulo}</b><small>${ok ? esc(x.quem(nomes)) : 'estado base não encontrado'}</small></button>`;
  }).join('');
  const soPcsx = amForm.cenario !== 'p1_cpu';
  const emuls = Object.entries(E.config.emuladores)
    .map(([k, v]) => `<option value="${esc(k)}" ${k === (soPcsx ? 'pcsx' : amForm.emulador) ? 'selected' : ''}>${esc(v.nome)}</option>`).join('');
  const iguais = amForm.casa === amForm.visitante;

  $('#app').innerHTML = `
    <section class="cartao amistoso">
      <h1>Amistoso</h1>
      <p>Escolha os times e quem controla cada lado. O time da casa entra na vaga do Brasil (esquerda do placar) e o visitante na da Holanda.</p>
      <div class="placar">
        <div class="time">${escudo(casa)}<select id="am-casa" class="sel-time">${opcoes(amForm.casa)}</select><span class="lado">Casa</span></div>
        <button class="btn fantasma trocar" data-acao="am-trocar" title="Inverter mando">⇄</button>
        <div class="time">${escudo(vis)}<select id="am-visitante" class="sel-time">${opcoes(amForm.visitante)}</select><span class="lado">Visitante</span></div>
      </div>
      ${iguais ? `<div class="alerta">Escolha dois times diferentes.</div>` : ''}
      ${(prepararUniformes(`am:${amForm.casa}:${amForm.visitante}`, amForm.casa, amForm.visitante), iguais ? '' : blocoUniformes(casa, vis))}
      <div class="campo"><label>Cenário</label><div class="cenarios">${cenarios}</div></div>
      <label class="check"><input type="checkbox" id="am-mata" ${amForm.mataMata ? 'checked' : ''}> Se empatar, decide na prorrogação e nos pênaltis</label>
      <div class="acoes">
        <select id="am-emulador" ${soPcsx ? 'disabled title="CPU x P1 e CPU x CPU usam os estados base da ponte, só no PCSX-Redux"' : ''}>${emuls}</select>
        <button class="btn primario grande" data-acao="am-iniciar" ${iguais ? 'disabled' : ''}>Iniciar</button>
      </div>
      ${soPcsx ? `<div class="dica">Este cenário abre sempre no PCSX-Redux (os estados base da ponte só existem nele).</div>` : ''}
    </section>
    ${a && a.status === 'encerrado' && a.placar ? ultimoAmistoso(a) : ''}`;
}

function amistosoVivo(a) {
  const r = a.aoVivo;
  const valido = r && r.conferencia && r.conferencia.ok;
  const cen = CENARIOS.find(x => x.id === a.cenario);
  let marcador = `<div class="marcador vazio">– x –</div>`, gols = '', pen = '', alerta = '';
  if (valido) {
    marcador = `<div class="marcador">${r.golsCasa} x ${r.golsVisitante}</div>`;
    gols = listaGols(r.gols);
    if (r.penaltis) pen = `<div class="pen">Pênaltis ${r.penaltis.casa ?? 0} x ${r.penaltis.visitante ?? 0}</div>`;
  } else if (r && !r.conferencia.ok) {
    alerta = `<div class="alerta">Aguardando o resultado deste amistoso (${esc(r.conferencia.motivo)}).</div>`;
  } else {
    alerta = `<div class="alerta">Aguardando o <code>data/resultado.json</code>. Ele aparece aqui sozinho quando a ponte gravar.</div>`;
  }
  const status = valido && r.final ? `<span class="status fim">Fim de jogo</span>` : `<span class="status vivo">${valido ? 'Parcial' : 'Em andamento'}</span>`;
  return `
    <div class="prox-cab"><h2>Amistoso · ${esc(cen ? cen.titulo : a.cenario)}</h2>${status}</div>
    <div class="placar">
      <div class="time">${escudo(a.casa)}<span class="nome">${esc(a.casa.nome)}</span><span class="lado">Casa${a.cenario === 'p1_cpu' ? ' · P1' : ' · CPU'}</span></div>
      ${marcador}
      <div class="time">${escudo(a.visitante)}<span class="nome">${esc(a.visitante.nome)}</span><span class="lado">Visitante${a.cenario === 'cpu_p1' ? ' · P1' : ' · CPU'}</span></div>
    </div>
    ${pen}${gols}${alerta}
    ${linhaUsados(a.casa, a.visitante, a.uniformes)}
    <div class="acoes">
      <button class="btn primario" data-acao="am-encerrar" ${valido ? '' : 'disabled'}>Encerrar amistoso</button>
      <button class="btn fantasma perigo" data-acao="am-cancelar">Cancelar</button>
    </div>
    <div class="dica">${a.modo === 'mata_mata' ? 'Empate vai para prorrogação e pênaltis.' : 'Empate vale: o resultado é o dos 90 minutos.'} No apito final o amistoso encerra sozinho.</div>`;
}

function ultimoAmistoso(a) {
  return `<section class="cartao amistoso">
    <h2>Último amistoso</h2>
    <div class="placar">
      <div class="time">${escudo(a.casa)}<span class="nome">${esc(a.casa.nome)}</span></div>
      <div class="marcador">${a.placar.casa} x ${a.placar.visitante}</div>
      <div class="time">${escudo(a.visitante)}<span class="nome">${esc(a.visitante.nome)}</span></div>
    </div>
    ${a.penaltis ? `<div class="pen">Pênaltis ${a.penaltis.casa ?? 0} x ${a.penaltis.visitante ?? 0}</div>` : ''}
    ${listaGols(a.gols)}
  </section>`;
}


// ---------------- editor de times ----------------
let R = null;            // recursos: formações, bandeiras, desenhos de kit, limites, modelo
let ed = null;           // time aberto: { id, novo, idManual, dados, sujo }
let edCarregando = false;
const semAcentoJs = x => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const asciiJs = x => semAcentoJs(x).replace(/[^ -~]/g, '');
const slug = x => semAcentoJs(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const CONDICOES = { 1: '1 · pior', 2: '2', 3: '3', 4: '4', 5: '5 · melhor' };
const ROT_PE = { destro: 'destro', canhoto: 'canhoto', ambidestro: 'ambid.' };
const NCOLS = () => 11 + R.atributos.length;

function podeSairDoEditor() {
  if (!ed || !ed.sujo) return true;
  if (!confirm('Há alterações não salvas neste time. Descartar?')) return false;
  ed = null;
  return true;
}

async function abrirTime(id) {
  edCarregando = true;
  try { const r = await we.timeLer({ id }); ed = { id: r.id, novo: false, dados: r.dados, sujo: false }; }
  catch (err) { aviso(err.message); }
  edCarregando = false;
  render();
}

async function salvarTime() {
  try {
    const r = await we.timeSalvar({ id: ed.id, novo: ed.novo, dados: ed.dados });
    E = r.estado;
    const lido = await we.timeLer({ id: r.id });
    ed = { id: r.id, novo: false, dados: lido.dados, sujo: false };
    render();
    aviso(r.avisos.length ? `Time salvo. Atenção: ${r.avisos.slice(0, 4).join(' · ')}` : 'Time salvo.', true);
  } catch (err) { aviso(err.message); }
}

const imgKits = {};
function carregarImagensKits() {
  document.querySelectorAll('img[data-arte]').forEach(img => {
    const a = img.dataset.arte;
    if (imgKits[a]) { img.src = imgKits[a]; return; }
    we.kitImagem({ arte: a }).then(url => { if (url) { imgKits[a] = url; img.src = url; } else img.replaceWith(Object.assign(document.createElement('span'), { className: 'dica', textContent: 'arquivo não encontrado' })); }).catch(() => {});
  });
}

function renderTimes() {
  $('#titulo-camp').innerHTML = `<strong>Editor de times</strong> · <code>${esc(E.pastaTimes)}</code>`;
  if (!R) {
    $('#app').innerHTML = `<div class="vazio-msg">Carregando…</div>`;
    we.timesRecursos().then(r => { R = r; render(); }).catch(err => aviso(err.message));
    return;
  }
  const times = E.timesDisponiveis;
  if (!ed && !edCarregando && times.length) { abrirTime(times[0].id); return; }
  const lista = times.map(t => `
    <button class="item-time ${ed && !ed.novo && ed.id === t.id ? 'sel' : ''}" data-acao="ed-abrir" data-id="${esc(t.id)}">
      ${escudo(t, true)}<span>${esc(t.nome)}<small>${esc(t.id)}.json · ${t.jogadores} jog.</small></span></button>`).join('');
  $('#app').innerHTML = `<div class="editor">
    <aside class="cartao lista-times">
      <h2>Times</h2>
      ${lista || '<div class="vazio-msg">Nenhum time ainda.</div>'}
      ${ed && ed.novo ? `<button class="item-time sel">${escudo({ sigla: '', cor: (ed.dados.kit?.design?.camisa) }, true)}<span>${esc(ed.dados.nome || 'Novo time')}<small>novo · não salvo</small></span></button>` : ''}
      <div class="acoes col">
        <button class="btn primario" data-acao="ed-novo">Novo time</button>
        ${ed && !ed.novo ? `<button class="btn" data-acao="ed-duplicar">Duplicar este</button>` : ''}
      </div>
    </aside>
    <div class="ed-corpo">${ed ? editorTime() : `<section class="cartao"><div class="vazio-msg">Escolha um time ou crie um novo.</div></section>`}</div>
  </div>`;
  carregarImagensKits();
}

function editorTime() {
  const d = ed.dados, k = d.kit || {}, ds = k.design || {};
  const opcoes = (lista, sel, vazio) => (vazio != null ? `<option value="">${esc(vazio)}</option>` : '') +
    (sel && !lista.includes(sel) ? [sel, ...lista] : lista)
      .map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(String(v).split('/').pop())}</option>`).join('');
  const campo = (rot, html, cls = '') => `<div class="campo ${cls}"><label>${rot}</label>${html}</div>`;
  const cor = (cam, rot, v) => `<label class="cor"><input type="color" data-t="${cam}" value="${esc(v || '#888888')}"><span>${rot}</span></label>`;
  const L = R.limites;
  const cartaoKit = (chave, rotulo) => {
    const kk = d[chave];
    if (!kk) return `<div class="kit-ed vazio"><h3>${rotulo}</h3><p class="dica">Sem uniforme reserva: no "auto", o time joga sempre de titular.</p>
      <button class="btn" data-acao="ed-kit-add">Adicionar uniforme reserva</button></div>`;
    const dd = kk.design || {};
    const lv = dd.listras_verticais;
    const resumo = { camisa: dd.camisa, detalhe: dd.detalhe, calcao: dd.calcao, meiao: dd.meiao, numero: kk.cor_numero, listras: lv && lv.cores };
    const u = chave === 'kit' ? 'titular' : 'reserva';
    return `<div class="kit-ed">
      <div class="kit-cab"><h3>${rotulo}</h3>${miniKit(resumo)}${chave === 'kit_reserva' ? `<button class="link" data-acao="ed-kit-remover">remover</button>` : ''}</div>
      <div class="kit-corpo">
        <div class="kit-img">${kk.arte ? `<img data-arte="${esc(kk.arte)}" alt="${esc(kk.arte)}">` : '<span class="dica">sem desenho</span>'}</div>
        <div class="kit-campos">
          <label class="campo"><span>Desenho</span><select data-t="${chave}.arte">${opcoes(R.artes, kk.arte, 'nenhum (uniforme base do lado)')}</select></label>
          <div class="cores">
            ${cor(`${chave}.design.camisa`, 'Camisa', dd.camisa)}${cor(`${chave}.design.detalhe`, 'Detalhe', dd.detalhe)}
            ${cor(`${chave}.design.calcao`, 'Calção', dd.calcao)}${cor(`${chave}.design.meiao`, 'Meião', dd.meiao)}
            ${cor(`${chave}.cor_numero`, 'Número', kk.cor_numero)}
          </div>
          ${lv && Array.isArray(lv.cores) ? `<div class="cores"><span class="rot">Listras</span>${lv.cores.map((c, i) => cor(`${chave}.design.listras_verticais.cores.${i}`, `${i + 1}ª`, c)).join('')}</div>` : ''}
          ${dd.faixas && dd.faixas.length ? `<div class="dica">${dd.faixas.length} faixas horizontais (mantidas; posição só no JSON).</div>` : ''}
          <button class="btn peq" data-acao="ed-kit-desenhar" data-u="${u}" ${ed.novo || ed.sujo ? 'disabled title="Salve o time antes de redesenhar"' : ''}>Redesenhar pelas cores</button>
        </div>
      </div></div>`;
  };
  return `
  <section class="cartao">
    <div class="ed-cab">
      ${escudo({ sigla: d.sigla || '', cor: ds.camisa, cor2: k.cor_numero || ds.detalhe })}
      <div class="ed-tit"><h1 id="ed-titulo">${esc(d.nome || 'Novo time')}</h1>
        <small>${ed.novo ? 'novo time (ainda não salvo)' : `data/times/${esc(ed.id)}.json`}</small></div>
      <span class="sujo" id="ed-sujo" ${ed.sujo ? '' : 'hidden'}>alterações não salvas</span>
    </div>
    <div class="ed-grade">
      ${campo('Nome', `<input type="text" data-t="nome" maxlength="${L.nomeTime}" value="${esc(d.nome)}">`, 'largo')}
      ${ed.novo ? campo('Arquivo', `<div class="arq"><span>data/times/</span><input type="text" id="ed-id" maxlength="40" value="${esc(ed.id)}"><span>.json</span></div>`) : ''}
      ${campo(`Nome no placar (até ${L.nomeTela})`, `<input type="text" data-t="nome_tela" maxlength="${L.nomeTela}" value="${esc(d.nome_tela || '')}" placeholder="${esc(asciiJs(d.nome || '').toUpperCase().slice(0, L.nomeTela))}">`)}
      ${campo('Sigla', `<input type="text" data-t="sigla" maxlength="${L.sigla}" value="${esc(d.sigla || '')}" class="curto">`)}
      ${campo('Formação', `<select data-t="formacao">${opcoes(R.formacoes, d.formacao)}</select>`)}
      ${campo('Bandeira / escudo', `<select data-t="bandeira">${opcoes(R.bandeiras, d.bandeira, 'original do jogo')}</select>`)}
      ${campo('Ajuste da bandeira', `<select data-t="bandeira_ajuste">${opcoes(R.ajustes, d.bandeira_ajuste || 'esticar')}</select>`)}
    </div>
    <h2 class="sub">Uniformes</h2>
    <div class="kits-ed">${cartaoKit('kit', 'Titular')}${cartaoKit('kit_reserva', 'Reserva')}</div>
    <div class="dica">No jogo vale o <b>desenho</b> (PNG em <code>kits/desenhos/</code>). As cores servem para redesenhá-lo,
      para o escudo do app e para a escolha automática do uniforme. Depois de mudar as cores: salve e clique em <b>Redesenhar pelas cores</b>.</div>
  </section>

  <section class="cartao">
    <div class="prox-cab"><h2>Jogadores (${d.jogadores.length})</h2>
      <span class="dica">Vaga 0 = goleiro · 1-10 titulares na ordem da formação · 11-21 reservas · ▲▼ trocam a vaga · <b>Visual</b> abre a aparência</span></div>
    <div class="tabela-jog"><table class="jog">
      <thead><tr><th>Vaga</th><th></th><th class="esq">Nome</th><th title="Posição (entre parênteses, como o jogo grava)">Pos.</th><th>Nº</th><th title="Altura (cm)">Alt.</th><th>Idade</th><th>Pé</th><th title="Condição física na partida">Cond.</th>
        ${R.atributos.map(([c, n]) => `<th title="${esc(n)}">${c}</th>`).join('')}<th title="Média dos atributos">Méd.</th><th></th></tr></thead>
      <tbody>${d.jogadores.map((j, i) => linhaJogador(j, i, d.jogadores.length)).join('')}</tbody>
    </table></div>
  </section>

  <div class="barra-salvar">
    <button class="btn primario" data-acao="ed-salvar">${ed.novo ? 'Criar time' : 'Salvar'}</button>
    <button class="btn" data-acao="ed-descartar" id="ed-descartar" ${ed.sujo ? '' : 'disabled'}>Descartar alterações</button>
    ${ed.novo ? '' : `<button class="btn fantasma perigo" data-acao="ed-excluir">Excluir time</button>`}
  </div>`;
}

const mediaJog = j => {
  const vs = R.atributos.map(([k]) => Number((j.atributos || {})[k])).filter(Number.isFinite);
  return vs.length ? (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) : '–';
};

function linhaJogador(j, i, n) {
  const sep = i === 11 ? `<tr class="sep"><td colspan="${NCOLS()}">Reservas</td></tr>` : '';
  const pos = R.posicoes.includes(j.posicao) || !j.posicao ? R.posicoes : [j.posicao, ...R.posicoes];
  const aberto = ed.abertos && ed.abertos.has(i);
  const temVisual = j.aparencia && Object.keys(j.aparencia).length;
  const num = (k, v, [a, b]) => `<input class="num" type="number" min="${a}" max="${b}" data-j="${i}" data-k="${k}" value="${esc(v ?? '')}">`;
  const at = R.atributos.map(([k, nome]) => {
    const v = (j.atributos || {})[k];
    const opc = (R.opcionais || []).includes(k);
    return `<td><input class="at ${v >= 17 ? 'alto' : ''}${opc ? ' opc' : ''}" type="number" min="12" max="19" title="${esc(nome)}${opc ? ' · vazio = mantém o do jogo' : ''}" data-j="${i}" data-k="atributos.${k}" value="${esc(v ?? (opc ? '' : 15))}" ${opc ? 'placeholder="–"' : ''}></td>`;
  }).join('');
  return sep + `<tr class="${i <= 10 ? 'tit' : ''}">
    <td class="vaga">${i}</td>
    <td class="mover"><button class="link" data-acao="ed-subir" data-i="${i}" ${i ? '' : 'disabled'} title="Subir">▲</button><button class="link" data-acao="ed-descer" data-i="${i}" ${i < n - 1 ? '' : 'disabled'} title="Descer">▼</button></td>
    <td class="esq"><input class="nome-j" type="text" maxlength="${R.limites.nome}" data-j="${i}" data-k="nome" value="${esc(j.nome)}"></td>
    <td><select data-j="${i}" data-k="posicao">${pos.map(p => `<option value="${esc(p)}" ${p === j.posicao ? 'selected' : ''}>${esc(p)}${R.posJogo[p] && R.posJogo[p] !== p ? ` (${R.posJogo[p]})` : ''}</option>`).join('')}</select></td>
    <td>${num('camisa', j.camisa, R.limites.camisa)}</td>
    <td>${num('altura', j.altura, R.limites.altura)}</td>
    <td><input class="num" type="number" min="15" max="46" data-j="${i}" data-k="idade" value="${esc(j.idade ?? '')}" placeholder="–" title="Vazio = mantém a do jogo"></td>
    <td><select data-j="${i}" data-k="pe"><option value="">–</option>${R.pes.map(p => `<option value="${p}" ${p === j.pe ? 'selected' : ''}>${ROT_PE[p] || p}</option>`).join('')}</select></td>
    <td><select data-j="${i}" data-k="condicao"><option value="">sorteio</option>${Object.entries(CONDICOES).map(([v, t]) => `<option value="${v}" ${Number(v) === j.condicao ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
    ${at}
    <td class="media" id="med-${i}">${mediaJog(j)}</td>
    <td><button class="btn peq visual ${aberto ? 'ativo' : ''} ${temVisual ? 'tem' : ''}" data-acao="ed-visual" data-i="${i}" title="Aparência, outside">Visual</button></td>
  </tr>${aberto ? linhaVisual(j, i) : ''}`;
}

// Aparência do jogador (menu de edição do jogo). Vazio = mantém a do jogador original da vaga.
function linhaVisual(j, i) {
  const a = j.aparencia || {};
  const sel = (k, def) => `<label><span>${esc(def.rotulo)}</span><select data-j="${i}" data-k="aparencia.${k}">
      <option value="">–</option>${def.valores.map(v => `<option value="${esc(v)}" ${String(v) === String(a[k] ?? '') ? 'selected' : ''}>${esc(v)}${def.dicas[v] ? ` · ${esc(def.dicas[v])}` : ''}</option>`).join('')}
    </select></label>`;
  const out = j.outside === true ? 'true' : j.outside === false ? 'false' : '';
  return `<tr class="det"><td colspan="${NCOLS()}"><div class="aparencia">
    ${Object.entries(R.aparencia).map(([k, def]) => sel(k, def)).join('')}
    <label><span>Outside</span><select data-j="${i}" data-k="outside">
      <option value="" ${out === '' ? 'selected' : ''}>–</option><option value="true" ${out === 'true' ? 'selected' : ''}>sim</option><option value="false" ${out === 'false' ? 'selected' : ''}>não</option></select></label>
    <button class="link" data-acao="ed-visual-padrao" data-i="${i}">usar o padrão</button>
    <span class="dica">"–" mantém o do jogador original da vaga. Cores de C a F quase não aparecem na base: confira no jogo.</span>
  </div></td></tr>`;
}

function definirCaminho(obj, cam, v) {
  const ps = cam.split('.');
  let o = obj;
  for (const p of ps.slice(0, -1)) { if (!o[p] || typeof o[p] !== 'object') o[p] = {}; o = o[p]; }
  o[ps[ps.length - 1]] = v;
}

// Atualiza ed.dados a partir de um campo do editor, sem redesenhar (não perde o foco).
function campoEditor(t) {
  if (!ed || tela !== 'times') return false;
  if (t.id === 'ed-id') { ed.id = t.value.trim().toLowerCase(); ed.idManual = true; marcarSujo(); return true; }
  if (t.dataset.t) {
    const c = t.dataset.t;
    const v = ['bandeira', 'kit.arte', 'kit_reserva.arte', 'nome_tela'].includes(c) ? (t.value || null) : t.value;
    definirCaminho(ed.dados, c, v);
    if (c === 'nome') {
      $('#ed-titulo').textContent = v || 'Novo time';
      if (ed.novo && !ed.idManual) { ed.id = slug(v) || 'novo-time'; const el = $('#ed-id'); if (el) el.value = ed.id; }
    }
    marcarSujo();
    return true;
  }
  if (t.dataset.j != null && t.dataset.k) {
    const j = ed.dados.jogadores[Number(t.dataset.j)], k = t.dataset.k;
    let v = t.value;
    if (t.type === 'number' || k === 'condicao' || k === 'aparencia.pele') v = v === '' ? null : Number(v);
    else if (k === 'outside') v = v === '' ? null : v === 'true';
    else if (v === '' && k !== 'nome') v = null;
    definirCaminho(j, k, v);
    if (k.startsWith('atributos.')) {
      t.classList.toggle('alto', v >= 17);
      const opc = (R.opcionais || []).includes(k.split('.')[1]);
      t.classList.toggle('fora', !(opc && v === null) && !(Number.isInteger(v) && v >= 12 && v <= 19));
      const m = document.getElementById('med-' + t.dataset.j);
      if (m) m.textContent = mediaJog(j);
    } else if (t.type === 'number') {
      const [a, b] = R.limites[k] || [-Infinity, Infinity];
      t.classList.toggle('fora', !(v === null && k === 'idade') && !(Number.isInteger(v) && v >= a && v <= b));
    }
    marcarSujo();
    return true;
  }
  return false;
}

function marcarSujo() {
  ed.sujo = true;
  const s = $('#ed-sujo'); if (s) s.hidden = false;
  const b = $('#ed-descartar'); if (b) b.disabled = false;
}

// ---------------- eventos ----------------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-acao],[data-aba]');
  if (!el) return;
  if (el.dataset.aba) { aba = el.dataset.aba; render(); return; }
  const id = el.dataset.id;
  switch (el.dataset.acao) {
    case 'jogar': {
      const emulador = $('#emulador') ? $('#emulador').value : undefined;
      const opcao = $('#opcao-controle') ? ($('#opcao-controle').value || null) : null;
      acao(() => we.jogar({ jogoId: id, emulador, abrir: true, opcao, uniformes: pedidosUniforme('j:' + id) }), r => `partida.json gravado. Abrindo ${r.aberto}…`);
      break;
    }
    case 'assistir':
      acao(() => we.jogar({ jogoId: id, abrir: true, opcao: 'cpu_cpu', emulador: 'pcsx', uniformes: pedidosUniforme('j:' + id) }), 'CPU x CPU: abrindo o PCSX-Redux…');
      break;
    case 'preparar':
      acao(() => we.jogar({ jogoId: id, abrir: false, uniformes: pedidosUniforme('j:' + id) }), 'partida.json gravado. Abra o emulador quando quiser.');
      break;
    case 'jogar-este':
      acao(() => we.jogar({ jogoId: id, abrir: false }), 'partida.json gravado para este jogo. Abra o emulador ou use "Lançar placar".');
      break;
    case 'simular':
      acao(() => we.simular({ jogoId: id }), 'Jogo simulado.');
      break;
    case 'simular-rodada':
      acao(() => we.simularRodada({ rodada: Number(el.dataset.rodada) }), r => `${r.n} jogo(s) simulado(s).`);
      break;
    case 'escolher-meu': meuEscolhido = el.dataset.time || null; renderSetup(); break;
    case 'confirmar':
      acao(() => we.encerrarJogo({ jogoId: id }), 'Resultado confirmado.');
      break;
    case 'cancelar':
      if (confirm('Cancelar esta partida? Ela volta a ficar agendada.')) acao(() => we.cancelarJogo({ jogoId: id }));
      break;
    case 'reabrir':
      if (confirm('Reabrir este jogo? O placar e os gols serão apagados.')) acao(() => we.reabrirJogo({ jogoId: id }));
      break;
    case 'manual': manualAberto = id; render(); break;
    case 'fechar-manual': manualAberto = null; render(); break;
    case 'criar': {
      const nome = $('#nome-camp').value.trim();
      const idaVolta = $('#ida-volta').checked;
      acao(async () => { const r = await we.criarCampeonato({ nome, timeIds: [...selecao], idaVolta, meuTime: meuEscolhido }); criando = false; return r; }, 'Campeonato criado.');
      break;
    }
    case 'voltar': criando = false; render(); break;
    case 'ed-abrir': if (podeSairDoEditor()) abrirTime(id); break;
    case 'ed-novo':
      if (podeSairDoEditor()) { const d = JSON.parse(JSON.stringify(R.modelo)); ed = { id: slug(d.nome), novo: true, idManual: false, dados: d, sujo: true }; render(); }
      break;
    case 'ed-duplicar':
      if (podeSairDoEditor()) {
        const d = JSON.parse(JSON.stringify(ed.dados));
        d.nome = `${d.nome} (cópia)`.slice(0, R.limites.nomeTime);
        ed = { id: `${ed.id}-copia`, novo: true, idManual: true, dados: d, sujo: true }; render();
      }
      break;
    case 'ed-subir': case 'ed-descer': {
      const i = Number(el.dataset.i), k = el.dataset.acao === 'ed-subir' ? i - 1 : i + 1;
      const js = ed.dados.jogadores;
      if (k < 0 || k >= js.length) break;
      [js[i], js[k]] = [js[k], js[i]];
      if (ed.abertos) ed.abertos.clear();
      ed.sujo = true; render(); break;
    }
    case 'ed-visual': {
      const i = Number(el.dataset.i);
      ed.abertos = ed.abertos || new Set();
      if (ed.abertos.has(i)) ed.abertos.delete(i); else ed.abertos.add(i);
      render(); break;
    }
    case 'ed-visual-padrao': {
      const j = ed.dados.jogadores[Number(el.dataset.i)];
      j.aparencia = { ...R.aparenciaPadrao };
      if (j.outside == null) j.outside = true;
      ed.sujo = true; render(); break;
    }
    case 'ed-salvar': salvarTime(); break;
    case 'ed-descartar':
      if (!confirm('Descartar as alterações?')) break;
      if (ed.novo) { ed = null; render(); } else abrirTime(ed.id);
      break;
    case 'ed-excluir':
      if (confirm(`Excluir o time ${ed.dados.nome}? O arquivo vai para data/times/excluidos/.`))
        acao(async () => { const r = await we.timeExcluir({ id: ed.id }); ed = null; return r; }, 'Time excluído (movido para data/times/excluidos).');
      break;
    case 'uni':
      uniSel[el.dataset.lado] = el.dataset.u; uniSel.previa = null; uniSel.pedindo = false; render(); break;
    case 'ed-kit-add': {
      // ponto de partida: camisa clara se a titular é escura, escura se a titular é clara
      const t = (ed.dados.kit && ed.dados.kit.design) || {};
      const claro = luminancia(t.camisa) > 0.6;
      const fundo = claro ? '#151515' : '#F2F2F2';
      const destaque = claro ? (t.detalhe && luminancia(t.detalhe) < 0.6 ? t.detalhe : '#F2F2F2') : (t.camisa || '#151515');
      ed.dados.kit_reserva = { cor_numero: destaque, design: { camisa: fundo, detalhe: destaque, calcao: destaque, meiao: fundo } };
      ed.sujo = true; render(); break;
    }
    case 'ed-kit-remover':
      if (confirm('Remover o uniforme reserva deste time?')) { delete ed.dados.kit_reserva; ed.sujo = true; render(); }
      break;
    case 'ed-kit-desenhar': {
      const u = el.dataset.u;
      el.disabled = true; el.textContent = 'Desenhando…';
      we.kitDesenhar({ id: ed.id, uniforme: u }).then(async r => {
        E = r.estado; delete imgKits[r.arte];
        aviso(`Uniforme ${u} redesenhado em ${r.arte}.`, true);
        await abrirTime(ed.id);
      }).catch(err => { aviso(err.message); render(); });
      break;
    }
    case 'am-cenario': amForm.cenario = el.dataset.c; render(); break;
    case 'am-trocar': [amForm.casa, amForm.visitante] = [amForm.visitante, amForm.casa]; render(); break;
    case 'am-iniciar':
      acao(() => we.amistosoIniciar({ casaId: amForm.casa, visitanteId: amForm.visitante, cenario: amForm.cenario,
        emulador: amForm.emulador, mataMata: amForm.mataMata, uniformes: pedidosUniforme(`am:${amForm.casa}:${amForm.visitante}`) }),
        r => `Amistoso preparado. Abrindo ${r.aberto}…`);
      break;
    case 'am-encerrar':
      acao(() => we.amistosoEncerrar({}), 'Amistoso encerrado.');
      break;
    case 'am-cancelar':
      if (confirm('Cancelar o amistoso? O resultado não é guardado.')) acao(() => we.amistosoEncerrar({ descartar: true }), 'Amistoso cancelado.');
      break;
  }
});

document.addEventListener('change', e => {
  const am = { 'am-casa': 'casa', 'am-visitante': 'visitante', 'am-emulador': 'emulador' }[e.target.id];
  if (am) {
    const antigo = amForm[am];
    amForm[am] = e.target.value;
    // escolheu o mesmo time do outro lado: troca os dois
    if (am === 'casa' && amForm.casa === amForm.visitante) amForm.visitante = antigo;
    if (am === 'visitante' && amForm.visitante === amForm.casa) amForm.casa = antigo;
    render();
    return;
  }
  if (e.target.id === 'am-mata') { amForm.mataMata = e.target.checked; return; }
  if (ed && e.target.dataset.k === 'nome' && e.target.dataset.j != null) {
    const v = asciiJs(e.target.value).slice(0, R.limites.nome);
    if (v !== e.target.value) { e.target.value = v; campoEditor(e.target); }
    return;
  }
  if (ed && /^(kit|kit_reserva)\.|^sigla$/.test(e.target.dataset.t || '')) { render(); return; }
  if (e.target.id === 'sel-meu') {
    const timeId = e.target.value || null;
    acao(() => we.meuTime({ timeId }), timeId ? `Agora você controla o ${timeDe(timeId).nome}.` : 'Sem time controlado: todos os jogos podem ser simulados.');
    return;
  }
  const t = e.target.dataset && e.target.dataset.time;
  if (!t) return;
  if (e.target.checked) selecao.add(t); else selecao.delete(t);
  renderSetup();
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form="manual"]');
  if (!f) return;
  e.preventDefault();
  const id = f.dataset.id;
  const manual = { casa: f.casa.value, visitante: f.visitante.value };
  acao(async () => { const r = await we.encerrarJogo({ jogoId: id, manual }); manualAberto = null; return r; }, 'Placar salvo.');
});

$('#btn-novo').addEventListener('click', () => { criando = true; selecao = new Set(E.campeonato.times.map(t => t.id)); meuEscolhido = E.campeonato.meuTime || null; render(); });
$('#btn-pasta').addEventListener('click', () => we.abrirPasta());
document.querySelector('.nav').addEventListener('click', e => {
  const b = e.target.closest('[data-tela]');
  if (!b || b.dataset.tela === tela) return;
  if (tela === 'times' && !podeSairDoEditor()) return;
  tela = b.dataset.tela;
  render();
});
document.addEventListener('input', e => { if (campoEditor(e.target)) e.stopPropagation(); });
we.aoFimAmistoso(txt => aviso(`Fim do amistoso: ${txt}.`, true));

we.aoAtualizar(recarregar);
we.aoConfirmar(txt => aviso(`Fim de jogo: ${txt}. Resultado gravado na tabela.`, true));
recarregar();
