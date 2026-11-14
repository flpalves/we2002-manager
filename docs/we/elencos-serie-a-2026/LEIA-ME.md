# Elencos da Série A 2026 — fontes consolidadas (13/11/2026)

Um arquivo por time (`SIG.txt`) com a lista final usada para gerar `pacotes/brasil-2026/times/SIG.json`.
A 1ª linha diz a fonte do elenco (site oficial do clube), quem foi cortado para caber em 25-28 e de onde vieram camisa, pé, altura, nascimento e nacionalidade (Sofascore).

Formato da linha:
`nome|nome_we|pos|pos2|camisa|nascimento|nac|pé|altura|pele|físico|cabelo|cor|barba|cor_barba|old|delta|tags`

- Os 11 primeiros são os titulares, na ordem das vagas da formação do time.
- `old` = nome do jogador no pacote anterior (mantém id, notas, potencial e contrato); `SIG:nome` = veio de outro time do pacote (transferência).
- `delta`/`tags` só para jogador novo: nível relativo e características (mesmo método de `tools/serie-a-2026/gerar.py`).

`montar.py` regenera os JSON a partir destes arquivos e dos originais (ver cabeçalho do script; os originais estão em `backup/pacote-times-2026-11-13/`).
O mapa de aparência fica em `docs/we/aparencia-jogadores-serie-a-2026.md`.
