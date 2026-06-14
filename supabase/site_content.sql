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
