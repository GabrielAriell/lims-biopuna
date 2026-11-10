-- LIMS-BioPuna · Migración 004
-- Registra automáticamente quién creó cada registro y cuándo.
--
-- El backend toma el usuario del token de Supabase Auth y lo escribe en
-- creado_por. El valor por defecto auth.uid() sirve además si en el futuro
-- el frontend escribe directo contra PostgREST con RLS.
--
-- Las filas que ya existían no tienen creador conocido: quedan con
-- creado_por = null. creado_en se completa con la fecha de la migración.
--
-- Ejecutar una sola vez, después de 001, 002 y 003.

begin;

-- 1. Campañas
alter table public.campana_territorio
  add column if not exists creado_por uuid
    references public.investigador(id_investigador),
  add column if not exists creado_en timestamptz not null default now();

alter table public.campana_territorio
  alter column creado_por set default auth.uid();

create index if not exists campana_territorio_creado_por_idx
  on public.campana_territorio (creado_por);

-- 2. Muestras
alter table public.muestra_animal
  add column if not exists creado_por uuid
    references public.investigador(id_investigador),
  add column if not exists creado_en timestamptz not null default now();

alter table public.muestra_animal
  alter column creado_por set default auth.uid();

create index if not exists muestra_animal_creado_por_idx
  on public.muestra_animal (creado_por);

-- 3. Ensayos
alter table public.ensayo_electroforetico
  add column if not exists creado_por uuid
    references public.investigador(id_investigador),
  add column if not exists creado_en timestamptz not null default now();

alter table public.ensayo_electroforetico
  alter column creado_por set default auth.uid();

create index if not exists ensayo_electroforetico_creado_por_idx
  on public.ensayo_electroforetico (creado_por);

-- 4. La vista del semáforo se recrea para exponer el creador de la muestra.
--    Se conservan todas las columnas y el cálculo de 48 h.
create or replace view public.muestra_con_estado
with (security_invoker = true) as
select
  m.id_muestra,
  m.id_campana,
  m.codigo_animal,
  m.especie,
  m.fecha_hora_extraccion,
  m.url_foto_campo,
  e.primera_corrida,
  round((extract(epoch from (coalesce(e.primera_corrida, now()) - m.fecha_hora_extraccion)) / 3600)::numeric, 1)
    as horas_transcurridas,
  -- RF-02: Verde <24 h, Amarillo 24-40 h, Rojo >40 h (hasta la corrida).
  case
    when e.primera_corrida is not null then 'procesada'
    when (coalesce(e.primera_corrida, now()) - m.fecha_hora_extraccion)
      < interval '24 hours' then 'verde'
    when (coalesce(e.primera_corrida, now()) - m.fecha_hora_extraccion)
      > interval '40 hours' then 'rojo'
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
