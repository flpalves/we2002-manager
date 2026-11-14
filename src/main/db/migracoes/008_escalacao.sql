-- Escalação do usuário (fase 8): formação, 11 titulares por vaga e reservas (JSON).
-- NULL = automática (a IA escala a cada jogo, como na CPU).

ALTER TABLE time ADD COLUMN escalacao TEXT;
