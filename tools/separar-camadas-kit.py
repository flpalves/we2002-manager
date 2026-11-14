# Uso (na raiz do projeto): python3 tools/separar-camadas-kit.py [pasta para a prévia composta]
# Separa o kit base do Brasil (kits/brasil_original.png) em duas camadas 4x:
#   kit_chapado_4x.png : cores chapadas (sem sombra) + pele/cabeça/fonte dos números como no original
#   kit_sombras_4x.png : só a sombra, preto com transparência (desenhar por cima, modo normal)
import colorsys, sys
from PIL import Image
PW, PH, S = 128, 256, 4
orig = Image.open('kits/brasil_original.png').convert('RGBA')
ref = open('kits/brasil_pagina.bin', 'rb').read()   # índices de 8 bits; >= 0xF0 = algarismos
px = orig.load()
R = {'frente': (0, 0, 64, 32), 'calcao': (0, 32, 64, 64), 'mangas': (0, 64, 64, 80), 'costas': (0, 80, 100, 128),
     'meiao': (0, 128, 32, 208), 'laterais': (32, 128, 64, 235)}
dentro = lambda x, y, r: r[0] <= x < r[2] and r[1] <= y < r[3]
regiao = lambda x, y: next((n for n, r in R.items() if dentro(x, y, r)), None)
# Costas sem número (igual ao desenhar-kit.ts): cada pixel vem de uma costa onde ele não é algarismo
limpo = {}
for ty in range(24):
    for tx in range(20):
        v = None
        for k in range(10):
            x, y = (k % 5) * 20 + tx, 80 + (k // 5) * 24 + ty
            if ref[y * PW + x] < 0xF0: v = px[x, y]; break
        limpo[(tx, ty)] = v or (128, 128, 128, 255)
fonte = lambda x, y: limpo[(x % 20, (y - 80) % 24)] if dentro(x, y, R['costas']) else px[x, y]
lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def classe(c):  # tom do tecido: matiz (saturados) ou neutro (branco/cinza)
    h, s, v = colorsys.rgb_to_hsv(*(t / 255 for t in c[:3]))
    if s <= 0.3: return ('neutro',)
    b = int(((h * 12) + 0.5) % 12)
    return ('matiz', {3: 2, 5: 4, 7: 8}.get(b, b))  # amarelo, verde e azul: um tom cada

# 1) agrupa os pixels do uniforme por tom
grupos = {}
for y in range(PH):
    for x in range(PW):
        if not regiao(x, y): continue
        c = fonte(x, y)
        if c[3] == 0: continue
        grupos.setdefault(classe(c), []).append(c)
# 2) cor chapada de cada tom = o tecido "iluminado" (percentil 92 do brilho)
plano = {}
for k, cs in grupos.items():
    cs = sorted(cs, key=lum)
    c = cs[min(len(cs) - 1, int(len(cs) * 0.92))]
    plano[k] = (c[:3], max(1.0, lum(c)))
# 3) monta as duas camadas
chap = Image.new('RGBA', (PW, PH), (0, 0, 0, 0)); som = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
cp, sp = chap.load(), som.load()
erro, n, clip = 0, 0, 0
for y in range(PH):
    for x in range(PW):
        c = fonte(x, y)
        if not regiao(x, y) or c[3] == 0:
            cp[x, y] = px[x, y]; continue        # pele, cabeça, números, detalhes: como no original
        cor, lref = plano[classe(c)]
        f = lum(c) / lref
        if f > 1: clip += 1
        f = min(1.0, f)
        cp[x, y] = (*cor, 255)
        a = round((1 - f) * 255); sp[x, y] = (0, 0, 0, a)
        # confere: chapado * (1 - a/255) deve voltar ao original
        rec = [round(v * (1 - a / 255)) for v in cor]
        erro += sum(abs(rec[i] - c[i]) for i in range(3)) / 3; n += 1
big = lambda im: im.resize((PW * S, PH * S), Image.NEAREST)
big(chap).save('kits/modelos/kit_chapado_4x.png'); big(som).save('kits/modelos/kit_sombras_4x.png')
if len(sys.argv) > 1: big(Image.alpha_composite(chap, som)).save(sys.argv[1] + '/composto_4x.png')
print('tons:', {str(k): (plano[k][0], len(grupos[k])) for k in sorted(grupos, key=lambda k: -len(grupos[k]))})
print(f'pixels do uniforme: {n} | erro médio da recomposição: {erro / n:.1f} níveis (0-255) | mais claros que o tom (realce perdido): {clip}')
