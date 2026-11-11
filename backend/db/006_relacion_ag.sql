-- Agrega la relación Albúmina/Globulina (A/G) al ensayo electroforético.
-- Ejecutar en Supabase (SQL editor) antes de desplegar el backend que la usa.

alter table if exists public.ensayo_electroforetico
  add column if not exists relacion_ag double precision;

comment on column public.ensayo_electroforetico.relacion_ag is
  'Relación Albúmina/Globulina calculada al guardar el ensayo (derivada de fracciones/proteínas totales).';
