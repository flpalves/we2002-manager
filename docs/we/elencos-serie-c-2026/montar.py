# Gera pacotes/brasil-2026/times/<SIG>.json dos 20 times da Série C 2026.
#   python3 docs/we/elencos-serie-c-2026/montar.py <pasta do pacote> [--forcar]
# Fonte: dados-ogol.json (ogol.com.br, temporada 2026: elenco atual + minutos na Série C, ver coletar.py).
# Notas: mesmo método do montar.py da Série B (nível WE 12-19 -> notas 3/7/9/.../19 do pacote),
# com o nível de cada jogador tirado dos minutos jogados na Série C (em vez de um ajuste manual).
# Não regrava um time que já exista no pacote (use --forcar).
import json, sys, os, re, hashlib, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
PAC = args[0]
FORCAR = "--forcar" in sys.argv
DADOS = json.load(open(os.path.join(AQUI, "dados-ogol.json"), encoding="utf-8"))
KITS = json.load(open(os.path.join(AQUI, "kits.json"), encoding="utf-8"))

# slug ogol: sigla, nome, nome_curto, UF, porte, cores, (estádio, capacidade), pontos na 1ª fase, bônus da 2ª fase
# Estádio e capacidade: ficha do clube no ogol. Pontos: classificação final da 1ª fase (19 rodadas).
CLUBES = {
 "botafogo-pb": ("BPB", "Botafogo-PB", "BOTAFOGOPB", "PB", "pequeno", ["#151515", "#F2F2F2"], ("Almeidão", 25770), 33, 0.0),
 "brusque": ("BRU", "Brusque", "BRUSQUE", "SC", "pequeno", ["#FFD200", "#00843D", "#C8102E"], ("Augusto Bauer", 5000), 32, 0.05),
 "ferroviaria": ("FER", "Ferroviária", "FERROVIARI", "SP", "pequeno", ["#7B1F2A", "#F2F2F2"], ("Arena da Fonte Luminosa", 21075), 30, 0.15),
 "maringa": ("MGA", "Maringá", "MARINGA", "PR", "pequeno", ["#00843D", "#151515", "#F2F2F2"], ("Willie Davids", 23000), 30, 0.2),
 "floresta-ce": ("FLO", "Floresta", "FLORESTA", "CE", "pequeno", ["#00843D", "#F2F2F2"], ("Domingão", 10500), 30, 0.0),
 "inter-de-limeira": ("INL", "Inter de Limeira", "I.LIMEIRA", "SP", "pequeno", ["#151515", "#F2F2F2"], ("Major José Levy Sobrinho", 19833), 30, 0.05),
 "paysandu": ("PAY", "Paysandu", "PAYSANDU", "PA", "medio", ["#6CACE4", "#F2F2F2"], ("Curuzu", 16200), 29, 0.0),
 "santa-cruz": ("STA", "Santa Cruz", "SANTACRUZ", "PE", "medio", ["#151515", "#C8102E", "#F2F2F2"], ("Arruda", 60044), 29, 0.15),
 "ypiranga-rs": ("YPI", "Ypiranga-RS", "YPIRANGA", "RS", "pequeno", ["#FFD200", "#00843D"], ("Colosso da Lagoa", 22000), 29, 0.0),
 "guarani": ("GUA", "Guarani", "GUARANI", "SP", "medio", ["#00703C", "#F2F2F2"], ("Brinco de Ouro", 29130), 28, 0.0),
 "figueirense": ("FIG", "Figueirense", "FIGUEIRENS", "SC", "medio", ["#151515", "#F2F2F2"], ("Orlando Scarpelli", 19584), 28, 0.0),
 "maranhao": ("MAC", "Maranhão", "MARANHAO", "MA", "pequeno", ["#C8102E", "#1F4FA8", "#F2F2F2"], ("Castelão (São Luís)", 40179), 27, 0.0),
 "amazonas-fc": ("AMZ", "Amazonas", "AMAZONAS", "AM", "pequeno", ["#FFD200", "#151515"], ("Carlos Zamith", 5000), 26, 0.0),
 "caxias": ("CAX", "Caxias", "CAXIAS", "RS", "pequeno", ["#7A1E2C", "#F2F2F2"], ("Centenário", 22132), 25, 0.0),
 "ituano": ("ITU", "Ituano", "ITUANO", "SP", "pequeno", ["#C8102E", "#151515"], ("Novelli Júnior", 18560), 22, 0.0),
 "volta-redonda": ("VRE", "Volta Redonda", "V.REDONDA", "RJ", "pequeno", ["#FFD200", "#151515", "#F2F2F2"], ("Raulino de Oliveira", 21000), 21, 0.0),
 "barra-sc": ("BAR", "Barra-SC", "BARRA", "SC", "pequeno", ["#1F4FA8", "#F2F2F2"], ("Arena Barra FC", 5500), 21, 0.0),
 "anapolis": ("ANA", "Anápolis", "ANAPOLIS", "GO", "pequeno", ["#C8102E", "#151515", "#F2F2F2"], ("Jonas Duarte", 17800), 19, 0.0),
 "itabaiana": ("ITA", "Itabaiana", "ITABAIANA", "SE", "pequeno", ["#1F4FA8", "#C8102E", "#F2F2F2"], ("Mendonção", 12000), 17, 0.0),
 "confianca": ("CON", "Confiança", "CONFIANCA", "SE", "pequeno", ["#1F5FBF", "#F2F2F2"], ("Batistão", 15500), 13, 0.0),
}
# Valores em centavos. (saldo, patrocínio/temporada, orçamento da folha mensal, ingresso, custo por jogo, salário titular, salário reserva)
# Série C abaixo da Série B (B: médio 12 mi / 20 mi / 3,5 mi; pequeno 3 mi / 6 mi / 1,1 mi).
FIN = {"medio": (500000000, 1000000000, 150000000, 3000, 8000000, 6000000, 2000000),
       "pequeno": (200000000, 400000000, 60000000, 2000, 3000000, 3000000, 1200000)}
