# Bandeiras e escudos

Coloque aqui as imagens (PNG ou JPG) das bandeiras ou escudos dos times.

Configure no arquivo do time (`data/times/<time>.json`) ou no `data/partida.json`:

```json
"bandeira": "bandeiras/corinthians.png",
"bandeira_ajuste": "ajustar"
```

- `esticar` (padrão): estica para o formato da bandeira do jogo (64x28).
- `ajustar`: a imagem cabe inteira, sem distorcer; o resto fica transparente. Bom para escudos.
- `cortar`: preenche tudo sem distorcer, cortando as sobras.

PNG com fundo transparente fica transparente no jogo. O jogo usa 15 cores por bandeira.

Depois de trocar a imagem, rode `npm run bandeiras` (o `run-pcsx.bat` já roda sozinho)
e confira a prévia em `kits/convertidos/bandeira_<lado>_previa.png`.
