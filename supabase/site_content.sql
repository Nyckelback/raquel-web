-- ============================================================
--  PENDIENTE (correr 1 vez en Supabase → SQL Editor → Run)
--  Crea la tabla del mini-CMS "Editar página".
--  Mientras no se corra, el sitio funciona igual con los textos por
--  defecto; solo el botón "Guardar" de "Editar página" no podrá guardar.
--  Proyecto: howzobocntcchvjuescg
-- ============================================================
create table if not exists public.site_content (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);
alter table public.site_content enable row level security;

drop policy if exists p_sc_read on public.site_content;
create policy p_sc_read on public.site_content for select using (true);          -- cualquiera lee (textos públicos)

drop policy if exists p_sc_admin on public.site_content;
create policy p_sc_admin on public.site_content for all using (public.is_admin()) with check (public.is_admin());  -- solo Raquel edita

-- ============================================================
--  Recursos "privados" para VARIAS personas (antes solo 1).
--  Cambia assigned_to de uuid a uuid[] y ajusta la regla de lectura.
--  (Seguro: aún no hay recursos privados creados.)
-- ============================================================
alter table public.resources drop column if exists assigned_to;
alter table public.resources add column assigned_to uuid[];

drop policy if exists p_res_read on public.resources;
create policy p_res_read on public.resources for select using (
  public.is_admin()
  or visibility = 'public'
  or (visibility = 'members' and public.is_member())
  or (visibility = 'docentes' and public.is_member() and public.my_tipo() = 'docente')
  or (visibility = 'estudiantes' and public.is_member() and public.my_tipo() = 'estudiante')
  or (visibility = 'privado' and auth.uid() = any(assigned_to))
);
