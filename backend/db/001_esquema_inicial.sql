-- LIMS-BioPuna · Esquema inicial

-- 1. Perfil de investigadores (vinculado al login de Supabase Auth)
create table investigador (
  id_investigador uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null,
  email           text not null unique,
  rol_catedra     text,
  rol_sistema     text not null default 'investigador'
                  check (rol_sistema in ('admin', 'investigador', 'lectura')),
  creado_en       timestamptz not null default now()
);

-- 2. Campañas de muestreo en territorio
create table campana_territorio (
  id_campana     bigint generated always as identity primary key,
  localidad_puna text not null,
  fecha_salida   date not null,
  convenio_inta  boolean not null default false,
  observaciones  text
);

-- 3. Muestras de animales
create table muestra_animal (
  id_muestra            bigint generated always as identity primary key,
  id_campana            bigint not null references campana_territorio(id_campana),
  codigo_animal         text not null,
  especie               text not null check (especie in ('Llama', 'Vicuña', 'Ovino')),
  fecha_hora_extraccion timestamptz not null,
  url_foto_campo        text,
  unique (id_campana, codigo_animal)
);

-- 4. Ensayos electroforéticos
create table ensayo_electroforetico (
  id_ensayo              bigint generated always as identity primary key,
  id_muestra             bigint not null references muestra_animal(id_muestra),
  id_investigador        uuid not null references investigador(id_investigador),
  fecha_corrida          timestamptz not null default now(),
  proteinas_totales_g_dl numeric(4,2) not null
                         check (proteinas_totales_g_dl > 0 and proteinas_totales_g_dl <= 20),
  url_imagen_tira        text,
  metodo_lectura         text not null default 'digital_opencv'
                         check (metodo_lectura in ('digital_opencv', 'espectrofotometro'))
);

-- 5. Fracciones proteicas de cada ensayo
create table fraccion_proteica (
  id_fraccion         bigint generated always as identity primary key,
  id_ensayo           bigint not null references ensayo_electroforetico(id_ensayo) on delete cascade,
  nombre_fraccion     text not null
                      check (nombre_fraccion in ('Albumina', 'Alfa1', 'Alfa2', 'Beta', 'Gamma')),
  area_integrada      numeric not null,
  porcentaje_relativo numeric(5,2) not null check (porcentaje_relativo between 0 and 100),
  concentracion_g_dl  numeric(5,2) not null,
  unique (id_ensayo, nombre_fraccion)
);

-- Índices en las claves foráneas (aceleran las consultas)
create index on muestra_animal (id_campana);
create index on ensayo_electroforetico (id_muestra);
create index on ensayo_electroforetico (id_investigador);
create index on fraccion_proteica (id_ensayo);

-- Vista con el semáforo de 48 hs (se calcula al consultar)
create view muestra_con_estado with (security_invoker = true) as
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
  case
    when e.primera_corrida is not null then 'procesada'
    when now() - m.fecha_hora_extraccion < interval '24 hours' then 'verde'
    when now() - m.fecha_hora_extraccion < interval '40 hours' then 'amarillo'
    else 'rojo'
  end as estado_48h
from muestra_animal m
left join (
  select id_muestra, min(fecha_corrida) as primera_corrida
  from ensayo_electroforetico
  group by id_muestra
) e on e.id_muestra = m.id_muestra;

-- Seguridad por filas activada (sin permisos todavía: nadie accede)
alter table investigador            enable row level security;
alter table campana_territorio      enable row level security;
alter table muestra_animal          enable row level security;
alter table ensayo_electroforetico  enable row level security;
alter table fraccion_proteica       enable row level security;