# Activar el backend de El Nido (login + panel + subidas)

> El sitio YA funciona en **modo demo** (guarda en el navegador). Estos pasos lo vuelven
> **real**: login de verdad, contenido permanente y visible para todos. Toma ~15 minutos.
> Todo es **gratis**.

## 1) Crear el proyecto en Supabase
1. Entra a **https://supabase.com** → *Start your project* (puedes entrar con GitHub).
2. *New project*. Nombre: `el-nido`. Región: la más cercana (East US sirve). Pon una contraseña de base de datos y guárdala.
3. Espera ~2 minutos a que el proyecto quede listo.

## 2) Crear las tablas y la seguridad
1. En el menú izquierdo: **SQL Editor** → *New query*.
2. Abre el archivo `supabase/schema.sql` (está en este proyecto), **copia TODO** y pégalo.
3. Clic en **Run**. Debe decir *Success*. (Esto crea tablas, permisos y los dos "buckets" de archivos.)

## 3) Pegar las llaves en la web
1. En Supabase: **Project Settings** (engranaje) → **API**.
2. Copia **Project URL** y **anon public** key.
3. En este proyecto abre `js/config.js` y pégalas:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGci...",
   ```
4. Avísame y yo hago `git push` (o súbelo tú). El sitio dejará el modo demo y usará el backend real.

## 4) Hacer a Raquel administradora
1. Pídele a Raquel que entre a la web → **Entrar → Registrarme** con SU correo y una contraseña.
2. En Supabase → **SQL Editor**, ejecuta (cambia el correo):
   ```sql
   update public.profiles set role='admin', status='approved' where email='CORREO_DE_RAQUEL@ejemplo.com';
   ```
3. Listo: ella entra y ve el **Panel** (botón en su menú de cuenta arriba a la derecha).

## 5) (Opcional) Avisos al correo cuando llega un mensaje
1. Crea cuenta gratis en **https://emailjs.com**.
2. Conecta un servicio de correo (Gmail), crea un *Email Template* con variables `subject` y `message`.
3. Copia *Public Key*, *Service ID* y *Template ID* en `js/config.js` → `EMAILJS`.

## Notas de diseño (lo que ya quedó resuelto)
- **Público vs privado:** cada cuento/recurso tiene "¿Quién lo ve?" → *Público* o *Solo miembros*.
  Los estudiantes/docentes se registran y Raquel los **aprueba** en el panel.
- **Subir es tan simple como se ve por fuera:** título, portada, link de YouTube y un editor de
  bloques (texto, imágenes, listas, citas, video). Los archivos validan tipo y peso.
- **Espacio:** las imágenes se **reducen y comprimen** al subir (ahorra mucho). 1 GB gratis ≈ miles
  de archivos. **Sin borrado automático** (no se pierde su trabajo); si quiere algo temporal, puede
  poner una fecha de "vence". Un archivo se guarda **una sola vez** y lo descargan todos.
- **Crecer barato:** si algún día se llena, movemos los archivos a Cloudflare R2 (10 GB gratis, sin
  costo por descargas). No hay que rehacer nada.

## 6) (Opcional) Dominio propio y Vercel
- Para un dominio `tunombre.com`: cómpralo (~US$10/año en Namecheap o Cloudflare) y lo conectamos.
- Para el link `*.vercel.app`: importa el repo `Nyckelback/raquel-web` en https://vercel.com/new.
