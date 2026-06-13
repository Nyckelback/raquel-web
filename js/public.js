/* ============================================================
   El Nido — render público de contenido dinámico
   Muestra cuentos/artículos y recursos que sube Raquel,
   reproduce videos de YouTube y aplica el candado de miembros.
   ============================================================ */
(function () {
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtSize = (b) => !b ? '' : (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

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

  const LOCKSM = '<svg style="width:16px;height:16px;vertical-align:-2px;color:var(--secondary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const head = (t) => `<div style="max-width:62ch;margin:46px 0 18px"><h2 style="font-size:clamp(1.5rem,3vw,2rem)">${t}</h2></div>`;
  function gate(msg) {
    return `<div class="gate">${LOCK}<h3 style="margin-bottom:6px">Contenido para miembros</h3><p>${esc(msg)}</p><a class="btn btn-primary" href="entrar.html" style="margin-top:14px">Entrar</a></div>`;
  }
  function postCard(p) {
    const ph = p.cover_url ? `<div class="ph" style="background-image:url('${esc(p.cover_url)}')"></div>` : `<div class="ph"></div>`;
    const badge = p.visibility === 'members' ? '<span class="badge-mem">Miembros</span>' : '';
    return `<a class="post-card" href="articulo.html?id=${encodeURIComponent(p.slug || p.id)}">${ph}<div class="pb"><h3>${esc(p.title)}</h3><p>${esc(p.excerpt || '')}</p><div class="meta">${p.type === 'cuento' ? 'Cuento' : 'Artículo'} ${badge}</div></div></a>`;
  }
  function resItem(r) {
    return `<div class="dl-item"><div class="dl-ico">${DL}</div><div class="dl-meta"><strong>${esc(r.title)}</strong><span>${esc(r.description || '')} ${r.file_size ? '· ' + fmtSize(r.file_size) : ''}</span></div><span class="dl-tag">${esc(r.category || 'Recurso')}</span><a class="btn btn-light" href="#" data-res="${r.id}">Descargar</a></div>`;
  }

  async function mountCuentos(box) {
    await Store.ready;
    const posts = await Store.posts.list({ publishedOnly: true });
    const pub = posts.filter(p => p.visibility !== 'members');
    const mem = posts.filter(p => p.visibility === 'members');
    const u = Store.auth.user();
    let html = '';
    html += pub.length ? `<div class="post-grid">${pub.map(postCard).join('')}</div>` : '<p class="note">Próximamente más publicaciones.</p>';
    if (mem.length) {
      html += head(`Solo para miembros ${LOCKSM}`);
      html += Store.canSee('members')
        ? `<div class="post-grid">${mem.map(postCard).join('')}</div>`
        : gate(u ? 'Tu acceso está pendiente de aprobación por Raquel.' : 'Inicia sesión (y pide acceso) para leer las publicaciones exclusivas.');
    }
    box.innerHTML = html;
  }

  async function mountResources(box) {
    await Store.ready;
    const res = await Store.resources.list();
    const pub = res.filter(r => r.visibility !== 'members');
    const mem = res.filter(r => r.visibility === 'members');
    const u = Store.auth.user();
    let html = '';
    if (pub.length) html += head('Más recursos públicos') + `<div class="downloads">${pub.map(resItem).join('')}</div>`;
    if (mem.length) {
      html += head(`Solo para miembros ${LOCKSM}`);
      html += Store.canSee('members')
        ? `<div class="downloads">${mem.map(resItem).join('')}</div>`
        : gate(u ? 'Tu acceso está pendiente de aprobación por Raquel.' : 'Inicia sesión (y pide acceso) para descargar los recursos exclusivos.');
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-res]').forEach(a => a.onclick = async (e) => {
      e.preventDefault();
      const r = res.find(x => x.id === a.dataset.res);
      const url = r && await Store.resources.url(r);
      if (!url) { alert('Archivo no disponible.'); return; }
      const l = document.createElement('a'); l.href = url; if (r.file_name) l.download = r.file_name; l.target = '_blank';
      document.body.appendChild(l); l.click(); l.remove();
    });
  }

  async function mountArticle(box) {
    await Store.ready;
    const id = new URLSearchParams(location.search).get('id');
    const p = id ? await Store.posts.get(id) : null;
    if (!p || !p.published) { box.innerHTML = '<div class="container" style="max-width:60ch"><p class="note">No encontramos esta publicación.</p><p style="margin-top:14px"><a class="btn btn-light" href="cuentos.html">← Ver cuentos</a></p></div>'; return; }
    document.title = p.title + ' · El Nido';
    if (!Store.canSee(p.visibility)) {
      box.innerHTML = `<div class="container" style="max-width:60ch"><p class="eyebrow">${p.type === 'cuento' ? 'Cuento' : 'Artículo'}</p><h1 style="font-size:clamp(2rem,5vw,2.8rem);margin-bottom:20px">${esc(p.title)}</h1><div class="gate">${LOCK}<h3 style="margin-bottom:6px">Contenido para miembros</h3><p>Inicia sesión para leer esta publicación completa.</p><a class="btn btn-primary" href="entrar.html" style="margin-top:14px">Entrar</a></div></div>`;
      return;
    }
    const cover = p.cover_url ? `<img class="cover-hero" src="${esc(p.cover_url)}" alt="">` : '';
    const video = p.video_url ? ytEmbed(p.video_url) : '';
    box.innerHTML = `<div class="container" style="max-width:64ch">${cover}<p class="eyebrow">${p.type === 'cuento' ? 'Cuento' : 'Artículo'}</p><h1 style="font-size:clamp(2rem,5vw,3rem);margin-bottom:18px">${esc(p.title)}</h1><div class="prose">${video}${blocksToHtml(p.content_json)}</div><p style="margin-top:34px"><a class="btn btn-light" href="cuentos.html">← Volver a cuentos</a></p></div>`;
  }

  window.ElNido = { ytEmbed, blocksToHtml };

  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('cuentosDinamicos'); if (c) mountCuentos(c);
    const r = document.getElementById('recursosDinamicos'); if (r) mountResources(r);
    const a = document.getElementById('article'); if (a) mountArticle(a);
    // re-render al cambiar sesión (para que aparezcan/desaparezcan los de miembros)
    if (window.Store) Store.auth.onChange(() => { if (c) mountCuentos(c); if (r) mountResources(r); if (a) mountArticle(a); });
  });
})();
