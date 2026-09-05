-- ============================================================
-- ESQUEMA INICIAL · Base de datos del Test Vocacional
-- Expo Educativa 2026 · IES N.° 11 (Jujuy, Argentina)
-- ============================================================
-- Este script corre SOLO -- de forma automática -- la primera vez
-- que se crea el volumen de Postgres de docker-compose.yml (carpeta
-- especial docker-entrypoint-initdb.d de la imagen oficial). Si el
-- volumen ya existe, Postgres NO lo vuelve a ejecutar solo; para
-- correrlo a mano ver el paso 4 de README-DOCKER.md.
--
-- IMPORTANTE: esto es infraestructura APARTE y nueva. El test
-- (index.html) y el dashboard (dashboard.html) siguen funcionando
-- 100% con localStorage + ntfy.sh, tal cual hasta ahora -- nada de
-- lo que hay acá está todavía conectado al sitio en vivo.
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. Áreas vocacionales (5) -- catálogo fijo (ver js/questions.js)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  color       TEXT NOT NULL
);

INSERT INTO areas (id, nombre, descripcion, color) VALUES
  ('salud',      'Salud y Bienestar',                'Cuidado de personas, análisis clínicos y gestión sanitaria.', '#22C55E'),
  ('tecnologia', 'Tecnología e Innovación',           'Desarrollo de software, datos e inteligencia artificial.',    '#6366F1'),
  ('turismo',    'Gastronomía, Turismo y Patrimonio', 'Turismo, hotelería, cocina regional y patrimonio cultural.',  '#F59E0B'),
  ('industria',  'Industria, Ambiente y Seguridad',   'Tecnología de alimentos, seguridad e higiene y energías.',    '#0EA5E9'),
  ('diseno',     'Diseño y Arte Aplicado',            'Diseño de indumentaria y creación visual.',                  '#EC4899')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------
-- 2. Tecnicaturas (18) -- catálogo fijo, cada una ligada a un área
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS carreras (
  id      TEXT PRIMARY KEY,
  nombre  TEXT NOT NULL,
  area_id TEXT NOT NULL REFERENCES areas(id)
);

INSERT INTO carreras (id, nombre, area_id) VALUES
  ('enfermeria',             'Tecnicatura Superior en Enfermería',                                  'salud'),
  ('asistente-odontologico', 'Tecnicatura Superior en Asistente Odontológico',                      'salud'),
  ('laboratorio-clinico',    'Tecnicatura Superior en Laboratorio de Análisis Clínico',              'salud'),
  ('agente-sanitario',       'Tecnicatura Superior en Agente Sanitario',                             'salud'),
  ('admin-servicios-salud',  'Tecnicatura Superior en Administración en Servicios de Salud',         'salud'),
  ('estadisticas-salud',     'Tecnicatura Superior en Estadísticas de Salud',                        'salud'),
  ('gerontologia',           'Tecnicatura Superior en Gerontología',                                 'salud'),
  ('desarrollo-software',    'Tecnicatura Superior en Desarrollo de Software',                       'tecnologia'),
  ('ciencia-datos-ia',       'Tecnicatura Superior en Ciencias de Datos e Inteligencia Artificial',  'tecnologia'),
  ('turismo',                'Tecnicatura Superior en Turismo',                                      'turismo'),
  ('guia-turismo',           'Tecnicatura Superior en Guía de Turismo',                              'turismo'),
  ('hoteleria',              'Tecnicatura Superior en Hotelería',                                    'turismo'),
  ('cocinas-regionales',     'Tecnicatura Superior en Cocinas Regionales y Cultura Alimentaria',     'turismo'),
  ('museologia',             'Tecnicatura Superior en Museología y Gestión Patrimonial',             'turismo'),
  ('tecnologia-alimentos',   'Tecnicatura Superior en Tecnología de los Alimentos',                  'industria'),
  ('seguridad-higiene',      'Tecnicatura Superior en Seguridad e Higiene Laboral',                  'industria'),
  ('energias-renovables',    'Tecnicatura Superior en Gestión de Energías Renovables',               'industria'),
  ('diseno-indumentaria',    'Tecnicatura Superior en Diseño de Indumentaria',                       'diseno')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------
-- 3. Participantes -- un test completado = una fila
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS participantes (
  id                  TEXT PRIMARY KEY,          -- mismo id que genera el navegador (js/app.js)
  fecha_hora          TIMESTAMPTZ NOT NULL DEFAULT now(),
  nombre              TEXT,
  apellido            TEXT,
  edad                SMALLINT,
  genero              TEXT,
  localidad           TEXT,
  situacion_educativa TEXT
);

CREATE INDEX IF NOT EXISTS idx_participantes_fecha ON participantes (fecha_hora);

-- -----------------------------------------------------------
-- 4. Elecciones -- el Top 3 de cada participante (demografía por
--    carrera: 3 filas por persona, una por posición elegida)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS elecciones (
  participante_id TEXT NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  posicion        SMALLINT NOT NULL CHECK (posicion BETWEEN 1 AND 3),
  carrera_id      TEXT NOT NULL REFERENCES carreras(id),
  PRIMARY KEY (participante_id, posicion)
);

CREATE INDEX IF NOT EXISTS idx_elecciones_carrera ON elecciones (carrera_id);

-- -----------------------------------------------------------
-- 5. Espejo plano del CSV exportado desde el dashboard
-- -----------------------------------------------------------
-- Columnas 1 a 1 con construirCSV() en js/dashboard.js (botón
-- "🔒 Exportar Dataset CSV"). Pensada para poder importar ese
-- archivo tal cual, sin transformarlo primero -- ver el paso 5
-- de README-DOCKER.md.
CREATE TABLE IF NOT EXISTS encuestas_raw (
  id                  TEXT PRIMARY KEY,
  fecha_hora          TEXT,
  nombre              TEXT,
  apellido            TEXT,
  edad                TEXT,
  genero              TEXT,
  localidad           TEXT,
  situacion_educativa TEXT,
  top1_carrera        TEXT,
  top2_carrera        TEXT,
  top3_carrera        TEXT
);

COMMIT;