NAC = {"Brasil": "BRA", "Uruguai": "URU", "Colômbia": "COL", "Paraguai": "PAR", "Argentina": "ARG", "Nigéria": "NGA",
       "Chile": "CHI", "Venezuela": "VEN", "Equador": "ECU", "Peru": "PER", "Bolívia": "BOL", "Portugal": "POR"}
BANDEIRA = {"BR": "BRA", "UY": "URU", "CO": "COL", "PY": "PAR", "AR": "ARG", "NG": "NGA", "CL": "CHI", "VE": "VEN",
            "EC": "ECU", "PE": "PER", "BO": "BOL", "PT": "POR"}
# posição detalhada do ogol -> posição do WE
POS_OGOL = {"Goleiro": "GK", "Zagueiro": "CB", "Defensor": "CB", "Lateral Direito": "SB", "Lateral Esquerdo": "SB",
            "Volante": "DH", "Meia Central": "DH", "Meia Ofensivo": "OH", "Meia Esquerda": "SH", "Meia Direita": "SH",
            "Ponta Direita": "WG", "Ponta Esquerda": "WG", "Centroavante": "CF", "Atacante": "CF", "2º Atacante": "CF"}
POS_GRUPO = {"Goleiro": "GK", "Defensor": "CB", "Meia": "DH", "Atacante": "CF"}
SECUNDARIA = {"GK": None, "CB": "DH", "SB": "SH", "DH": "OH", "OH": "SH", "SH": "SB", "WG": "SH", "CF": "WG"}
ALTURA_PADRAO = {"GK": 189, "CB": 186, "SB": 175, "DH": 179, "OH": 174, "SH": 175, "WG": 173, "CF": 182}
FORMACOES = {"4-3-3B": ["GK", "CB", "CB", "SB", "SB", "DH", "DH", "OH", "CF", "WG", "WG"],
             "4-4-2B": ["GK", "CB", "CB", "SB", "SB", "DH", "DH", "OH", "OH", "CF", "CF"]}
