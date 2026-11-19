-- Garantiza que la corrida del ensayo no sea anterior a la extracción de la muestra.
-- Se usa trigger porque fecha_hora_extraccion está en otra tabla (muestra_animal).

begin;

create or replace function public.validar_fecha_corrida_ensayo()
returns trigger
language plpgsql
as $$
declare
  extraccion timestamptz;
begin
  select m.fecha_hora_extraccion
    into extraccion
    from public.muestra_animal m
   where m.id_muestra = new.id_muestra;

  if extraccion is null then
    raise exception 'La muestra % no existe', new.id_muestra
      using errcode = '23503';
  end if;

  if new.fecha_corrida < extraccion then
    raise exception 'La fecha de corrida (%) no puede ser anterior a la fecha de extracción de la muestra (%)',
      new.fecha_corrida, extraccion
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_fecha_corrida_ensayo on public.ensayo_electroforetico;

create trigger trg_validar_fecha_corrida_ensayo
  before insert or update of fecha_corrida, id_muestra
  on public.ensayo_electroforetico
  for each row
  execute function public.validar_fecha_corrida_ensayo();

commit;

-- Verificación (solo lectura, opcional):
-- select e.id_ensayo, e.id_muestra, e.fecha_corrida, m.fecha_hora_extraccion
-- from ensayo_electroforetico e join muestra_animal m using (id_muestra)
-- where e.fecha_corrida < m.fecha_hora_extraccion;
