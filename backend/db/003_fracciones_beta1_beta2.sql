-- LIMS-BioPuna · Migración 003
-- Permite guardar ensayos con 5 o 6 fracciones.
--
-- El esquema inicial (001) solo aceptaba el esquema clásico de 5 fracciones:
--   Albumina, Alfa1, Alfa2, Beta, Gamma
-- El análisis también puede devolver 6 fracciones, que separa la beta en:
--   Albumina, Alfa1, Alfa2, Beta1, Beta2, Gamma
-- Sin este cambio, insertar un ensayo de 6 fracciones falla contra el CHECK.
--
-- No modifica datos: solo reemplaza la regla de validación del nombre.
-- Ejecutar una sola vez, después de 001 y 002.

begin;

-- 1. Quitar la restricción vieja. Postgres nombra automáticamente los CHECK
--    de columna como <tabla>_<columna>_check.
alter table public.fraccion_proteica
  drop constraint if exists fraccion_proteica_nombre_fraccion_check;

-- 2. Crear la restricción nueva. Conserva 'Beta' para los ensayos de 5
--    fracciones y agrega 'Beta1' y 'Beta2' para los de 6.
alter table public.fraccion_proteica
  add constraint fraccion_proteica_nombre_fraccion_check
  check (
    nombre_fraccion in (
      'Albumina', 'Alfa1', 'Alfa2', 'Beta', 'Beta1', 'Beta2', 'Gamma'
    )
  );

commit;

-- 3. Verificación: debe aparecer una sola restricción sobre nombre_fraccion
--    y su definición debe incluir Beta1 y Beta2.
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.fraccion_proteica'::regclass
  and contype = 'c'
order by conname;
