-- Limita fracciones a 5 o 6 franjas y normaliza nomenclatura:
-- 5 franjas: Albumina, Alfa1, Alfa2, Beta, Gamma
-- 6 franjas: Albumina, Alfa1, Alfa2, Beta, Gamma1, Gamma2
-- Se mantiene compatibilidad con Beta1/Beta2 por datos hist?ricos existentes.
begin;

alter table public.fraccion_proteica
  drop constraint if exists fraccion_proteica_nombre_fraccion_check;

alter table public.fraccion_proteica
  add constraint fraccion_proteica_nombre_fraccion_check
  check (
    nombre_fraccion in (
      'Albumina', 'Alfa1', 'Alfa2', 'Beta', 'Gamma', 'Gamma1', 'Gamma2',
      'Beta1', 'Beta2'
    )
  );

commit;

