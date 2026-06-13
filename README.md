# El Nido — Web de Raquel Sofía Díaz

Sitio web personal de Raquel Sofía Díaz (docente, Magíster, doctoranda en Educación, tutora PTA):
recursos pedagógicos descargables, cuentos y lírica, y captación de leads para asesorías.

**Stack:** HTML + CSS + JS estático (sin build), igual que ACOSER. Paleta "Luz de Charamusca".

## Estructura
- `index.html`, `quien-soy.html`, `recursos.html`, `cuentos.html`, `asesorias.html`
- `css/styles.css` — sistema de diseño
- `js/main.js` — includes de header/footer + interacciones
- `partials/` — header y footer compartidos
- `recursos-archivos/` — PDFs descargables (pendiente subir)

## Desarrollo local
Servir la carpeta con cualquier servidor estático, p. ej.:
`python3 -m http.server 4790`

## Despliegue
Estático: se publica en Vercel (importar el repo) o GitHub Pages.

Próximas fases: panel privado para que Raquel suba contenido (Supabase), descargas con captura de correo.