RESERVA_DE = {"CB": ["DH", "SB"], "SB": ["SH", "CB", "WG"], "DH": ["OH", "CB"], "OH": ["DH", "SH", "WG"],
              "CF": ["WG", "OH"], "WG": ["SH", "CF", "OH"], "GK": []}

A = ["OFF", "DEF", "BAL", "STA", "SPD", "ACC", "RES", "JMP", "HEAD", "TEC", "PASS", "SHPW", "SHAC", "DRI", "CRV", "AGR"]
P = {
 "GK": [-3, 1, 1.2, -2, -1, -1, 2.2, 1.2, -2, -2, -2, 0, -3, -2.5, -2.5, -3],
 "CB": [-2, 2, 1.5, .5, -.5, -.6, .5, 1, 1.5, -1, -1, 0, -2, -1.5, -2.5, -2],
 "SB": [0, .5, -.5, 2, 1.5, 1.2, 0, -.5, -1, 0, 0, -.5, -1.5, 0, .5, -1],
 "DH": [-1, 1.5, .5, 2, -.5, -.5, .5, 0, 0, 0, 1, .5, -1, -.5, -.5, -1],
 "SH": [1, -1, -.5, 1.5, 1.2, 1.2, .5, -1, -1, 1, 1, 0, 0, 1, 1, .5],
 "OH": [1, -1.5, -.5, .5, 0, .5, .5, -1.5, -1.5, 2, 2, .5, .5, 1.5, 1.5, .5],
 "WG": [1.5, -2, -1, .5, 2, 2, .5, -1.5, -2, 1, 0, 0, .5, 2, 1, 1.5],
 "CF": [2.5, -2.5, .5, -.5, .5, .5, 1, .5, 1, .5, -1, 1.5, 2, .5, -1, 2],
}
T = {"vel": {"SPD": 1.5, "ACC": 1.5}, "lento": {"SPD": -1.5, "ACC": -1.2}, "cab": {"HEAD": 1.5, "JMP": 1.2},
     "fin": {"SHAC": 1, "SHPW": .8, "OFF": .5}, "cri": {"PASS": 1, "TEC": .8, "CRV": .8},
     "dri": {"DRI": 1.2, "TEC": .7}, "bola": {"CRV": 1.5, "SHAC": .5}, "for": {"BAL": 1.2, "SHPW": 1},
     "mar": {"DEF": 1, "RES": .5}, "vet": {"STA": -1.5, "SPD": -1, "ACC": -1, "RES": .5},
     "baixo": {"BAL": -1, "JMP": -1, "HEAD": -1, "ACC": .5}}
BASE_TIT, BASE_RES = 14.1, 13.6
AJUSTE = -0.2   # pacote: Série C abaixo da B (B: 7,9 a 9,1 na média dos 11 melhores; guia, seção 5.2)
PARA = {"OFF": "OFF", "DEF": "DEF", "BAL": "BAL", "STA": "STA", "SPD": "SPD", "ACC": "ACC", "RES": "RES", "JMP": "JMP",
        "HEAD": "HEA", "TEC": "TEC", "PASS": "PAS", "SHPW": "SHP", "SHAC": "SHA", "DRI": "DRI", "CRV": "CUR", "AGR": "AGR"}
WE_PARA_NOTA = {12: 3, 13: 7, 14: 9, 15: 11, 16: 13, 17: 15, 18: 17, 19: 19}
PES = {"Destro": "destro", "Canhoto": "canhoto", "Ambidestro": "ambidestro"}

def h(s): return hashlib.md5(s.encode()).digest()[0]
def ruido(nome, k): return (h(f"{nome}:{k}") / 255 - .5) * .8
def ascii_(s): return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
def slug(s): return re.sub(r"[^a-z0-9]+", "-", ascii_(s).lower()).strip("-")

