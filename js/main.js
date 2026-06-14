/* La Oda de las Charamuscas — interacciones del sitio */

async function includeAll(){
  const nodes = [...document.querySelectorAll('[data-include]')];
  await Promise.all(nodes.map(async (n) => {
    try {
      const res = await fetch(n.getAttribute('data-include'));
      if (res.ok) n.outerHTML = await res.text();
    } catch (e) { /* en local file:// no carga; en servidor sí */ }
  }));
}

function initNav(){
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav-links a[data-nav]').forEach(a => {
    if (a.dataset.nav === page) a.classList.add('active');
  });
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }
}

function initYear(){
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
}

function initReveal(){
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
  // Red de seguridad: nada queda invisible aunque el observer no dispare.
  setTimeout(() => els.forEach(e => e.classList.add('in')), 4000);
}

/* Aviso por correo (EmailJS, opcional). Sin config → no hace nada. */
let _emailjsReady = null;
function notifyEmail(subject, body) {
  const c = (window.ELNIDO_CONFIG || {}).EMAILJS || {};
  if (!c.PUBLIC_KEY || !c.SERVICE_ID || !c.TEMPLATE_ID) return;
  const run = () => { try { window.emailjs.init({ publicKey: c.PUBLIC_KEY }); window.emailjs.send(c.SERVICE_ID, c.TEMPLATE_ID, { subject, message: body, to_email: (window.ELNIDO_CONFIG || {}).ADMIN_EMAIL || '' }); } catch (e) {} };
  if (window.emailjs) return run();
  if (!_emailjsReady) _emailjsReady = new Promise(res => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'; s.onload = res; document.head.appendChild(s); });
  _emailjsReady.then(run);
}

/* Formulario de asesorías → guarda lead, avisa por correo y abre WhatsApp */
function initAsesoriaForm(){
  const form = document.getElementById('asesoriaForm');
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    const nombre = (d.get('nombre') || '').toString().trim();
    const correo = (d.get('correo') || '').toString().trim();
    const tipo = (d.get('tipo') || '').toString().trim();
    const mensaje = (d.get('mensaje') || '').toString().trim();
    try { if (window.Store) { await Store.ready; await Store.leads.create({ name: nombre, email: correo, phone: '', type: tipo, message: mensaje }); } } catch (e) {}
    notifyEmail('Nuevo interesado en asesorías — La Oda de las Charamuscas', `Nombre: ${nombre}\nCorreo: ${correo}\nInterés: ${tipo}\nMensaje: ${mensaje}`);
    let txt = `Hola Raquel, soy ${nombre || '(nombre)'}. Me interesa: ${tipo || 'una asesoría'}.`;
    if (mensaje) txt += ` ${mensaje}`;
    const msg = document.getElementById('formMsg');
    if (msg) { msg.textContent = '¡Gracias! Te llevamos a WhatsApp para terminar de enviarlo.'; msg.className = 'msg ok'; msg.style.display = 'block'; }
    window.open('https://wa.me/573148448163?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    form.reset();
  });
}

/* Textos editables (mini-CMS): reemplaza el texto de los elementos con data-edit
   por lo que Raquel guardó en "Editar página". Si no hay valor, deja el de por defecto. */
async function initContent(){
  if (!window.Store || !document.querySelector('[data-edit]')) return;
  try {
    await Store.ready;
    const c = await Store.content.getAll();
    document.querySelectorAll('[data-edit]').forEach(el => {
      const v = c[el.dataset.edit];
      if (v != null && String(v).trim() !== '') el.textContent = v;
    });
    // Imágenes editables (foto de portada): si Raquel subió una, reemplaza la de por defecto
    document.querySelectorAll('[data-edit-img]').forEach(el => {
      const v = c[el.dataset.editImg];
      if (v != null && String(v).trim() !== '') el.src = v;
    });
    // Secciones opcionales: aparecen SOLO si Raquel escribió algo (si no, quedan ocultas)
    document.querySelectorAll('[data-show-if]').forEach(el => {
      const v = c[el.dataset.showIf];
      if (v != null && String(v).trim() !== '') el.style.display = '';
    });
  } catch (e) {}
}

/* Estado de cuenta en el header */
async function initAccount(){
  const slot = document.getElementById('acct');
  if (!slot || !window.Store) return;
  await Store.ready;
  const render = (u) => {
    if (!u) { slot.innerHTML = '<a class="acct-link" href="entrar.html">Entrar</a>'; return; }
    const ini = (u.full_name || u.email || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const st = u.role === 'admin' ? 'Administradora' : (u.status === 'approved' ? 'Miembro' : 'Pendiente de aprobación');
    const panel = u.role === 'admin' ? '<a href="panel.html"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>Panel</a>' : '';
    const ava = u.avatar_url ? `<img src="${u.avatar_url}" alt="">` : ini;
    slot.innerHTML = `<button class="acct-btn" id="acctBtn" aria-label="Mi cuenta"><span class="acct-ava">${ava}</span></button>
      <div class="acct-menu" id="acctMenu">
        <div class="who"><strong>${u.full_name || u.email}</strong><span>${st}</span></div>
        <a href="cuenta.html"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.3 3-5 7-5s7 1.7 7 5"/></svg>Mi cuenta</a>
        ${panel}
        <button id="acctOut"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>Cerrar sesión</button>
      </div>`;
    const btn = document.getElementById('acctBtn'), menu = document.getElementById('acctMenu');
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
    document.getElementById('acctOut').addEventListener('click', async () => { await Store.auth.signOut(); location.href = 'index.html'; });
  };
  document.addEventListener('click', () => { const m = document.getElementById('acctMenu'); if (m) m.classList.remove('open'); });
  render(Store.auth.user());
  Store.auth.onChange(render);
}

(async () => {
  await includeAll();
  initNav();
  initYear();
  initReveal();
  initAsesoriaForm();
  initAccount();
  initContent();
})();
