-- Quita el campo url_foto_campo de muestras (referencia externa opcional, sin uso).
-- La vista muestra_con_estado dependía de la columna, por eso se recrea sin ella.

begin;

drop view if exists public.muestra_con_estado;

alter table public.muestra_animal
  drop column if exists url_foto_campo;

create view public.muestra_con_estado
with (security_invoker = true) as
select
  m.id_muestra,
  m.id_campana,
  m.codigo_animal,
  m.especie,
  m.fecha_hora_extraccion,
  e.primera_corrida,
  round((extract(epoch from (coalesce(e.primera_corrida, now()) - m.fecha_hora_extraccion)) / 3600)::numeric, 1)
    as horas_transcurridas,
  case
    when e.primera_corrida is not null then 'procesada'
    when (coalesce(e.primera_corrida, now()) - m.fecha_hora_extraccion) < interval '24 hours' then 'verde'
    when (coalesce(e.primera_corrida, now()) - m.fecha_hora_extraccion) > interval '40 hours' then 'rojo'
    else 'amarillo'
  end as estado_48h,
  m.creado_por,
  m.creado_en
from public.muestra_animal m
left join (
  select id_muestra, min(fecha_corrida) as primera_corrida
  from public.ensayo_electroforetico
  group by id_muestra
) e on e.id_muestra = m.id_muestra;

commit;
