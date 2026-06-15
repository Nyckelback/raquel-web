/* ============================================================
   La Oda de las Charamuscas — render público de contenido dinámico
   Muestra cuentos/artículos y recursos que sube Raquel,
   reproduce videos de YouTube y aplica el candado de miembros.
   ============================================================ */
(function () {
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtSize = (b) => !b ? '' : (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 5.2A3 3 0 0 1 16 11M21 20c0-2.6-1.5-4.3-4-4.8"/></svg>';

  function ytId(raw) {
    const url = String(raw || '').trim(); if (!url) return '';
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\.|^m\./, '');
      if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || '';
      if (host.endsWith('youtube.com')) {
        const v = u.searchParams.get('v'); if (v) return v;
        const m = u.pathname.match(/\/(embed|shorts|v)\/([\w-]{6,})/); if (m) return m[2];
      }
    } catch (e) {}
    const m = url.match(/[?&]v=([\w-]{6,})/); return m ? m[1] : '';
  }
  function ytEmbed(url) {
    const id = ytId(url);
    if (!id) return url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener">Ver video ↗</a></p>` : '';
    return `<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  }

  function blocksToHtml(content) {
    const blocks = (content && content.blocks) || [];
    return blocks.map(b => {
      const d = b.data || {};
      switch (b.type) {
        case 'header': return `<h${d.level || 3}>${d.text || ''}</h${d.level || 3}>`;
        case 'paragraph': return `<p>${d.text || ''}</p>`;
        case 'quote': return `<blockquote>${esc(d.text || '')}${d.caption ? '<cite>— ' + esc(d.caption) + '</cite>' : ''}</blockquote>`;
        case 'list': {
          const tag = d.style === 'ordered' ? 'ol' : 'ul';
          const items = (d.items || []).map(it => `<li>${esc(typeof it === 'string' ? it : (it && it.content) || '')}</li>`).join('');
          return `<${tag}>${items}</${tag}>`;
        }
        case 'image': return `<figure><img src="${esc((d.file && d.file.url) || d.url || '')}" alt="${esc(d.caption || '')}">${d.caption ? `<figcaption class="note">${esc(d.caption)}</figcaption>` : ''}</figure>`;
        case 'embed': return ytEmbed(d.source || d.embed || '');
        case 'delimiter': return '<hr>';
        default: return d.text ? `<p>${esc(d.text)}</p>` : '';
      }
    }).join('\n');
  }

  const LOCKSM = '<svg style="width:16px;height:16px;vertical-align:-2px;color:var(--secondary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5"/><path d="M16 6a2.5 2.5 0 0 1 0 5"/></svg>';
  const head = (t) => `<div style="max-width:62ch;margin:46px 0 18px"><h2 style="font-size:clamp(1.5rem,3vw,2rem)">${t}</h2></div>`;
  function gate(msg) {
    return `<div class="gate">${LOCK}<h3 style="margin-bottom:6px">Contenido para la comunidad</h3><p>${esc(msg)}</p><a class="btn btn-primary" href="entrar" style="margin-top:14px">Entrar</a></div>`;
  }
  function postCard(p) {
    const ph = p.cover_url ? `<div class="ph" style="background-image:url('${esc(p.cover_url)}')"></div>` : `<div class="ph"></div>`;
    const badge = p.visibility === 'members' ? '<span class="badge-mem">Comunidad</span>' : '';
    return `<a class="post-card" href="articulo?id=${encodeURIComponent(p.slug || p.id)}">${ph}<div class="pb"><h3>${esc(p.title)}</h3><p>${esc(p.excerpt || '')}</p><div class="meta">${p.type === 'cuento' ? 'Cuento' : 'Artículo'} ${badge}</div></div></a>`;
  }
  // Reconoce un link de Google Drive y arma las 3 variantes (ver, vista previa embebida, descarga directa)
  function driveInfo(raw) {
    const url = String(raw || '').trim();
    if (!url || !/drive\.google\.com|docs\.google\.com/.test(url)) return null;
    let id = '';
    let m = url.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]{10,})/);   // /file/d/ID/view  ·  /d/ID
    if (m) id = m[1];
    if (!id) { m = url.match(/[?&]id=([A-Za-z0-9_-]{10,})/); if (m) id = m[1]; }   // open?id=ID  ·  uc?id=ID
    if (!id) return null;
    return {
      id,
      view: `https://drive.google.com/file/d/${id}/view`,
      preview: `https://drive.google.com/file/d/${id}/preview`,
      download: `https://drive.google.com/uc?export=download&id=${id}`
    };
  }

  function resItem(r) {
    const isPriv = r.visibility === 'privado';
    const tag = isPriv ? `Para ti ${LOCKSM}` : esc(r.category || 'Recurso');
    const isLink = r.file_type === 'link';
    const drv = isLink ? driveInfo(r.link_url || r.file_url) : null;
    const sizeTxt = r.file_size ? ' · ' + fmtSize(r.file_size) : '';
    let acts;
    if (drv) {
      acts = `<button class="btn btn-light" type="button" data-prev data-src="${esc(drv.preview)}">Vista previa</button>`
           + `<a class="btn btn-light" href="${esc(drv.view)}" target="_blank" rel="noopener">Abrir ↗</a>`;
    } else if (isLink) {
      acts = `<a class="btn btn-light" href="${esc(r.link_url || r.file_url)}" target="_blank" rel="noopener">Abrir ↗</a>`;
    } else {
      acts = `<a class="btn btn-light" href="#" data-res="${esc(r.id)}">Descargar</a>`;
    }
    const mem = (r.visibility && r.visibility !== 'public' && !isPriv) ? ` ${LOCKSM}` : '';
    return `<div class="dl-card" data-cat="${esc(r.category || 'Otro')}"><div class="dl-item"><div class="dl-ico">${DL}</div>`
      + `<div class="dl-meta"><strong>${esc(r.title)}</strong><span>${esc(r.description || '')}${sizeTxt}</span></div>`
      + `<span class="dl-tag">${tag}${mem}</span><div class="dl-acts">${acts}</div></div>`
      + (drv ? `<div class="dl-prevbox" hidden></div>` : '')
      + `</div>`;
  }

  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5S4 16 4 9.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 16 12 20.5 12 20.5z"/></svg>';
  // Bloque "Para ti": material que Raquel compartió en privado con esta persona, resaltado y arriba del todo.
  function foryouBlock(items, u) {
    const first = u && (u.full_name || '').trim().split(/\s+/)[0];
    const title = first ? `Para ti, ${esc(first)}` : 'Para ti';
    return `<div class="foryou"><div class="foryou-head"><span class="foryou-ico">${HEART}</span><h3>${title}</h3></div>`
      + `<p class="foryou-note">Material que Raquel preparó para ti. Es privado: solo tú lo ves.</p>`
      + `<div class="downloads">${items.map(resItem).join('')}</div></div>`;
  }

  // Un proyecto de galería puede tener VARIAS fotos (content_json.images). Compat: si no, usa la portada.
  function galImages(p) {
    const arr = (p.content_json && Array.isArray(p.content_json.images)) ? p.content_json.images.filter(Boolean) : [];
    if (arr.length) return arr;
    return p.cover_url ? [p.cover_url] : [];
  }
  // Tarjeta de ÁLBUM (tablero) en la lista de la galería.
  function galleryCard(a, idx) {
    const cover = a.images[0] || '';
    const ph = cover ? `<div class="gal-img" style="background-image:url('${esc(cover)}')"></div>` : `<div class="gal-img"></div>`;
    const count = a.images.length > 1 ? `<span class="gal-count">▦ ${a.images.length} fotos</span>` : '';
    return `<button type="button" class="gal-card" data-gal="${idx}" aria-label="Abrir ${esc(a.title)}">${ph}${count}<div class="gal-b"><h3>${esc(a.title)}</h3>${a.loc ? `<p class="gal-loc">📍 ${esc(a.loc)}</p>` : ''}${a.excerpt ? `<p>${esc(a.excerpt)}</p>` : ''}</div></button>`;
  }

  /* ---------- Galería estilo álbum: lista → álbum (portada + descripción + cuadrícula) → visor ----------
     El HASH manda en los 3 niveles:  (sin hash)=lista · #albumN=álbum · #albumN/M=foto N abierta.
     Así "atrás" del navegador/trackpad cierra la foto → vuelve al álbum → vuelve a la lista, sin dejar
     la imagen pegada. routeGallery() es la ÚNICA que muestra/oculta cada nivel según el hash. */
  let galData = [];
  let galBox = null;
  let lb = null;
  let shownAlbum = -2;       // -2 = nada renderizado aún · -1 = lista · >=0 = índice del álbum
  let galDidNav = false;     // ¿hubo navegación interna en esta carga? → para que "atrás" sea seguro
  const lbState = { item: 0, idx: 0 };
  const curImages = () => (galData[lbState.item] && galData[lbState.item].images) || [];

  // Avanzar un nivel = nueva entrada en el historial (hashchange dispara routeGallery).
  function goHash(h) { galDidNav = true; if (location.hash === h) routeGallery(); else location.hash = h; }
  // Volver un nivel: si venimos navegando, "atrás" limpio; si se entró directo (link compartido), reemplaza sin trampa.
  function goBackTo(target) {
    if (galDidNav) history.back();
    else { history.replaceState(null, '', target || (location.pathname + location.search)); routeGallery(); }
  }

  // Vista 1: la lista de álbumes (tableros).
  function renderGalleryList() {
    if (!galBox) return;
    shownAlbum = -1;
    galBox.innerHTML = galData.length
      ? `<div class="gallery-grid">${galData.map((a, i) => galleryCard(a, i)).join('')}</div>`
      : `<div class="res-empty"><h3>Aún no hay fotos en la galería</h3><p class="note">Pronto Raquel compartirá fotos de sus proyectos y actividades.</p></div>`;
    galBox.querySelectorAll('[data-gal]').forEach(c => c.onclick = () => goHash('#album' + c.dataset.gal));
  }

  // Vista 2: el álbum abierto (portada grande + descripción + cuadrícula de todas las fotos).
  function openAlbum(idx) {
    const a = galData[idx]; if (!galBox || !a) return;
    shownAlbum = idx;
    const cover = a.images[0] || '';
    const thumbs = a.images.map((u, i) => `<button type="button" class="alb-ph" data-ph="${i}" style="background-image:url('${esc(u)}')" aria-label="Foto ${i + 1}"></button>`).join('');
    galBox.innerHTML = `<div class="album">
      <button type="button" class="alb-back" data-back>← Galería</button>
      ${cover ? `<button type="button" class="alb-cover" data-ph="0" style="background-image:url('${esc(cover)}')" aria-label="Ver la portada en grande"></button>` : ''}
      <h2 class="alb-title">${esc(a.title)}</h2>
      ${a.loc ? `<p class="alb-loc">📍 ${esc(a.loc)}</p>` : ''}
      ${a.excerpt ? `<p class="alb-about">${esc(a.excerpt)}</p>` : ''}
      <div class="alb-count">${a.images.length} ${a.images.length === 1 ? 'foto' : 'fotos'}</div>
      <div class="alb-grid">${thumbs}</div>
    </div>`;
    galBox.querySelector('[data-back]').onclick = () => goBackTo(location.pathname + location.search);
    galBox.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => goHash('#album' + idx + '/' + b.dataset.ph));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // routeGallery: el hash decide el fondo (lista/álbum) y si el visor está abierto o CERRADO.
  function routeGallery() {
    if (!galBox) return;
    const h = location.hash || '';
    const mp = h.match(/^#album(\d+)\/(\d+)$/);   // álbum + foto (visor abierto)
    const ma = h.match(/^#album(\d+)$/);          // solo álbum
    const albumIdx = mp ? +mp[1] : (ma ? +ma[1] : -1);
    // Fondo: álbum o lista.
    if (albumIdx >= 0 && galData[albumIdx]) { if (shownAlbum !== albumIdx) openAlbum(albumIdx); }
    else if (shownAlbum !== -1) renderGalleryList();
    // Visor: abierto solo si el hash apunta a una foto válida; en cualquier otro caso se CIERRA
    // (esto es lo que arregla el bug de "atrás" dejando la imagen pegada).
    if (mp && galData[+mp[1]] && galData[+mp[1]].images[+mp[2]] != null) openLightbox(+mp[1], +mp[2]);
    else closeLightbox();
  }

  // Vista 3: visor a pantalla completa (se pasan las fotos a mano: flechas, puntos, teclado o deslizando).
  function ensureLightbox() {
    if (lb) return;
    lb = document.createElement('div');
    lb.className = 'lightbox'; lb.hidden = true;
    lb.innerHTML = `<div class="lb-back" data-lbclose></div>
      <button class="lb-btn lb-close" data-lbclose aria-label="Cerrar">✕</button>
      <button class="lb-btn lb-nav lb-prev" aria-label="Foto anterior">‹</button>
      <button class="lb-btn lb-nav lb-next" aria-label="Foto siguiente">›</button>
      <div class="lb-stage" role="dialog" aria-modal="true" aria-label="Foto de la galería">
        <div class="lb-imgwrap"><img class="lb-img" alt=""></div>
        <p class="lb-cap"></p>
        <div class="lb-dots"></div>
      </div>`;
    document.body.appendChild(lb);
    lb.querySelectorAll('[data-lbclose]').forEach(e => e.onclick = dismissLightbox);
    lb.querySelector('.lb-prev').onclick = () => step(-1);
    lb.querySelector('.lb-next').onclick = () => step(1);
    // Deslizar con el dedo para pasar las fotos (celular).
    let x0 = null;
    const wrap = lb.querySelector('.lb-imgwrap');
    wrap.addEventListener('touchstart', e => { x0 = e.changedTouches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); x0 = null; }, { passive: true });
    document.addEventListener('keydown', (e) => {
      if (!lb || lb.hidden) return;
      if (e.key === 'Escape') dismissLightbox();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    });
  }
  function openLightbox(itemIdx, startIdx) {
    ensureLightbox();
    lbState.item = itemIdx; lbState.idx = startIdx || 0;
    lb.hidden = false; document.body.style.overflow = 'hidden';
    paintLightbox();
  }
  // Cierre "puro" (lo llama routeGallery). NO toca el historial.
  function closeLightbox() { if (lb && !lb.hidden) { lb.hidden = true; document.body.style.overflow = ''; } }
  // Cierre por el usuario (X / fondo / Esc): vuelve al álbum a través del historial → el hash queda consistente.
  function dismissLightbox() { goBackTo('#album' + lbState.item); }
  function step(d) {
    const n = curImages().length; if (!n) return;
    lbState.idx = (lbState.idx + d + n) % n;
    history.replaceState(null, '', '#album' + lbState.item + '/' + lbState.idx);   // mantiene la URL en sync, sin añadir historial
    paintLightbox();
  }
  function paintLightbox() {
    const it = galData[lbState.item]; if (!it) return;
    const imgs = it.images, n = imgs.length, single = n <= 1;
    lb.querySelector('.lb-img').src = imgs[lbState.idx] || '';
    lb.querySelector('.lb-cap').innerHTML = `<strong>${esc(it.title)}</strong>${n > 1 ? ` · ${lbState.idx + 1}/${n}` : ''}`;
    const dots = lb.querySelector('.lb-dots');
    dots.innerHTML = single ? '' : imgs.map((_, i) => `<button class="lb-dot${i === lbState.idx ? ' on' : ''}" data-i="${i}" aria-label="Foto ${i + 1}"></button>`).join('');
    dots.querySelectorAll('.lb-dot').forEach(b => b.onclick = () => { lbState.idx = parseInt(b.dataset.i, 10); history.replaceState(null, '', '#album' + lbState.item + '/' + lbState.idx); paintLightbox(); });
    lb.querySelector('.lb-prev').style.display = single ? 'none' : '';
    lb.querySelector('.lb-next').style.display = single ? 'none' : '';
  }

  async function mountGallery(box) {
    await Store.ready;
    galBox = box;
    shownAlbum = -2; galDidNav = false;
    const items = await Store.posts.list({ type: 'galeria', publishedOnly: true });
    galData = items.map(p => ({ title: p.title, loc: (p.content_json && p.content_json.location) || '', excerpt: p.excerpt || '', images: galImages(p) }));
    ensureLightbox();
    routeGallery();
    window.addEventListener('hashchange', routeGallery);
  }

  async function mountCuentos(box) {
    await Store.ready;
    const posts = (await Store.posts.list({ publishedOnly: true })).filter(p => p.type !== 'galeria');
    const pub = posts.filter(p => !p.visibility || p.visibility === 'public');
    const restricted = posts.filter(p => p.visibility && p.visibility !== 'public');
    const visible = restricted.filter(p => Store.canSee(p.visibility, p));
    const u = Store.auth.user();
    let html = '';
    html += pub.length ? `<div class="post-grid">${pub.map(postCard).join('')}</div>` : '<p class="note">Próximamente más publicaciones.</p>';
    // Lo reservado que el visitante SÍ puede ver (miembro registrado de ese grupo).
    if (visible.length) {
      html += head(`Para nuestra comunidad ${LOCKSM}`);
      html += `<div class="post-grid">${visible.map(postCard).join('')}</div>`;
    }
    // Invitación a quien aún no se ha registrado (los registrados ya ven lo de su grupo al instante).
    if (!u) {
      html += gate('Crea tu cuenta gratis para leer también los cuentos y artículos reservados para docentes y estudiantes. Es gratis y con tu propio correo.');
    }
    box.innerHTML = html;
  }

  async function mountResources(box) {
    await Store.ready;
    const res = await Store.resources.list();
    const u = Store.auth.user();
    const visible = res.filter(r => Store.canSee(r.visibility, r));
    const priv = visible.filter(r => r.visibility === 'privado');     // "Para ti" (compartido en privado)
    const normal = visible.filter(r => r.visibility !== 'privado');    // recursos normales (con filtro por tema)
    if (!visible.length && !u) {
      box.innerHTML = `<div class="res-empty">${DL}<h3>Aún no hay recursos publicados</h3><p class="note">Pronto Raquel subirá material didáctico para descargar.</p></div>`;
      return;
    }
    let html = '';
    // 1) Lo tuyo, arriba del todo, resaltado y FUERA del filtro por tema.
    if (priv.length) html += foryouBlock(priv, u);
    // 2) Recursos normales con filtros por tema (de lo que el visitante puede ver).
    const cats = [...new Set(normal.map(r => r.category || 'Otro'))];
    if (cats.length > 1) {
      html += `<div class="res-filters"><button class="rchip active" type="button" data-cat="all">Todos</button>`
        + cats.map(c => `<button class="rchip" type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join('') + `</div>`;
    }
    if (normal.length) html += `<div class="downloads" id="resGrid">${normal.map(resItem).join('')}</div>`;
    // 3) Invitación honesta a quien aún no se ha registrado.
    if (!u) {
      html += gate('Todo esto es abierto y gratis, sin registrarte. Crea tu cuenta gratis si además quieres el material reservado para docentes y estudiantes — es gratis y con tu propio correo.');
    }
    box.innerHTML = html;
    // Filtrar por tema sin recargar
    box.querySelectorAll('.rchip').forEach(c => c.onclick = () => {
      box.querySelectorAll('.rchip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      const cat = c.dataset.cat;
      box.querySelectorAll('#resGrid .dl-card').forEach(card => { card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none'; });
    });
    // Descargar archivos subidos al sitio (los links de Drive/web usan su propio <a>)
    box.querySelectorAll('[data-res]').forEach(a => a.onclick = async (e) => {
      e.preventDefault();
      const r = res.find(x => x.id === a.dataset.res);
      const url = r && await Store.resources.url(r);
      if (!url) { alert('Archivo no disponible.'); return; }
      const l = document.createElement('a'); l.href = url; if (r.file_name) l.download = r.file_name; l.target = '_blank';
      document.body.appendChild(l); l.click(); l.remove();
    });
    // Vista previa embebida del PDF de Google Drive (se carga solo al pulsar)
    box.querySelectorAll('[data-prev]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault();
      const card = btn.closest('.dl-card'); if (!card) return;
      const pv = card.querySelector('.dl-prevbox'); if (!pv) return;
      if (!pv.hasAttribute('hidden')) { pv.setAttribute('hidden', ''); pv.innerHTML = ''; btn.textContent = 'Vista previa'; return; }
      pv.innerHTML = `<iframe src="${esc(btn.dataset.src)}" loading="lazy" title="Vista previa del recurso" allow="autoplay"></iframe>`;
      pv.removeAttribute('hidden'); btn.textContent = 'Ocultar';
    });
  }

  async function mountArticle(box) {
    await Store.ready;
    const id = new URLSearchParams(location.search).get('id');
    const p = id ? await Store.posts.get(id) : null;
    if (!p || !p.published) { box.innerHTML = '<div class="container" style="max-width:60ch"><p class="note">No encontramos esta publicación.</p><p style="margin-top:14px"><a class="btn btn-light" href="cuentos">← Ver cuentos</a></p></div>'; return; }
    document.title = p.title + ' · La Oda de las Charamuscas';
    if (!Store.canSee(p.visibility)) {
      box.innerHTML = `<div class="container" style="max-width:60ch"><p class="eyebrow">${p.type === 'cuento' ? 'Cuento' : 'Artículo'}</p><h1 style="font-size:clamp(2rem,5vw,2.8rem);margin-bottom:20px">${esc(p.title)}</h1><div class="gate">${LOCK}<h3 style="margin-bottom:6px">Contenido para la comunidad</h3><p>Crea tu cuenta gratis para leer esta publicación.</p><a class="btn btn-primary" href="entrar" style="margin-top:14px">Entrar</a></div></div>`;
      return;
    }
    const cover = p.cover_url ? `<img class="cover-hero" src="${esc(p.cover_url)}" alt="">` : '';
    const video = p.video_url ? ytEmbed(p.video_url) : '';
    box.innerHTML = `<div class="container" style="max-width:64ch">${cover}<p class="eyebrow">${p.type === 'cuento' ? 'Cuento' : 'Artículo'}</p><h1 style="font-size:clamp(2rem,5vw,3rem);margin-bottom:18px">${esc(p.title)}</h1><div class="prose">${video}${blocksToHtml(p.content_json)}</div><p style="margin-top:34px"><a class="btn btn-light" href="cuentos">← Volver a cuentos</a></p></div>`;
  }

  window.ElNido = { ytEmbed, blocksToHtml };

  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('cuentosDinamicos'); if (c) mountCuentos(c);
    const r = document.getElementById('recursosDinamicos'); if (r) mountResources(r);
    const a = document.getElementById('article'); if (a) mountArticle(a);
    const g = document.getElementById('galeriaDinamica'); if (g) mountGallery(g);
    // re-render al cambiar sesión (para que aparezcan/desaparezcan los de miembros)
    if (window.Store) Store.auth.onChange(() => { if (c) mountCuentos(c); if (r) mountResources(r); if (a) mountArticle(a); if (g) mountGallery(g); });
  });
})();
