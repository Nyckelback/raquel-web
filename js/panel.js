/* ============================================================
   El Nido — Panel de administración (solo Raquel)
   ============================================================ */
(async () => {
  const CFG = window.ELNIDO_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtSize = (b) => !b ? '' : (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  let editor = null;
  function destroyEditor() { if (editor && editor.destroy) { try { editor.destroy(); } catch (e) {} } editor = null; }

  await Store.ready;
  const user = Store.auth.user();
  if (!user || user.role !== 'admin') { location.href = 'entrar.html'; return; }
  $('#loading').style.display = 'none';
  $('#app').style.display = 'grid';

  $('#logout').onclick = async () => { await Store.auth.signOut(); location.href = 'index.html'; };

  /* ---- navegación entre secciones ---- */
  const segs = { resumen: renderResumen, posts: renderPosts, recursos: renderRecursos, estudiantes: renderEstudiantes, mensajes: renderMensajes };
  function switchSeg(name) {
    destroyEditor();
    document.querySelectorAll('.pside a').forEach(a => a.classList.toggle('active', a.dataset.seg === name));
    document.querySelectorAll('.seg').forEach(s => s.classList.remove('active'));
    $('#seg-' + name).classList.add('active');
    segs[name]();
  }
  document.querySelectorAll('.pside a').forEach(a => a.onclick = () => switchSeg(a.dataset.seg));

  /* ---- optimización de imágenes (ahorra espacio) ---- */
  async function optimizeImage(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    try {
      const img = await createImageBitmap(file);
      const maxW = CFG.IMAGE_MAX_WIDTH || 1600;
      const scale = Math.min(1, maxW / img.width);
      if (scale >= 1 && file.size < 320 * 1024) return file;
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.82));
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
    } catch (e) { return file; }
  }

  /* ============================ RESUMEN ============================ */
  async function renderResumen() {
    const [posts, res, studs, leads] = await Promise.all([Store.posts.list(), Store.resources.list(), Store.students.list(), Store.leads.list()]);
    const pend = studs.filter(s => s.status !== 'approved').length;
    $('#seg-resumen').innerHTML = `
      <div class="phead"><div><h1>Hola, ${esc(user.full_name.split(' ')[0])} 🌿</h1><p class="note">Este es tu nido. Sube contenido y gestiona tu comunidad.</p></div></div>
      <div class="pcards">
        <div class="pstat"><div class="n">${posts.length}</div><div class="l">Cuentos y artículos</div></div>
        <div class="pstat"><div class="n">${res.length}</div><div class="l">Recursos</div></div>
        <div class="pstat"><div class="n">${pend}</div><div class="l">Estudiantes por aprobar</div></div>
        <div class="pstat"><div class="n">${leads.length}</div><div class="l">Mensajes recibidos</div></div>
      </div>
      <div style="margin-top:22px;display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary" id="qPost">+ Nuevo cuento o artículo</button>
        <button class="btn btn-light" id="qRes">+ Subir un recurso</button>
      </div>
      ${Store.mode === 'demo' ? '<div class="demo-tip" style="margin-top:22px">Estás en <strong>modo demo</strong>: lo que subas se guarda solo en este navegador. Cuando conectemos Supabase, será permanente y visible para todos.</div>' : ''}`;
    $('#qPost').onclick = () => { switchSeg('posts'); setTimeout(() => openEditor(null), 50); };
    $('#qRes').onclick = () => { switchSeg('recursos'); setTimeout(() => $('#resTitle') && $('#resTitle').focus(), 50); };
  }

  /* ============================ POSTS ============================ */
  async function renderPosts() {
    const seg = $('#seg-posts');
    const posts = await Store.posts.list();
    seg.innerHTML = `<div class="phead"><div><h1>Cuentos y artículos</h1><p class="note">Tu escritura, con texto, imágenes y videos. Decide quién lo ve.</p></div><button class="btn btn-primary" id="newPost">+ Nuevo</button></div><div id="postList"></div>`;
    const list = $('#postList');
    if (!posts.length) list.innerHTML = '<p class="note">Aún no hay publicaciones. ¡Crea la primera!</p>';
    posts.forEach(p => {
      const row = document.createElement('div'); row.className = 'prow';
      row.innerHTML = `<div class="grow"><strong>${esc(p.title)}</strong><small>${p.type === 'cuento' ? 'Cuento' : 'Artículo'} · ${p.published ? 'Publicado' : 'Borrador'}</small></div>
        <span class="tag">${p.visibility === 'members' ? 'Miembros' : 'Público'}</span>
        <button class="iconbtn" data-edit="${p.id}">Editar</button><button class="iconbtn danger" data-del="${p.id}">Eliminar</button>`;
      list.appendChild(row);
    });
    $('#newPost').onclick = () => openEditor(null);
    list.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => openEditor(await Store.posts.get(b.dataset.edit)));
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('¿Eliminar esta publicación?')) { await Store.posts.remove(b.dataset.del); renderPosts(); } });
  }

  function initEditor(data) {
    const ListTool = window.EditorjsList || window.List;
    if (!window.EditorJS) { // fallback simple
      const t = (data && data.blocks || []).map(b => b.data && b.data.text || '').join('\n\n');
      $('#editorjs').innerHTML = `<textarea id="plainBody" style="width:100%;min-height:220px;border:none;background:transparent;font-family:var(--sans);font-size:1rem;resize:vertical">${esc(t)}</textarea>`;
      editor = { save: async () => ({ blocks: $('#plainBody').value.split(/\n{2,}/).filter(Boolean).map(p => ({ type: 'paragraph', data: { text: p } })) }), destroy: () => {} };
      return;
    }
    const uploader = { uploadByFile: async (file) => { const f = await optimizeImage(file); const r = await Store.uploadImage(f); if (!r || r.error || !r.url) { alert('No se pudo subir la imagen: ' + ((r && r.error) || 'error')); return { success: 0 }; } return { success: 1, file: { url: r.url } }; }, uploadByUrl: async (url) => ({ success: 1, file: { url } }) };
    const tools = { paragraph: { inlineToolbar: true } };
    if (window.Header) tools.header = { class: window.Header, inlineToolbar: true };
    if (ListTool) tools.list = { class: ListTool, inlineToolbar: true };
    if (window.Quote) tools.quote = window.Quote;
    if (window.Embed) tools.embed = { class: window.Embed, config: { services: { youtube: true } } };
    if (window.ImageTool) tools.image = { class: window.ImageTool, config: { uploader } };
    editor = new window.EditorJS({ holder: 'editorjs', tools, data: data || { blocks: [] }, placeholder: 'Escribe aquí tu cuento o artículo…' });
  }

  async function openEditor(post) {
    const seg = $('#seg-posts');
    const p = post || { type: 'cuento', visibility: 'public', published: true, content_json: { blocks: [] }, cover_url: '', video_url: '', excerpt: '', expires_at: null };
    seg.innerHTML = `
      <div class="phead"><div><button class="iconbtn" id="back">← Volver</button></div><div class="inline"><button class="btn btn-light" id="cancel">Cancelar</button><button class="btn btn-primary" id="save">Guardar</button></div></div>
      <div class="editor-box">
        <div class="field"><label class="lab">Título</label><input id="fTitle" type="text" value="${esc(p.title || '')}" placeholder="El título de tu cuento o artículo"></div>
        <div class="grid2">
          <div class="field"><label class="lab">Tipo</label><select id="fType"><option value="cuento"${p.type === 'cuento' ? ' selected' : ''}>Cuento / lírica</option><option value="articulo"${p.type === 'articulo' ? ' selected' : ''}>Artículo</option></select></div>
          <div class="field"><label class="lab">¿Quién lo ve?</label><select id="fVis"><option value="public"${p.visibility === 'public' ? ' selected' : ''}>Público (todos)</option><option value="members"${p.visibility === 'members' ? ' selected' : ''}>Solo miembros</option></select></div>
        </div>
        <div class="field"><label class="lab">Resumen corto (aparece en la lista)</label><input id="fExc" type="text" value="${esc(p.excerpt || '')}" placeholder="Una frase que invite a leer"></div>
        <div class="grid2">
          <div class="field"><label class="lab">Imagen de portada (opcional)</label><input id="fCover" type="file" accept="image/*"><div id="coverPrev" style="margin-top:8px">${p.cover_url ? `<img src="${esc(p.cover_url)}" style="max-height:90px;border-radius:8px">` : ''}</div></div>
          <div class="field"><label class="lab">Video de YouTube (opcional, pega el link)</label><input id="fVideo" type="url" value="${esc(p.video_url || '')}" placeholder="https://youtu.be/..."></div>
        </div>
        <div class="field"><label class="lab">Contenido</label><div id="editorjs"></div><p class="note" style="margin-top:6px">Usa el botón + para añadir títulos, listas, citas, imágenes o videos.</p></div>
        <div class="inline" style="margin-top:6px">
          <label class="switchrow"><input type="checkbox" id="fPub" ${p.published ? 'checked' : ''}> Publicado</label>
          <div class="field" style="margin:0"><label class="lab">Vence (opcional)</label><input id="fExp" type="date" value="${p.expires_at || ''}"></div>
        </div>
      </div>`;
    initEditor(p.content_json);
    let coverUrl = p.cover_url || '';
    $('#fCover').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const opt = await optimizeImage(f);
      const r = await Store.uploadImage(opt);
      if (!r || r.error || !r.url) { alert('No se pudo subir la imagen: ' + ((r && r.error) || 'error')); e.target.value = ''; return; }
      coverUrl = r.url; $('#coverPrev').innerHTML = `<img src="${esc(coverUrl)}" style="max-height:90px;border-radius:8px">`;
    };
    $('#back').onclick = $('#cancel').onclick = () => { destroyEditor(); renderPosts(); };
    $('#save').onclick = async () => {
      const title = $('#fTitle').value.trim(); if (!title) return alert('Ponle un título.');
      let content_json = { blocks: [] }; try { content_json = await editor.save(); } catch (e) {}
      const payload = { id: p.id, slug: p.slug, type: $('#fType').value, title, excerpt: $('#fExc').value.trim(), visibility: $('#fVis').value, published: $('#fPub').checked, video_url: $('#fVideo').value.trim(), cover_url: coverUrl, expires_at: $('#fExp').value || null, content_json };
      const btn = $('#save'); btn.textContent = 'Guardando…'; btn.disabled = true;
      try {
        const r = await Store.posts.save(payload);
        if (!r || r.error) { alert('No se pudo guardar: ' + ((r && r.error) || 'error') + '\nTu texto sigue aquí.'); return; }
        destroyEditor(); renderPosts();
      } catch (e) { alert('Error al guardar: ' + (e && e.message || e)); }
      finally { const b = $('#save'); if (b) { b.textContent = 'Guardar'; b.disabled = false; } }
    };
  }

  /* ============================ RECURSOS ============================ */
  async function renderRecursos() {
    const seg = $('#seg-recursos');
    const res = await Store.resources.list();
    seg.innerHTML = `
      <div class="phead"><div><h1>Recursos</h1><p class="note">Sube actividades, guías y archivos para descargar.</p></div></div>
      <div class="editor-box" style="margin-bottom:22px">
        <div class="grid2">
          <div class="field"><label class="lab">Título</label><input id="resTitle" type="text" placeholder="Nombre del recurso"></div>
          <div class="field"><label class="lab">Categoría</label><select id="resCat"><option>Docentes</option><option>Niños</option><option>Otro</option></select></div>
        </div>
        <div class="field"><label class="lab">Descripción corta</label><input id="resDesc" type="text" placeholder="¿De qué trata?"></div>
        <div class="grid2">
          <div class="field"><label class="lab">¿Quién lo descarga?</label><select id="resVis"><option value="public">Público (todos)</option><option value="members">Solo miembros</option></select></div>
          <div class="field"><label class="lab">Archivo (máx ${CFG.MAX_FILE_MB || 25} MB)</label><input id="resFile" type="file"></div>
        </div>
        <div class="inline">
          <button class="btn btn-primary" id="resSave">Subir recurso</button>
          <span id="resMsg" class="note"></span>
        </div>
      </div>
      <div id="resList"></div>`;
    const list = $('#resList');
    if (!res.length) list.innerHTML = '<p class="note">Aún no hay recursos.</p>';
    res.forEach(r => {
      const row = document.createElement('div'); row.className = 'prow';
      row.innerHTML = `<div class="grow"><strong>${esc(r.title)}</strong><small>${esc(r.category || '')} · ${esc(r.file_name || '')} ${r.file_size ? '· ' + fmtSize(r.file_size) : ''}</small></div>
        <span class="tag">${r.visibility === 'members' ? 'Miembros' : 'Público'}</span>
        <button class="iconbtn danger" data-del="${r.id}">Eliminar</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('¿Eliminar este recurso?')) { await Store.resources.remove(b.dataset.del); renderRecursos(); } });
    $('#resSave').onclick = async () => {
      const title = $('#resTitle').value.trim(); const file = $('#resFile').files[0];
      if (!title) return alert('Ponle un título.');
      if (!file) return alert('Elige un archivo.');
      const maxB = (CFG.MAX_FILE_MB || 25) * 1048576;
      if (file.size > maxB) return alert('El archivo supera el límite de ' + (CFG.MAX_FILE_MB || 25) + ' MB.');
      $('#resMsg').textContent = 'Subiendo…'; $('#resSave').disabled = true;
      const meta = { title, description: $('#resDesc').value.trim(), category: $('#resCat').value, visibility: $('#resVis').value, expires_at: null };
      try {
        const r = await Store.resources.save(meta, file);   // se sube tal cual (no se renombra ni recomprime)
        if (r && r.error) { $('#resMsg').textContent = 'Error: ' + r.error; return; }
        renderRecursos();
      } catch (e) { $('#resMsg').textContent = 'Error: ' + (e && e.message || e); }
      finally { const b = $('#resSave'); if (b) b.disabled = false; }
    };
  }

  /* ============================ ESTUDIANTES ============================ */
  async function renderEstudiantes() {
    const seg = $('#seg-estudiantes');
    const studs = await Store.students.list();
    seg.innerHTML = `<div class="phead"><div><h1>Estudiantes y docentes</h1><p class="note">Aprueba quién puede ver el contenido para miembros.</p></div></div><div id="stuList"></div>`;
    const list = $('#stuList');
    if (!studs.length) list.innerHTML = '<p class="note">Nadie se ha registrado todavía.</p>';
    studs.forEach(s => {
      const row = document.createElement('div'); row.className = 'prow';
      const approved = s.status === 'approved';
      row.innerHTML = `<div class="grow"><strong>${esc(s.full_name || s.email)}</strong><small>${esc(s.email)} · ${approved ? 'Aprobado' : 'Pendiente'}</small></div>
        ${approved ? `<button class="iconbtn" data-rev="${s.id}">Quitar acceso</button>` : `<button class="iconbtn" data-app="${s.id}" style="border-color:var(--secondary);color:var(--primary)">Aprobar</button>`}`;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-app]').forEach(b => b.onclick = async () => { await Store.students.setStatus(b.dataset.app, 'approved'); renderEstudiantes(); });
    list.querySelectorAll('[data-rev]').forEach(b => b.onclick = async () => { await Store.students.setStatus(b.dataset.rev, 'pending'); renderEstudiantes(); });
  }

  /* ============================ MENSAJES ============================ */
  async function renderMensajes() {
    const seg = $('#seg-mensajes');
    const leads = await Store.leads.list();
    seg.innerHTML = `<div class="phead"><div><h1>Mensajes</h1><p class="note">Personas interesadas en tus asesorías.</p></div></div><div id="leadList"></div>`;
    const list = $('#leadList');
    if (!leads.length) list.innerHTML = '<p class="note">Aún no hay mensajes. Llegan desde el formulario de Asesorías.</p>';
    leads.forEach(l => {
      const row = document.createElement('div'); row.className = 'prow';
      const date = (l.created_at || '').slice(0, 10);
      row.innerHTML = `<div class="grow"><strong>${esc(l.name || 'Sin nombre')}</strong><small>${esc(l.email || '')} ${l.type ? '· ' + esc(l.type) : ''} ${date ? '· ' + date : ''}</small>${l.message ? `<div style="margin-top:6px;font-size:.9rem">${esc(l.message)}</div>` : ''}</div>
        ${l.email ? `<a class="iconbtn" href="mailto:${esc(l.email)}">Responder</a>` : ''}`;
      list.appendChild(row);
    });
  }

  switchSeg('resumen');
})();
