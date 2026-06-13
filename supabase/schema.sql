-- ============================================================
--  El Nido — Esquema de base de datos para Supabase
--  Pégalo COMPLETO en Supabase → SQL Editor → New query → Run.
--  Crea tablas, seguridad (RLS), permisos por rol y buckets de archivos.
-- ============================================================

-- ---------- Perfiles (extiende auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'member',     -- 'admin' | 'member'
  status text not null default 'pending',   -- 'approved' | 'pending'
  created_at timestamptz default now()
);

-- Crea el perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'member', 'pending')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funciones de ayuda para los permisos
create or replace function public.is_admin() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_member() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid()
    and (role = 'admin' or (role = 'member' and status = 'approved')));
$$;

-- ---------- Publicaciones (cuentos y artículos) ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'cuento',         -- 'cuento' | 'articulo'
  title text not null,
  slug text unique,
  excerpt text,
  content_json jsonb default '{"blocks":[]}',
  cover_url text,
  video_url text,
  visibility text not null default 'public',    -- 'public' | 'members'
  published boolean not null default true,
  expires_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Recursos (archivos descargables) ----------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  visibility text not null default 'public',
  bucket text,
  file_path text,
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
  expires_at date,
  created_at timestamptz default now()
);

-- ---------- Mensajes / leads ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text, email text, phone text, type text, message text,
  created_at timestamptz default now()
);

-- ============================================================
--  SEGURIDAD (Row Level Security)
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.posts     enable row level security;
alter table public.resources enable row level security;
alter table public.leads     enable row level security;

-- Perfiles: cada quien ve el suyo; admin ve todos; admin actualiza
drop policy if exists p_profiles_self on public.profiles;
create policy p_profiles_self on public.profiles for select using (auth.uid() = id or public.is_admin());
-- Solo admin actualiza perfiles (role/status). WITH CHECK evita que la fila resultante escape del control.
-- IMPORTANTE: NO crear una política de "self-update" sobre profiles sin congelar role/status,
-- o un miembro podría auto-promoverse a admin. Cambiar el nombre se hace por el panel de admin.
drop policy if exists p_profiles_admin_upd on public.profiles;
create policy p_profiles_admin_upd on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Posts: público ve lo publicado público; miembros ven los de miembros; admin todo
drop policy if exists p_posts_read on public.posts;
create policy p_posts_read on public.posts for select using (
  public.is_admin()
  or (published and visibility = 'public')
  or (published and visibility = 'members' and public.is_member())
);
drop policy if exists p_posts_admin on public.posts;
create policy p_posts_admin on public.posts for all using (public.is_admin()) with check (public.is_admin());

-- Resources: igual que posts
drop policy if exists p_res_read on public.resources;
create policy p_res_read on public.resources for select using (
  public.is_admin()
  or visibility = 'public'
  or (visibility = 'members' and public.is_member())
);
drop policy if exists p_res_admin on public.resources;
create policy p_res_admin on public.resources for all using (public.is_admin()) with check (public.is_admin());

-- Leads: cualquiera puede enviar (insert); solo admin los lee
drop policy if exists p_leads_insert on public.leads;
create policy p_leads_insert on public.leads for insert with check (true);
drop policy if exists p_leads_admin on public.leads;
create policy p_leads_admin on public.leads for select using (public.is_admin());

-- ============================================================
--  ALMACENAMIENTO (Storage)
-- ============================================================
insert into storage.buckets (id, name, public) values ('public', 'public', true)  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('private', 'private', false) on conflict (id) do nothing;

-- Bucket público: lo lee cualquiera; solo admin sube/edita/borra
drop policy if exists s_public_read on storage.objects;
create policy s_public_read on storage.objects for select using (bucket_id = 'public');
drop policy if exists s_public_write on storage.objects;
create policy s_public_write on storage.objects for insert to authenticated with check (bucket_id = 'public' and public.is_admin());
drop policy if exists s_public_mod on storage.objects;
create policy s_public_mod on storage.objects for update to authenticated using (bucket_id = 'public' and public.is_admin());
drop policy if exists s_public_del on storage.objects;
create policy s_public_del on storage.objects for delete to authenticated using (bucket_id = 'public' and public.is_admin());

-- Bucket privado: lo leen miembros aprobados y admin; solo admin sube/borra
drop policy if exists s_priv_read on storage.objects;
create policy s_priv_read on storage.objects for select to authenticated using (bucket_id = 'private' and public.is_member());
drop policy if exists s_priv_write on storage.objects;
create policy s_priv_write on storage.objects for insert to authenticated with check (bucket_id = 'private' and public.is_admin());
drop policy if exists s_priv_del on storage.objects;
create policy s_priv_del on storage.objects for delete to authenticated using (bucket_id = 'private' and public.is_admin());
drop policy if exists s_priv_mod on storage.objects;
create policy s_priv_mod on storage.objects for update to authenticated using (bucket_id = 'private' and public.is_admin()) with check (bucket_id = 'private' and public.is_admin());

-- ============================================================
--  ÚLTIMO PASO: convertir a Raquel en administradora
--  (después de que ella se registre en la web con su correo)
--  Reemplaza el correo y ejecuta:
-- ============================================================
-- update public.profiles set role = 'admin', status = 'approved' where email = 'CORREO_DE_RAQUEL@ejemplo.com';

-- ============================================================
--  (Opcional) Vencimiento automático SOLO de lo que tenga fecha.
--  No borra nada sin expires_at. Actívalo con la extensión pg_cron.
-- ============================================================
-- delete from public.posts     where expires_at is not null and expires_at < now();
-- delete from public.resources where expires_at is not null and expires_at < now();