def nome_we(nome):
    n = re.sub(r"[^A-Z0-9 .'-]", "", ascii_(nome).upper()).strip()
    if len(n) <= 10: return n
    partes = n.split()
    for cand in (f"{partes[0][0]}. {partes[-1]}", f"{partes[0][0]}.{partes[-1]}", partes[-1], partes[0]):
        if len(cand) <= 10: return cand
    return n[:10]

def forca(pts, bonus):  # 1ª colocada (33 pts) -1,1 ... lanterna (13 pts) -1,6
    return -1.1 - (33 - pts) / 20 * 0.5 + bonus

def notas(nome, pos, nivel, tags):
    prof = [x * 1.6 for x in P[pos]]
    return {PARA[k]: WE_PARA_NOTA[max(12, min(19, round(nivel + prof[i] + sum(T[t].get(k, 0) for t in tags) + ruido(nome, k))))]
            for i, k in enumerate(A)}

def potencial(g, idade):
    return min(20, round(g) + (3 if idade <= 19 else 2 if idade <= 22 else 1 if idade <= 26 else 0))

def preparar(p):
    pos = POS_OGOL.get(p["posicao"] or "", POS_GRUPO.get(p["grupo"], "DH"))
    m = re.match(r"(\d+)\s*cm", p["altura"] or "")
    alt = int(m.group(1)) if m else ALTURA_PADRAO[pos]
    m = re.search(r"\((\d+) anos\)", p["nascimento"] or "")
    idade = int(m.group(1)) if m else (p["idade"] or 25)
    nac = NAC.get(p["nacionalidade"] or "", BANDEIRA.get(p["bandeira"] or "", "BRA"))
    tags = []
    if alt >= 189 and pos != "GK": tags.append("cab")
    if alt <= 169: tags.append("baixo")
    if idade >= 33: tags.append("vet")
    if pos in ("WG", "SB") and idade <= 26: tags.append("vel")
    if pos in ("CF", "WG", "OH") and p["jogos"] and p["gols"] / max(1, p["jogos"]) >= 0.3: tags.append("fin")
    if pos == "OH": tags.append("cri")
    if pos == "DH" and (p["posicao"] or "") == "Volante": tags.append("mar")
    return dict(p, pos=pos, alt=alt, idade_=idade, nac=nac, tags=tags)

def escalar(jogs):
    """Escolhe a formação e os 11 titulares pelos minutos na Série C; devolve (formação, titulares, reservas)."""
    linha = sorted(jogs, key=lambda j: -j["minutos"])
    pontas = sum(1 for j in linha[:16] if j["pos"] == "WG")
    form = "4-3-3B" if pontas >= 3 else "4-4-2B"
    livres = list(linha); tit = []
    for vaga in FORMACOES[form]:
        esc = next((j for j in livres if j["pos"] == vaga), None)
        if esc is None:
            esc = next((j for alt in RESERVA_DE[vaga] for j in livres if j["pos"] == alt), None)
        if esc is None: esc = next(j for j in livres if j["pos"] != "GK")
        tit.append(esc); livres.remove(esc)
    gks = [j for j in livres if j["pos"] == "GK"]
    res = gks[:1] + [j for j in livres if j not in gks[:1]]
    return form, tit, res

ids = {}
for f in os.listdir(os.path.join(PAC, "times")):
    if f.endswith(".json"):
        for j in json.load(open(os.path.join(PAC, "times", f), encoding="utf-8"))["jogadores"]: ids[j["id"]] = f

