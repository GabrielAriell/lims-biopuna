-- Agrega la relación Albúmina/Globulina (A/G) al ensayo electroforético.


alter table if exists public.ensayo_electroforetico
  add column if not exists relacion_ag double precision;

comment on column public.ensayo_electroforetico.relacion_ag is
  'Relación Albúmina/Globulina calculada al guardar el ensayo (derivada de fracciones/proteínas totales).';
