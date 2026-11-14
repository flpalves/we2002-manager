# Seta

As cinco setas de condição do Winning Eleven, calculadas pelo manager a partir da condição física + moral e escritas na RAM do jogo.

Um único SVG 14x14 (`<path d="M7 1 L12 7 H8.6 V13 H5.4 V7 H2 Z">`), girado pela classe: `we-seta--otima` (0°), `--boa` (45°), `--normal` (90°), `--ruim` (135°), `--pessima` (180°). Cores nos tokens `seta-*`, contorno preto de 0,8px.

A direção é o que importa (não só a cor), então a seta continua legível para quem não distingue as cores. Sempre `role="img"` com `aria-label` ("Seta boa"). Aparece no campo da escalação, na tabela de convocação e na ficha do jogador.
