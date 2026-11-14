# Coleta os elencos da Série C 2026 no ogol.com.br e grava dados-ogol.json (entrada do montar.py).
#   python3 docs/we/elencos-serie-c-2026/coletar.py [pasta de cache]
# Passos: lista de equipes da edição -> elenco atual de cada clube (página do time, temporada 2026)
# -> minutos na Série C (jogadores?epoca_stats_id=155&comp_id=208) -> ficha de cada jogador escolhido
# (posição detalhada, pé, altura, nascimento, nacionalidade).
# Escolha: 3 goleiros e 23 jogadores de linha do elenco atual, pelos minutos na Série C.
import json, os, re, sys, time, html, urllib.request

BASE = "https://www.ogol.com.br"
EDICAO = "/edicao/brasileirao-serie-c-2026/210279/equipes"
EPOCA, COMP = 155, 208
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
os.makedirs(CACHE, exist_ok=True)

def baixar(caminho):
    arq = os.path.join(CACHE, re.sub(r"[^A-Za-z0-9]+", "_", caminho) + ".html")
    if not os.path.exists(arq) or os.path.getsize(arq) < 20000:
        req = urllib.request.Request(BASE + caminho, headers={"User-Agent": "Mozilla/5.0"})
        open(arq, "wb").write(urllib.request.urlopen(req, timeout=30).read()); time.sleep(0.5)
    return open(arq, encoding="utf-8", errors="ignore").read()

def texto(s):
    t = re.sub(r"\s+", " ", re.sub("<script.*?</script>", "", re.sub("<style.*?</style>", "", s, flags=re.S), flags=re.S))
    return html.unescape(re.sub(r"\|[ |]*", "|", re.sub("<[^>]+>", "|", t)))

pid = lambda u: re.search(r"/jogador/[^/]+/(\d+)", u).group(1)
equipes = sorted(set(re.findall(r'href="(/equipe/[^"]*\?epoca_id=%d)">(?!Time)[^<]+' % EPOCA, baixar(EDICAO))))
saida = {}
for u in equipes:
    slug = u.split("/")[2].split("?")[0]
    s = baixar(u)
    bloco = s[s.find('id="team_squad"'):s.find("+ Estat", s.find('id="team_squad"'))]
    elenco, sec = {}, None
    for m in re.finditer(r'<div class="section">([^<]+)</div>|<div class="number">([^<]*)</div>.*?flag:([A-Z]+).*?<a href="(/jogador/[^"]+)">([^<]+)</a>.*?<span>(\d+) anos</span>', bloco, re.S):
        if m.group(1): sec = m.group(1); continue
        elenco[pid(m.group(4))] = dict(grupo=sec, camisa=m.group(2).strip(), bandeira=m.group(3), idade=int(m.group(6)))
    jog = re.search(r'href="(/equipe/[^"]*/jogadores)"', s).group(1)
    st = baixar(f"{jog}?epoca_stats_id={EPOCA}&comp_id={COMP}&o=j")
    linhas = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", st, re.S):
        a = re.search(r'href="(/jogador/[^"]+)"[^>]*>([^<]+)</a>', tr)
        tds = [re.sub(r"<[^>]+>", "", x).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if not a or len(tds) != 14 or pid(a.group(1)) not in elenco: continue
        n = lambda x: int(x) if x.isdigit() else 0
        linhas.append(dict(url=a.group(1).split("?")[0], nome=html.unescape(a.group(2)).strip(), grupo=tds[3],
                           jogos=n(tds[4]), gols=n(tds[5]), titular=n(tds[7]), minutos=n(tds[9])))
    linhas.sort(key=lambda x: -x["minutos"])
    gk = [x for x in linhas if x["grupo"] == "Goleiro"][:3]
    escolhidos = gk + [x for x in linhas if x["grupo"] != "Goleiro"][:23]
    r = []
    for x in escolhidos:
        t = texto(baixar(x["url"]))
        g = lambda k: (re.search(r"\|" + k + r"\|([^|]+)\|", t) or [None, None])[1]
        e = elenco[pid(x["url"])]
        r.append(dict(nome=x["nome"], url=x["url"], grupo=x["grupo"], posicao=g("Posição"), pe=g("Pé preferencial"),
                      altura=g("Altura / Peso"), nascimento=g("Data de Nascimento"), nacionalidade=g("Nacionalidade"),
                      bandeira=e["bandeira"], idade=e["idade"], camisa=e["camisa"], nome_completo=g("Nome"),
                      jogos=x["jogos"], titular=x["titular"], gols=x["gols"], minutos=x["minutos"]))
    saida[slug] = r
    print(slug, len(r))
json.dump(saida, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados-ogol.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
