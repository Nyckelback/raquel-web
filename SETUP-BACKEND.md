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
2. En Supabase → **SQL Editor**, ejecuta (cambia el correo). NOTA: el trigger `trg_freeze_profile`
   (anti auto-ascenso) también bloquea el UPDATE desde el SQL Editor, así que hay que levantarlo un instante:
   ```sql
   begin;
     alter table public.profiles disable trigger trg_freeze_profile;
     update public.profiles set role='admin', status='approved', full_name='Raquel Sofía Díaz González'
       where email='CORREO_DE_RAQUEL@ejemplo.com';
     alter table public.profiles enable trigger trg_freeze_profile;
   commit;
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

## ⚠️ Notas importantes (de la auditoría)
- **Confirmación de correo:** en Supabase → Authentication → Providers → **Email**, te recomiendo
  **desactivar "Confirm email"** para que docentes/estudiantes puedan entrar con solo correo+contraseña.
  Si lo dejas activado, funciona igual, pero la persona deberá confirmar desde su correo antes de entrar
  (el sitio ya muestra el mensaje correcto en cada caso).
- **Redirect URLs:** en Authentication → URL Configuration, agrega la URL real del sitio
  (`https://nyckelback.github.io/raquel-web`) a *Site URL* y a *Redirect URLs*. Debe coincidir EXACTA.
- **Modo demo NO es seguro:** mientras el sitio corra en demo (sin llaves), el "candado de miembros"
  es solo visual; no publiques ahí PDFs o textos realmente reservados. La protección real
  (RLS de Supabase) recién aplica cuando conectas las llaves. Con Supabase conectado, sí queda blindado.
- **Imágenes dentro de cuentos de "solo miembros":** el TEXTO y los ARCHIVOS descargables de miembros
  quedan protegidos por servidor. Las imágenes incrustadas y la portada se sirven por URL pública
  (cualquiera con el link exacto la vería). Para material gráfico realmente reservado, súbelo como
  **recurso "solo miembros"** (esos sí van al bucket privado con enlace firmado).
- **Previsualizar:** abre el sitio con un servidor (el preview o `python3 -m http.server` dentro de
  `web/`), **no** con doble clic en el `.html` (con `file://` el menú/pie no cargan por seguridad del navegador).

## 6) (Opcional) Dominio propio y Vercel
- Para un dominio `tunombre.com`: cómpralo (~US$10/año en Namecheap o Cloudflare) y lo conectamos.
- Para el link `*.vercel.app`: importa el repo `Nyckelback/raquel-web` en https://vercel.com/new.
