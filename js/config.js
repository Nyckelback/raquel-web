/* ============================================================
   El Nido — Configuración
   ------------------------------------------------------------
   Para ACTIVAR el backend real (login, panel, subidas):
   1) Crea un proyecto gratis en https://supabase.com
   2) En Project Settings → API copia "Project URL" y "anon public key"
   3) Pégalos abajo entre las comillas y guarda.
   Mientras estén vacíos, el sitio funciona en MODO DEMO (guarda en
   este navegador) para que puedas ver y probar todo sin backend.
   ============================================================ */
window.ELNIDO_CONFIG = {
  SUPABASE_URL: "",          // ← pega aquí tu Project URL
  SUPABASE_ANON_KEY: "",     // ← pega aquí tu anon public key

  SITE_URL: "https://nyckelback.github.io/raquel-web",
  ADMIN_EMAIL: "contacto@elnido.com",   // correo donde llegan los avisos

  // Avisos al correo (opcional). Crea cuenta gratis en https://emailjs.com
  EMAILJS: { PUBLIC_KEY: "", SERVICE_ID: "", TEMPLATE_ID: "" },

  // Límites de subida
  MAX_FILE_MB: 25,
  IMAGE_MAX_WIDTH: 1600   // las imágenes se reducen a este ancho al subir (ahorra espacio)
};
