-- LIMS-BioPuna · Migración 005
-- Geografía normalizada para campañas en la Puna (provincias/departamentos)
-- + localidad/paraje como texto libre.
--
-- Recomendación aplicada: catálogo acotado a provincias con sectores de Puna
-- y detalle puntual libre (puesto, paraje, referencia). "Región" no se modela
-- como tabla por ahora.
--
-- Compatibilidad: se conserva `localidad_puna` y se completa automáticamente
-- con una ubicación legible para no romper consultas/código existente.
--
-- Ejecutar una sola vez, después de 001-004.

begin;

create table if not exists public.provincia (
  id_provincia smallint generated always as identity primary key,
  nombre text not null unique
);

create table if not exists public.departamento (
  id_departamento smallint generated always as identity primary key,
  id_provincia smallint not null references public.provincia(id_provincia),
  nombre text not null,
  unique (id_provincia, nombre)
);

create index if not exists departamento_provincia_idx
  on public.departamento (id_provincia);

-- Provincias con sectores de Puna (catálogo inicial; ampliable).
insert into public.provincia (nombre) values
  ('Jujuy'),
  ('Salta'),
  ('Catamarca'),
  ('Tucumán'),
  ('La Rioja')
on conflict (nombre) do nothing;

-- Departamentos (semilla inicial). Se pueden agregar más sin migración de
-- estructura: insert into departamento (id_provincia, nombre) ...
insert into public.departamento (id_provincia, nombre)
select p.id_provincia, d.nombre
from (
  values
    ('Jujuy', 'Cochinoca'),
    ('Jujuy', 'Humahuaca'),
    ('Jujuy', 'Rinconada'),
    ('Jujuy', 'Santa Catalina'),
    ('Jujuy', 'Susques'),
    ('Jujuy', 'Tumbaya'),
    ('Jujuy', 'Yavi'),
    ('Salta', 'Iruya'),
    ('Salta', 'La Poma'),
    ('Salta', 'Los Andes'),
    ('Salta', 'Santa Victoria'),
    ('Catamarca', 'Antofagasta de la Sierra'),
    ('Catamarca', 'Belén'),
    ('Catamarca', 'Tinogasta'),
    ('Tucumán', 'Tafí del Valle'),
    ('La Rioja', 'Vinchina'),
    ('La Rioja', 'Famatina'),
    ('La Rioja', 'General Lamadrid')
) as d(provincia, nombre)
join public.provincia p on p.nombre = d.provincia
on conflict (id_provincia, nombre) do nothing;

alter table public.campana_territorio
  add column if not exists id_departamento smallint
    references public.departamento(id_departamento),
  add column if not exists localidad_detalle text;

-- Datos previos: conservar el texto como detalle libre.
update public.campana_territorio
set localidad_detalle = localidad_puna
where (localidad_detalle is null or btrim(localidad_detalle) = '')
  and localidad_puna is not null
  and btrim(localidad_puna) <> '';

-- Se mantiene para compatibilidad; ya no es la fuente principal.
alter table public.campana_territorio
  alter column localidad_puna drop not null;

create index if not exists campana_departamento_idx
  on public.campana_territorio (id_departamento);

commit;
