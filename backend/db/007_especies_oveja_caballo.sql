-- LIMS-BioPuna · Ampliación del catálogo de especies
-- Reemplaza "Ovino" por "Oveja" y agrega "Caballo".
--


begin;

-- 1. Quitar la restricción vieja antes de actualizar los datos.
alter table public.muestra_animal
  drop constraint if exists muestra_animal_especie_check;

-- 2. Unificar el valor histórico "Ovino" con el nuevo nombre "Oveja".
update public.muestra_animal
set especie = 'Oveja'
where especie = 'Ovino';

-- 3. Crear la restricción nueva con las cuatro especies disponibles.
alter table public.muestra_animal
  add constraint muestra_animal_especie_check
  check (especie in ('Llama', 'Vicuña', 'Oveja', 'Caballo'));

commit;

-- 4. Verificación: no debe quedar ningún registro con "Ovino".
select especie, count(*) as total
from public.muestra_animal
group by especie
order by especie;
