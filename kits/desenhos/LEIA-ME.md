# Kits desenhados

1. Copie `kits/modelos/modelo_kit_4x.png` para esta pasta com um nome seu (ex.: `meu_time_4x.png`).
2. Pinte por cima, usando `kits/modelos/guia_sobre_modelo_4x.png` como mapa:
   - **Camisa (frente)**, **mangas**, **camisa (laterais)**: o torso e os braços.
   - **Calção** e **meião**.
   - **1ª costa**: desenhe as costas **sem número**. Ela é copiada para as 10 costas e o número de cada jogador é desenhado por cima automaticamente.
   - **Não pinte** as áreas vermelhas (pele/cabeça e a fonte dos números): elas não são do uniforme.
3. Tamanho: 512x1024 (4x). Também aceita 128x256 (original), 256x512 (2x) ou outro múltiplo exato.
4. No `data/partida.json`, aponte o kit do lado desejado para o desenho:
   ```json
   "arte": "kits/desenhos/meu_time_4x.png",
   "costa_modelo": "primeira",
   "cor_numero": "#FFFFFF"
   ```
5. Rode `node tools/gerar-kits.mjs` (ou o `run-duckstation.bat`). São gerados 1002 arquivos por kit na pasta de substituições do DuckStation.

Observação: o desenho é aplicado **por cima do kit base daquele lado** (hoje, Brasil na casa e Holanda no visitante).
O mapa de regiões é aproximado; teste e ajuste.
