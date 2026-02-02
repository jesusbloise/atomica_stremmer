BEGIN;

-- 1) Tabla para registrar migrations (si no existe)
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Agregar columnas nuevas a ficha_tecnica (si no existen)
ALTER TABLE ficha_tecnica
  ADD COLUMN IF NOT EXISTS titulo_archivo TEXT,

  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS agencia TEXT,
  ADD COLUMN IF NOT EXISTS productora TEXT,
  ADD COLUMN IF NOT EXISTS contacto TEXT,

  ADD COLUMN IF NOT EXISTS oficina TEXT,      -- "Chile" | "Mexico"
  ADD COLUMN IF NOT EXISTS tipo TEXT[],       -- ["Color","3D",...]

  ADD COLUMN IF NOT EXISTS estudio TEXT,
  ADD COLUMN IF NOT EXISTS director_clasif TEXT,
  ADD COLUMN IF NOT EXISTS productor_clasif TEXT,

  ADD COLUMN IF NOT EXISTS produccion TEXT,
  ADD COLUMN IF NOT EXISTS corporativo TEXT,
  ADD COLUMN IF NOT EXISTS nuevos_negocios TEXT;

-- 3) (Opcional) normalización básica
--    - oficina: vacíos a NULL
UPDATE ficha_tecnica
SET oficina = NULL
WHERE oficina IS NOT NULL AND btrim(oficina) = '';

-- 4) (Opcional) constraint suave para oficina (Chile/Mexico)
--    Si ya tienes una constraint con este nombre, no pasa nada porque hacemos DROP IF EXISTS.
ALTER TABLE ficha_tecnica
  DROP CONSTRAINT IF EXISTS ficha_tecnica_oficina_check;

ALTER TABLE ficha_tecnica
  ADD CONSTRAINT ficha_tecnica_oficina_check
  CHECK (oficina IS NULL OR oficina IN ('Chile', 'Mexico'));

-- 5) Registrar migration como aplicada (sin romper si ya existe)
INSERT INTO schema_migrations (id)
VALUES ('2026-01-26_02_ficha_tecnica_clasificacion')
ON CONFLICT (id) DO NOTHING;

COMMIT;