rel = []
for s, lista in DADOS.items():
    sig, nome, curto, uf, porte, cores, (est, cap), pts, bonus = CLUBES[s]
    arq = os.path.join(PAC, "times", f"{sig}.json")
    if os.path.exists(arq) and not FORCAR:
        print(f"{sig}: já existe (use --forcar)"); continue
    for j in json.load(open(arq, encoding="utf-8"))["jogadores"] if os.path.exists(arq) else []:
        ids.pop(j["id"], None)
    saldo, patro, folha, ingr, custo, sal_t, sal_r = FIN[porte]
    form, tit, res = escalar([preparar(p) for p in lista])
    max_t = max(j["minutos"] for j in tit) or 1
    max_r = max([j["minutos"] for j in res] + [1])
    jogs, usadas, pend = [], set(), []
    for i, p in enumerate(tit + res):
        titular = i < 11
        # nível relativo pelos minutos: titular de -0,3 a +0,3; reserva de -0,5 a +0,1
        delta = (0.6 * p["minutos"] / max_t - 0.3) if titular else (0.6 * p["minutos"] / max_r - 0.5)
        nivel = (BASE_TIT if titular else BASE_RES) + forca(pts, bonus) + AJUSTE + delta
        at = notas(p["nome"], p["pos"], nivel, p["tags"])
        g = sum(at.values()) / 16
        jid = f"{sig.lower()}-{slug(p['nome'])}"; n = 2
        while jid in ids: jid = f"{sig.lower()}-{slug(p['nome'])}-{n}"; n += 1
        ids[jid] = sig
        fator = 1.0 + delta if titular else 1.0 + delta / 2
        sal = int(round((sal_t if titular else sal_r) * max(.5, fator) / 100000) * 100000)
        j = {"id": jid, "nome": p["nome"], "nome_we": nome_we(p["nome"]), "posicao": p["pos"],
             "posicao_secundaria": SECUNDARIA[p["pos"]], "camisa": None, "camisa_real": None, "idade": p["idade_"],
             "nacionalidade": p["nac"], "pe": PES.get(p["pe"] or "", "destro"), "altura": p["alt"], "atributos": at,
             "outside": True, "potencial": potencial(g, p["idade_"]), "resistencia": 10,
             "contrato": {"salario_mensal": sal, "ate_temporada": 2026 + h(jid) % 5, "multa": 0}}
        num = int(p["camisa"]) if (p["camisa"] or "").isdigit() else 0
        if 1 <= num <= 32 and num not in usadas: j["camisa"] = num; usadas.add(num)
        else: j["camisa_real"] = num if 1 <= num <= 99 else None; pend.append(j)
        jogs.append(j)
    livres = [n for n in range(1, 33) if n not in usadas]
    for j in pend: j["camisa"] = livres.pop(0)
    kd = KITS[s]
    time = {"sigla": sig, "nome": nome, "nome_curto": curto, "pais": "BRA", "estado": uf, "cores": cores,
            "porte": porte, "formacao": form,
            "estadio": {"nome": est, "capacidade": cap, "ingresso_padrao": ingr, "custo_por_jogo": custo},
            "financas": {"saldo_inicial": saldo, "patrocinio_temporada": patro, "orcamento_folha_mensal": folha},
            "kit": kd["kit"], "kit_reserva": kd["kit_reserva"], "kit_goleiro": kd["kit_goleiro"],
            "jogadores": jogs}
    with open(arq, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(time, fh, ensure_ascii=False, indent=2); fh.write("\n")
    top = sorted((sum(j["atributos"].values()) / 16 for j in jogs), reverse=True)[:11]
    folha_real = sum(j["contrato"]["salario_mensal"] for j in jogs)
    rel.append((sig, form, len(jogs), sum(j["posicao"] == "GK" for j in jogs), round(sum(top) / 11, 2), folha_real / 100, folha / 100))
for r in sorted(rel, key=lambda x: -x[4]):
    print("%-4s %-6s %2d jog %d GK  media11 %.2f  folha R$ %s / orc R$ %s" % (r[0], r[1], r[2], r[3], r[4], f"{r[5]:,.0f}", f"{r[6]:,.0f}"))
