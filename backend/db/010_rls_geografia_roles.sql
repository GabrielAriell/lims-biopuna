-- Activa RLS en catálogos geográficos y define políticas alineadas al resto del esquema.
-- Los catálogos (provincia/departamento) son de lectura para usuarios autenticados;
-- solo admin puede modificarlos (datos maestros).

begin;

alter table public.provincia enable row level security;
alter table public.departamento enable row level security;

-- provincia
drop policy if exists "provincia_ver" on public.provincia;
create policy "provincia_ver" on public.provincia
  for select to authenticated
  using (true);

drop policy if exists "provincia_admin_insert" on public.provincia;
create policy "provincia_admin_insert" on public.provincia
  for insert to authenticated
  with check (public.rol_actual() = 'admin');

drop policy if exists "provincia_admin_update" on public.provincia;
create policy "provincia_admin_update" on public.provincia
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

drop policy if exists "provincia_admin_delete" on public.provincia;
create policy "provincia_admin_delete" on public.provincia
  for delete to authenticated
  using (public.rol_actual() = 'admin');

-- departamento
drop policy if exists "departamento_ver" on public.departamento;
create policy "departamento_ver" on public.departamento
  for select to authenticated
  using (true);

drop policy if exists "departamento_admin_insert" on public.departamento;
create policy "departamento_admin_insert" on public.departamento
  for insert to authenticated
  with check (public.rol_actual() = 'admin');

drop policy if exists "departamento_admin_update" on public.departamento;
create policy "departamento_admin_update" on public.departamento
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

drop policy if exists "departamento_admin_delete" on public.departamento;
create policy "departamento_admin_delete" on public.departamento
  for delete to authenticated
  using (public.rol_actual() = 'admin');

commit;