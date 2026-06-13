/* El Nido — interacciones del sitio */

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

/* Formulario de asesorías → arma un mensaje de WhatsApp (sin backend) */
function initAsesoriaForm(){
  const form = document.getElementById('asesoriaForm');
  if (!form) return;
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    const nombre = (d.get('nombre') || '').toString().trim();
    const tipo = (d.get('tipo') || '').toString().trim();
    const mensaje = (d.get('mensaje') || '').toString().trim();
    let txt = `Hola Raquel, soy ${nombre || '(nombre)'}. Me interesa: ${tipo || 'una asesoría'}.`;
    if (mensaje) txt += ` ${mensaje}`;
    const url = 'https://wa.me/573148448163?text=' + encodeURIComponent(txt);
    window.open(url, '_blank', 'noopener');
  });
}

(async () => {
  await includeAll();
  initNav();
  initYear();
  initReveal();
  initAsesoriaForm();
})();
