-- LIMS-BioPuna · Roles, perfil automático y políticas de acceso

-- Devuelve el rol del usuario que consulta
create function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select rol_sistema
  from public.investigador
  where id_investigador = (select auth.uid())
$$;

revoke execute on function public.rol_actual() from public, anon;
grant  execute on function public.rol_actual() to authenticated;

-- Crea el perfil cuando alguien se registra en Auth (rol mínimo: lectura)
create function public.crear_perfil_investigador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.investigador (id_investigador, nombre, email, rol_sistema)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    'lectura'
  );
  return new;
end;
$$;

revoke execute on function public.crear_perfil_investigador() from public, anon, authenticated;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_perfil_investigador();

-- investigador: todos ven a todos; solo admin modifica
create policy "investigador_ver" on investigador
  for select to authenticated using (true);
create policy "investigador_admin_modifica" on investigador
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

-- campana_territorio
create policy "campana_ver" on campana_territorio
  for select to authenticated using (true);
create policy "campana_crear" on campana_territorio
  for insert to authenticated
  with check (public.rol_actual() in ('admin', 'investigador'));
create policy "campana_editar" on campana_territorio
  for update to authenticated
  using (public.rol_actual() in ('admin', 'investigador'))
  with check (public.rol_actual() in ('admin', 'investigador'));
create policy "campana_borrar" on campana_territorio
  for delete to authenticated using (public.rol_actual() = 'admin');

-- muestra_animal
create policy "muestra_ver" on muestra_animal
  for select to authenticated using (true);
create policy "muestra_crear" on muestra_animal
  for insert to authenticated
  with check (public.rol_actual() in ('admin', 'investigador'));
create policy "muestra_editar" on muestra_animal
  for update to authenticated
  using (public.rol_actual() in ('admin', 'investigador'))
  with check (public.rol_actual() in ('admin', 'investigador'));
create policy "muestra_borrar" on muestra_animal
  for delete to authenticated using (public.rol_actual() = 'admin');

-- ensayo_electroforetico (el ensayo queda a nombre de quien lo carga)
create policy "ensayo_ver" on ensayo_electroforetico
  for select to authenticated using (true);
create policy "ensayo_crear" on ensayo_electroforetico
  for insert to authenticated
  with check (
    public.rol_actual() in ('admin', 'investigador')
    and id_investigador = (select auth.uid())
  );
create policy "ensayo_editar" on ensayo_electroforetico
  for update to authenticated
  using (public.rol_actual() in ('admin', 'investigador'))
  with check (public.rol_actual() in ('admin', 'investigador'));
create policy "ensayo_borrar" on ensayo_electroforetico
  for delete to authenticated using (public.rol_actual() = 'admin');

-- fraccion_proteica
create policy "fraccion_ver" on fraccion_proteica
  for select to authenticated using (true);
create policy "fraccion_crear" on fraccion_proteica
  for insert to authenticated
  with check (public.rol_actual() in ('admin', 'investigador'));
create policy "fraccion_editar" on fraccion_proteica
  for update to authenticated
  using (public.rol_actual() in ('admin', 'investigador'))
  with check (public.rol_actual() in ('admin', 'investigador'));
create policy "fraccion_borrar" on fraccion_proteica
  for delete to authenticated using (public.rol_actual() = 'admin');