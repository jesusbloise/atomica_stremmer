BEGIN;

-- 1) Tabla para registrar migrations (si no existe)
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Normalizamos categorías antiguas / nulas
UPDATE uploads
SET category = 'publicidad'
WHERE category IS NULL
   OR category NOT IN ('publicidad', 'entretenimiento', 'vxf');

-- Opcional: limpiar subcategorías viejas
UPDATE uploads
SET subcategory = NULL
WHERE subcategory IS NOT NULL;

-- 3) Reemplazamos constraint (drop+add es idempotente)
ALTER TABLE uploads
DROP CONSTRAINT IF EXISTS uploads_category_check;

ALTER TABLE uploads
ADD CONSTRAINT uploads_category_check
CHECK (category IN ('publicidad','entretenimiento','vxf'));

-- 4) Registramos la migration como aplicada (sin romper si ya existe)
INSERT INTO schema_migrations (id)
VALUES ('2026-01-26_01_atomica_categorias_publicidad_entretenimiento_vxf')
ON CONFLICT (id) DO NOTHING;

COMMIT;



-- # Desde la MV (donde está docker)
-- sudo docker cp db/migrations/2026-01-26_01_atomica_categorias_publicidad_entretenimiento_vxf.sql atomica_stremmer-db-1:/tmp/migration.sql

-- sudo docker exec -it atomica_stremmer-db-1 \
--   psql -U postgres -d atomica_stremmer -f /tmp/migration.sql


-- sudo docker exec -it atomica_stremmer-db-1 \
--   psql -U postgres -d atomica_stremmer -c "SELECT category, COUNT(*) FROM uploads GROUP BY 1 ORDER BY 2 DESC;"
