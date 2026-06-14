/* ============================================================
   La Oda de las Charamuscas — Panel de administración (solo Raquel)
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
  $('#app').style.display = '';   // deja que el CSS decida (grid en desktop, block en móvil)

  $('#logout').onclick = async () => { await Store.auth.signOut(); location.href = 'index.html'; };

  /* ---- navegación entre secciones ---- */
  const segs = { resumen: renderResumen, perfil: renderPerfil, pagina: renderPagina, posts: renderPosts, recursos: renderRecursos, galeria: renderGaleria, estudiantes: renderEstudiantes, mensajes: renderMensajes };
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

  /* ============================ MI PERFIL ============================ */
  async function renderPerfil() {
    const seg = $('#seg-perfil');
    const u = Store.auth.user();
    let avatarUrl = u.avatar_url || '';
    const ini = (u.full_name || u.email || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    seg.innerHTML = `
      <div class="phead"><div><h1>Mi perfil</h1><p class="note">Tu foto y tu nombre aparecen en la página “Quién soy”.</p></div></div>
      <div class="editor-box" style="max-width:460px">
        <div class="cuenta-ava" id="pfAva">${ini}</div>
        <div style="text-align:center;margin-bottom:18px"><label class="btn btn-light" style="cursor:pointer">Cambiar foto<input id="pfFoto" type="file" accept="image/*" hidden></label></div>
        <div class="field"><label class="lab">Tu nombre</label><input id="pfNombre" type="text" value="${esc(u.full_name || '')}"></div>
        <div class="inline"><button class="btn btn-primary" id="pfSave">Guardar</button><span id="pfMsg" class="note"></span></div>
      </div>`;
    const paint = () => { $('#pfAva').innerHTML = avatarUrl ? `<img src="${esc(avatarUrl)}" alt="">` : ini; };
    paint();
    $('#pfFoto').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = await Store.uploadAvatar(await optimizeImage(f));
      if (!r || r.error || !r.url) { alert('No se pudo subir la foto: ' + ((r && r.error) || 'error')); return; }
      avatarUrl = r.url; paint();
    };
    $('#pfSave').onclick = async () => {
      $('#pfSave').disabled = true;
      const r = await Store.profile.updateMe({ full_name: $('#pfNombre').value.trim(), avatar_url: avatarUrl });
      $('#pfSave').disabled = false;
      $('#pfMsg').textContent = (r && r.error) ? ('Error: ' + r.error) : '¡Guardado!';
    };
  }

  /* ============================ EDITAR PÁGINA (mini-CMS) ============================ */
  async function renderPagina() {
    const seg = $('#seg-pagina');
    const c = await Store.content.getAll();
    const fields = [
      { k: 'hero_subtitle',  label: 'Inicio · Texto de presentación',  def: 'Recursos, cuentos y acompañamiento pedagógico para docentes, niños y familias — para que el asombro vuelva a volar en el aula.', ml: true },
      { k: 'proposito',      label: 'Inicio · Frase “Mi propósito”',  def: 'Rescatar la memoria biocultural que se desvanece con nuestros mayores, y reavivar el asombro de los niños a través de la palabra y el juego.', ml: true },
      { k: 'quien_bio',      label: 'Quién soy · Presentación',       def: 'Soy maestra de educación inicial y primaria. Llevo años acompañando a niñas, niños y colegas en las aulas rurales del Caribe colombiano…', ml: true },
      { k: 'recursos_title', label: 'Recursos · Título',              def: 'Material listo para tu aula', ml: false },
      { k: 'recursos_intro', label: 'Recursos · Texto de intro',      def: 'Actividades y reactivos pedagógicos que he creado y probado en el aula rural, para que los descargues, imprimas y los repliques con tus estudiantes.', ml: true },
      { k: 'cuentos_intro',  label: 'Cuentos · Texto de intro',       def: 'Una compilación literaria que convive con las emociones: escritura que convierte el mutismo en asombro y creatividad.', ml: true },
      { k: 'colaboradores',  label: 'Inicio · Colaboradores (se muestra solo si escribes algo)', def: 'Nombra a quienes colaboran contigo (docentes, comunidad, instituciones)…', ml: true },
      { k: 'proyecto_estado',label: 'El proyecto · Avance para el comité (se muestra solo si escribes algo)', def: 'Título de la tesis, universidad, línea de investigación y estado del avance…', ml: true }
    ];
    let heroImg = c['hero_image'] || '';
    const DEF_IMG = 'assets/img/mariposa-hero.webp';
    const DEF_LEAD = fields.find(f => f.k === 'hero_subtitle').def;
    seg.innerHTML = `
      <div class="phead"><div><h1>Editar página</h1><p class="note">Cambia la foto principal y los textos. A la derecha ves cómo va quedando la portada. Lo que dejes vacío usa lo de por defecto.</p></div></div>
      <div class="cms-grid">
        <div class="editor-box">
          <h3 class="cms-h">Inicio · Foto de portada</h3>
          <div style="margin-bottom:6px"><label class="btn btn-light" style="cursor:pointer">Cambiar foto<input id="heroFotoInput" type="file" accept="image/*" hidden></label></div>
          <p class="note">Mejor horizontal y nítida (mín. 800px de ancho). <strong>Se recorta sola</strong> al recuadro — no se daña el diseño. <span id="heroFotoMsg"></span></p>
          <div class="field" style="margin-top:14px"><label class="lab">Etiqueta de la foto</label><input id="sc_hero_caption" type="text" placeholder="Foto de Raquel · Monte Firme" value="${esc(c['hero_caption'] || '')}"></div>
          <h3 class="cms-h">Textos</h3>
          ${fields.map(f => `<div class="field"><label class="lab">${esc(f.label)}</label>${f.ml
            ? `<textarea id="sc_${f.k}" rows="3" placeholder="${esc(f.def)}">${esc(c[f.k] || '')}</textarea>`
            : `<input id="sc_${f.k}" type="text" placeholder="${esc(f.def)}" value="${esc(c[f.k] || '')}">`}</div>`).join('')}
          <div class="inline"><button class="btn btn-primary" id="scSave">Guardar cambios</button><span id="scMsg" class="note"></span></div>
        </div>
        <div class="cms-preview">
          <p class="lab" style="margin-bottom:8px">Vista previa de la portada 👀</p>
          <div class="prev-hero">
            <div class="prev-img" id="prevImg"></div>
            <div class="prev-txt">
              <div class="prev-eyebrow">Raquel Sofía Díaz González · Proyecto doctoral</div>
              <div class="prev-title">La Oda de las <em>Charamuscas</em></div>
              <div class="prev-sub">de la Jaula al Nido</div>
              <div class="prev-lead" id="prevLead"></div>
            </div>
          </div>
          <p class="note" style="margin-top:10px">Así queda. Dale <strong>Guardar</strong> y recarga el sitio para verlo en vivo.</p>
        </div>
      </div>`;
    const paint = () => {
      const img = heroImg || DEF_IMG;
      $('#prevImg').style.backgroundImage = `url('${img}')`;
      $('#prevImg').setAttribute('data-cap', $('#sc_hero_caption').value.trim() || 'Foto de Raquel · Monte Firme');
      $('#prevLead').textContent = $('#sc_hero_subtitle').value.trim() || DEF_LEAD;
    };
    paint();
    $('#sc_hero_caption').oninput = paint;
    $('#sc_hero_subtitle').oninput = paint;
    $('#heroFotoInput').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      $('#heroFotoMsg').textContent = 'Subiendo…';
      let small = false;
      try { const b = await createImageBitmap(f); small = b.width < 700; } catch (_) {}
      const r = await Store.uploadImage(await optimizeImage(f));
      if (!r || r.error || !r.url) { $('#heroFotoMsg').textContent = 'No se pudo subir: ' + ((r && r.error) || 'error'); return; }
      heroImg = r.url; paint();
      $('#heroFotoMsg').textContent = small ? '⚠ Foto pequeña: puede verse algo borrosa (igual la guardo).' : '✓ Foto lista (dale Guardar).';
    };
    $('#scSave').onclick = async () => {
      const patch = { hero_image: heroImg, hero_caption: $('#sc_hero_caption').value.trim() };
      fields.forEach(f => { patch[f.k] = ($('#sc_' + f.k).value || '').trim(); });
      $('#scSave').disabled = true; $('#scMsg').textContent = 'Guardando…';
      const r = await Store.content.save(patch);
      $('#scSave').disabled = false;
      $('#scMsg').textContent = (r && r.error) ? ('Error: ' + r.error) : '¡Guardado! Recarga el sitio (Cmd+Shift+R) para verlo.';
    };
  }

  /* ============================ POSTS ============================ */
  async function renderPosts() {
    const seg = $('#seg-posts');
    const posts = (await Store.posts.list()).filter(p => p.type !== 'galeria');
    seg.innerHTML = `<div class="phead"><div><h1>Cuentos y artículos</h1><p class="note">Tu escritura, con texto e imágenes. Decide quién lo ve.</p></div><button class="btn btn-primary" id="newPost">+ Nuevo</button></div><div id="postList"></div>`;
    const list = $('#postList');
    if (!posts.length) list.innerHTML = '<p class="note">Aún no hay publicaciones. ¡Crea la primera!</p>';
    posts.forEach(p => {
      const row = document.createElement('div'); row.className = 'prow';
      const pVis = { public: 'Público', members: 'Miembros', docentes: 'Docentes', estudiantes: 'Estudiantes' }[p.visibility] || 'Público';
      row.innerHTML = `<div class="grow"><strong>${esc(p.title)}</strong><small>${p.type === 'cuento' ? 'Cuento' : 'Artículo'} · ${p.published ? 'Publicado' : 'Borrador'}</small></div>
        <span class="tag">${pVis}</span>
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
          <div class="field"><label class="lab">¿Quién lo ve?</label><select id="fVis">
            <option value="public"${p.visibility === 'public' ? ' selected' : ''}>Público (todos)</option>
            <option value="members"${p.visibility === 'members' ? ' selected' : ''}>Todos los miembros</option>
            <option value="docentes"${p.visibility === 'docentes' ? ' selected' : ''}>Solo docentes</option>
            <option value="estudiantes"${p.visibility === 'estudiantes' ? ' selected' : ''}>Solo estudiantes</option>
          </select></div>
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
          <div class="field"><label class="lab">Tema / área</label><select id="resCat"><option>Para docentes</option><option>Para los niños</option><option>Lenguaje</option><option>Matemáticas</option><option>Ciencias</option><option>Sociales</option><option>Proyecto transversal</option><option>Otro</option></select></div>
        </div>
        <div class="field"><label class="lab">Descripción corta</label><input id="resDesc" type="text" placeholder="¿De qué trata?"></div>
        <div class="grid2">
          <div class="field"><label class="lab">¿Quién lo descarga?</label><select id="resVis">
            <option value="public">Público (todos)</option>
            <option value="members">Todos los miembros</option>
            <option value="docentes">Solo docentes</option>
            <option value="estudiantes">Solo estudiantes</option>
            <option value="privado">Privado (solo las personas que elijas)</option>
          </select></div>
          <div class="field"><label class="lab">Archivo (máx ${CFG.MAX_FILE_MB || 25} MB)</label><input id="resFile" type="file"></div>
        </div>
        <div class="field"><label class="lab">…o pega un link de Google Drive / web (en vez de subir el archivo — no gasta espacio)</label><input id="resLink" type="url" placeholder="https://drive.google.com/..."><small id="resLinkHint" class="note" style="display:none;margin-top:6px"></small></div>
        <div class="field" id="resPersonWrap" style="display:none"><label class="lab">¿A quién(es) se lo asignas? <span style="font-weight:400;color:var(--muted)">(marca una o varias)</span></label><div id="resPersonList" class="chk-list"></div></div>
        <div class="field"><label class="lab">¿Temporal? Vence el (opcional · déjalo vacío si es permanente)</label><input id="resExp" type="date"></div>
        <div class="inline">
          <button class="btn btn-primary" id="resSave">Subir recurso</button>
          <span id="resMsg" class="note"></span>
        </div>
      </div>
      <div id="resList"></div>`;
    const people = await Store.students.list();   // cualquiera registrado (asignar algo puntual NO requiere aprobación)
    $('#resPersonList').innerHTML = people.length
      ? people.map(s => `<label class="chk-row"><input type="checkbox" value="${esc(s.id)}"> <span>${esc(s.full_name || s.email)} — ${esc(s.email)}</span></label>`).join('')
      : '<p class="note" style="margin:0">Aún no hay personas registradas. Cuando alguien cree su cuenta, aparece aquí para asignarle.</p>';
    $('#resVis').onchange = () => { $('#resPersonWrap').style.display = $('#resVis').value === 'privado' ? '' : 'none'; };
    $('#resLink').oninput = () => {
      const v = $('#resLink').value.trim(); const h = $('#resLinkHint');
      const isDrive = /drive\.google\.com|docs\.google\.com/.test(v) && /\/d\/|[?&]id=/.test(v);
      if (!v) { h.style.display = 'none'; return; }
      h.style.display = ''; h.style.color = isDrive ? 'var(--primary)' : 'var(--muted)';
      h.textContent = isDrive
        ? '✓ Link de Google Drive detectado. Ábrelo en Drive como “Cualquiera con el enlace” para que se vea la vista previa en la página.'
        : 'Link externo: se abrirá en otra pestaña (sin vista previa). Para vista previa en la página, usa un link de Google Drive.';
    };
    const list = $('#resList');
    if (!res.length) list.innerHTML = '<p class="note">Aún no hay recursos.</p>';
    res.forEach(r => {
      const row = document.createElement('div'); row.className = 'prow';
      const visLabel = { public: 'Público', members: 'Miembros', docentes: 'Docentes', estudiantes: 'Estudiantes', privado: 'Privado' }[r.visibility] || 'Público';
      const extra = r.visibility === 'privado' && r.assigned_name ? ` · Para: ${esc(r.assigned_name)}` : '';
      row.innerHTML = `<div class="grow"><strong>${esc(r.title)}</strong><small>${esc(r.category || '')} · ${esc(r.file_name || '')} ${r.file_size ? '· ' + fmtSize(r.file_size) : ''}${extra}</small></div>
        <span class="tag">${visLabel}</span>
        <button class="iconbtn danger" data-del="${r.id}">Eliminar</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('¿Eliminar este recurso?')) { await Store.resources.remove(b.dataset.del); renderRecursos(); } });
    $('#resSave').onclick = async () => {
      const title = $('#resTitle').value.trim(); const file = $('#resFile').files[0]; const link = $('#resLink').value.trim();
      if (!title) return alert('Ponle un título.');
      if (!file && !link) return alert('Sube un archivo o pega un link de Google Drive / web.');
      if (file) { const maxB = (CFG.MAX_FILE_MB || 25) * 1048576; if (file.size > maxB) return alert('El archivo supera el límite de ' + (CFG.MAX_FILE_MB || 25) + ' MB. Para archivos grandes, mejor pega un link de Google Drive.'); }
      const vis = $('#resVis').value;
      const meta = { title, description: $('#resDesc').value.trim(), category: $('#resCat').value, visibility: vis, expires_at: $('#resExp').value || null };
      if (link) { meta.link_url = link; meta.file_url = link; meta.file_name = 'Enlace externo'; meta.file_type = 'link'; meta.file_size = 0; }
      if (vis === 'privado') {
        const ids = [...$('#resPersonList').querySelectorAll('input:checked')].map(c => c.value);
        if (!ids.length) return alert('Marca al menos una persona para compartirle este material.');
        meta.assigned_to = ids;   // arreglo: una o varias personas
        meta.assigned_name = people.filter(s => ids.includes(s.id)).map(s => s.full_name || s.email).join(', ');
      }
      $('#resMsg').textContent = 'Subiendo…'; $('#resSave').disabled = true;
      try {
        const r = await Store.resources.save(meta, file);   // se sube tal cual (no se renombra ni recomprime)
        if (r && r.error) { $('#resMsg').textContent = 'Error: ' + r.error; return; }
        renderRecursos();
      } catch (e) { $('#resMsg').textContent = 'Error: ' + (e && e.message || e); }
      finally { const b = $('#resSave'); if (b) b.disabled = false; }
    };
  }

  /* ============================ GALERÍA ============================ */
  async function renderGaleria() {
    const seg = $('#seg-galeria');
    const items = await Store.posts.list({ type: 'galeria' });
    seg.innerHTML = `
      <div class="phead"><div><h1>Galería</h1><p class="note">Fotos de tus proyectos y actividades. Cada una con título, lugar y descripción.</p></div></div>
      <div class="editor-box" style="margin-bottom:22px">
        <div class="field"><label class="lab">Foto</label>
          <div><label class="btn btn-light" style="cursor:pointer">Elegir foto<input id="galFoto" type="file" accept="image/*" hidden></label> <span id="galFotoMsg" class="note"></span></div>
          <div id="galPrev" class="cms-thumb" style="display:none;margin-top:8px"></div></div>
        <div class="grid2">
          <div class="field"><label class="lab">Título</label><input id="galTitle" type="text" placeholder="Ej: Proyecto de aula en el Monte Firme"></div>
          <div class="field"><label class="lab">Lugar (opcional)</label><input id="galLoc" type="text" placeholder="Ej: Corozal, Sucre"></div>
        </div>
        <div class="field"><label class="lab">Descripción (opcional)</label><textarea id="galDesc" rows="2" placeholder="¿Qué se ve en la foto?"></textarea></div>
        <label class="switchrow" style="margin:4px 0 12px;align-items:flex-start"><input type="checkbox" id="galConsent" style="margin-top:3px"> <span>Confirmo que tengo permiso de las familias para publicar esta foto (sobre todo si aparecen menores).</span></label>
        <div class="inline"><button class="btn btn-primary" id="galSave">Subir a la galería</button><span id="galMsg" class="note"></span></div>
      </div>
      <div id="galList"></div>`;
    let imgUrl = '';
    $('#galFoto').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      $('#galFotoMsg').textContent = 'Subiendo…';
      const r = await Store.uploadImage(await optimizeImage(f));
      if (!r || r.error || !r.url) { $('#galFotoMsg').textContent = 'Error: ' + ((r && r.error) || 'no se pudo'); return; }
      imgUrl = r.url; const pv = $('#galPrev'); pv.style.display = ''; pv.style.backgroundImage = `url('${imgUrl}')`; $('#galFotoMsg').textContent = '✓ Foto lista';
    };
    const list = $('#galList');
    if (!items.length) list.innerHTML = '<p class="note">Aún no hay fotos en la galería.</p>';
    items.forEach(p => {
      const loc = (p.content_json && p.content_json.location) || '';
      const row = document.createElement('div'); row.className = 'prow';
      const thumb = p.cover_url ? `<div class="pavatar" style="background:url('${esc(p.cover_url)}') center/cover;border-radius:8px"></div>` : '';
      row.innerHTML = `${thumb}<div class="grow"><strong>${esc(p.title)}</strong><small>${esc(loc)}${p.excerpt ? ' · ' + esc(p.excerpt) : ''}</small></div><button class="iconbtn danger" data-del="${p.id}">Eliminar</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('¿Eliminar esta foto?')) { await Store.posts.remove(b.dataset.del); renderGaleria(); } });
    $('#galSave').onclick = async () => {
      const title = $('#galTitle').value.trim();
      if (!title) return alert('Ponle un título.');
      if (!imgUrl) return alert('Elige una foto.');
      if (!$('#galConsent').checked) return alert('Marca que tienes permiso de las familias para publicar la foto.');
      const payload = { type: 'galeria', title, excerpt: $('#galDesc').value.trim(), cover_url: imgUrl, content_json: { location: $('#galLoc').value.trim() }, visibility: 'public', published: true };
      $('#galMsg').textContent = 'Guardando…'; $('#galSave').disabled = true;
      const r = await Store.posts.save(payload);
      $('#galSave').disabled = false;
      if (r && r.error) { $('#galMsg').textContent = 'Error: ' + r.error; return; }
      renderGaleria();
    };
  }

  /* ============================ ESTUDIANTES ============================ */
  async function renderEstudiantes() {
    const seg = $('#seg-estudiantes');
    const studs = await Store.students.list();
    seg.innerHTML = `
      <div class="phead"><div><h1>Personas</h1><p class="note">Aprueba accesos y organiza por tipo. Busca por nombre o correo.</p></div></div>
      <input id="stuSearch" class="psearch" type="search" placeholder="Buscar por nombre o correo…" style="max-width:460px;margin-bottom:16px">
      <div class="pfilters" id="stuFilters">
        <button class="pchip active" data-f="all">Todos</button>
        <button class="pchip" data-f="docente">Docentes</button>
        <button class="pchip" data-f="estudiante">Estudiantes</button>
        <button class="pchip" data-f="familia">Familias</button>
        <button class="pchip" data-f="pending">Pendientes</button>
      </div>
      <div id="stuList"></div>`;
    let filter = 'all', q = '';
    function draw() {
      const list = $('#stuList');
      const rows = studs
        .filter(s => filter === 'pending' ? s.status !== 'approved' : (filter === 'all' ? true : s.tipo === filter))
        .filter(s => (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
      if (!rows.length) { list.innerHTML = '<p class="note">Nadie coincide con la búsqueda.</p>'; return; }
      list.innerHTML = '';
      rows.forEach(s => {
        const approved = s.status === 'approved';
        const ini = (s.full_name || s.email || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
        const ava = s.avatar_url ? `<img class="pavatar" src="${esc(s.avatar_url)}" alt="">` : `<div class="pavatar" style="display:flex;align-items:center;justify-content:center;font-size:.8rem;color:var(--ink)">${ini}</div>`;
        const row = document.createElement('div'); row.className = 'prow';
        row.innerHTML = `${ava}<div class="grow"><strong>${esc(s.full_name || s.email)}</strong><small>${esc(s.email)} · ${approved ? 'Aprobado' : 'Pendiente'}</small></div>
          <select class="iconbtn" data-tipo="${s.id}" title="Tipo">
            <option value="docente"${s.tipo === 'docente' ? ' selected' : ''}>Docente</option>
            <option value="estudiante"${s.tipo === 'estudiante' ? ' selected' : ''}>Estudiante</option>
            <option value="familia"${s.tipo === 'familia' ? ' selected' : ''}>Familia</option>
            <option value="otro"${(!s.tipo || s.tipo === 'otro') ? ' selected' : ''}>Otro</option>
          </select>
          ${approved ? `<button class="iconbtn" data-rev="${s.id}">Quitar acceso</button>` : `<button class="iconbtn" data-app="${s.id}" style="border-color:var(--secondary);color:var(--primary)">Aprobar</button>`}`;
        list.appendChild(row);
      });
      list.querySelectorAll('[data-app]').forEach(b => b.onclick = async () => { await Store.students.setStatus(b.dataset.app, 'approved'); const x = studs.find(p => p.id === b.dataset.app); if (x) { x.status = 'approved'; x.role = 'member'; } draw(); });
      list.querySelectorAll('[data-rev]').forEach(b => b.onclick = async () => { await Store.students.setStatus(b.dataset.rev, 'pending'); const x = studs.find(p => p.id === b.dataset.rev); if (x) x.status = 'pending'; draw(); });
      list.querySelectorAll('[data-tipo]').forEach(sel => sel.onchange = async () => { await Store.students.setTipo(sel.dataset.tipo, sel.value); const x = studs.find(p => p.id === sel.dataset.tipo); if (x) x.tipo = sel.value; });
    }
    $('#stuSearch').oninput = (e) => { q = e.target.value.toLowerCase().trim(); draw(); };
    $('#stuFilters').querySelectorAll('.pchip').forEach(c => c.onclick = () => { $('#stuFilters').querySelectorAll('.pchip').forEach(x => x.classList.remove('active')); c.classList.add('active'); filter = c.dataset.f; draw(); });
    draw();
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
