/* ============================================================
   La Oda de las Charamuscas — Configuración
   ------------------------------------------------------------
   Para ACTIVAR el backend real (login, panel, subidas):
   1) Crea un proyecto gratis en https://supabase.com
   2) En Project Settings → API copia "Project URL" y "anon public key"
   3) Pégalos abajo entre las comillas y guarda.
   Mientras estén vacíos, el sitio funciona en MODO DEMO (guarda en
   este navegador) para que puedas ver y probar todo sin backend.
   ============================================================ */
window.ELNIDO_CONFIG = {
  SUPABASE_URL: "https://howzobocntcchvjuescg.supabase.co",   // ← Project URL ✓
  SUPABASE_ANON_KEY: "sb_publishable_4JZJ21c724IGvTo00lbuIw_MlO-dLna",   // Publishable key ✓

  SITE_URL: "https://laodadelascharamuscas.com",
  ADMIN_EMAIL: "raquelsofiadiazgonzalez1979@gmail.com",   // correo donde llegan los avisos

  // Avisos al correo (opcional). Crea cuenta gratis en https://emailjs.com
  EMAILJS: { PUBLIC_KEY: "", SERVICE_ID: "", TEMPLATE_ID: "" },

  // Límites de subida
  MAX_FILE_MB: 25,
  IMAGE_MAX_WIDTH: 1600   // las imágenes se reducen a este ancho al subir (ahorra espacio)
};
