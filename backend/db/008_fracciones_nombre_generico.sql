-- Permite nombres genéricos (Fracción N) además de los nombres clásicos.
-- Opción B: compatibilidad con ensayos guardados y con rangos que buscan "Albúmina".
begin;

alter table public.fraccion_proteica
  drop constraint if exists fraccion_proteica_nombre_fraccion_check;

alter table public.fraccion_proteica
  add constraint fraccion_proteica_nombre_fraccion_check
  check (
    nombre_fraccion in ('Albumina', 'Alfa1', 'Alfa2', 'Beta', 'Beta1', 'Beta2', 'Gamma')
    or nombre_fraccion ~ '^Fracción (?:[1-9]|1[0-9]|20)$'
  );

commit;
-- Verificación:
-- select conname, pg_get_constraintdef(oid) as definicion
-- from pg_constraint
-- where conrelid = 'public.fraccion_proteica'::regclass and contype = 'c';
