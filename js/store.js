/* ============================================================
   La Oda de las Charamuscas — Store (capa de datos)
   Dos modos:
     • DEMO    → guarda en localStorage (sin backend, para probar todo)
     • SUPABASE → backend real (Auth + Postgres + Storage)
   El resto del sitio usa SIEMPRE la misma API (Store.*), sin saber el modo.
   ============================================================ */
(function () {
  const cfg = window.ELNIDO_CONFIG || {};
  const MODE = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) ? 'supabase' : 'demo';
  const listeners = [];
  let currentUser = null;

  const uid = () => (self.crypto && self.crypto.randomUUID) ? self.crypto.randomUUID() : 'id' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const slugify = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
  const notify = () => listeners.forEach(cb => { try { cb(currentUser); } catch (e) {} });

  /* ---------------- helper de visibilidad ---------------- */
  function canSee(visibility, item) {
    const u = currentUser;
    if (visibility === 'public' || !visibility) return true;
    if (!u) return false;
    if (u.role === 'admin') return true;
    if (visibility === 'privado') return !!(item && item.assigned_to === u.id);   // asesoría individual
    const approved = u.role === 'member' && u.status === 'approved';
    if (!approved) return false;
    if (visibility === 'members') return true;
    if (visibility === 'docentes') return u.tipo === 'docente';
    if (visibility === 'estudiantes') return u.tipo === 'estudiante';
    return false;
  }
  const isAdmin = () => currentUser && currentUser.role === 'admin';

  /* ============================================================
     ADAPTADOR DEMO (localStorage)
     ============================================================ */
  const Demo = (() => {
    const DB_KEY = 'elnido_demo_db';
    const SESSION_KEY = 'elnido_demo_session';

    function seed() {
      return {
        profiles: [
          { id: 'admin-raquel', email: 'raquel@elnido.com', full_name: 'Raquel Sofía Díaz González', role: 'admin', status: 'approved', tipo: 'docente', avatar_url: '', created_at: '2026-06-01' },
          { id: 'stu-1', email: 'marta.docente@correo.com', full_name: 'Marta Pérez', role: 'member', status: 'pending', tipo: 'docente', avatar_url: '', created_at: '2026-06-10' },
          { id: 'stu-2', email: 'juan.estudiante@correo.com', full_name: 'Juan Estudiante', role: 'member', status: 'approved', tipo: 'estudiante', avatar_url: '', created_at: '2026-06-11' }
        ],
        posts: [
          {
            id: 'p1', type: 'cuento', title: 'Voló hierberito', slug: 'volo-hierberito',
            excerpt: 'El cuento más corto del mundo.',
            visibility: 'public', published: true, cover_url: 'assets/img/card-nido.webp', video_url: '', expires_at: null,
            content_json: { blocks: [
              { type: 'paragraph', data: { text: 'Voló hierberito. Entre charamuscas se refugió.' } },
              { type: 'paragraph', data: { text: 'Las charamuscas son pajitas secas, hierba endeble. Y son, también, la barrera invisible que ampara al niño frente a la incomprensión — hasta el día en que llega un maestro capaz de valorar su voz.' } },
              { type: 'paragraph', data: { text: '— Raquel Sofía Díaz González' } }
            ] },
            created_at: '2026-06-08'
          },
          {
            id: 'p2', type: 'articulo', title: 'La pedagogía del desarraigo', slug: 'pedagogia-del-desarraigo',
            excerpt: 'Salir de la rutina escolar para reencontrar el asombro en el territorio.',
            visibility: 'members', published: true, cover_url: 'assets/img/feature-monte.webp', video_url: '', expires_at: null,
            content_json: { blocks: [
              { type: 'header', data: { text: 'Del aula a la jaula al nido', level: 3 } },
              { type: 'paragraph', data: { text: 'Una reflexión para docentes sobre cómo restituir el contacto con la naturaleza y la palabra.' } }
            ] },
            created_at: '2026-06-09'
          }
        ],
        resources: [
          { id: 'r1', title: 'Guía: emociones y territorio', description: 'Alternativa al semáforo emocional', category: 'Docentes', visibility: 'public', file_name: 'guia-emociones.pdf', file_url: 'recursos-archivos/instrumentos-registro.pdf', file_type: 'application/pdf', file_size: 91386, expires_at: null, created_at: '2026-06-11' },
          { id: 'r2', title: 'Planeación anual (para miembros)', description: 'Formato de planeación de aula', category: 'Docentes', visibility: 'members', file_name: 'planeacion-anual.pdf', file_url: 'recursos-archivos/de-la-jaula-al-nido.pdf', file_type: 'application/pdf', file_size: 99780, expires_at: null, created_at: '2026-06-11' }
        ],
        leads: [],
        content: {}
      };
    }
    function read() { try { return JSON.parse(localStorage.getItem(DB_KEY)) || null; } catch (e) { return null; } }
    function write(db) { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { throw (e && (e.name === 'QuotaExceededError' || e.code === 22)) ? new Error('QUOTA') : e; } }
    function db() { let d = read(); if (!d) { d = seed(); write(d); } return d; }

    function fileToDataURL(file) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error || new Error('No se pudo leer el archivo'));
        r.onabort = () => rej(new Error('Lectura cancelada'));
        try { r.readAsDataURL(file); } catch (e) { rej(e); }
      });
    }

    return {
      async init() {
        try {
          const s = JSON.parse(localStorage.getItem(SESSION_KEY));
          if (s && s.id) {
            const prof = db().profiles.find(p => p.id === s.id);     // re-deriva del perfil vivo
            const known = s.id === 'stu-demo' || s.id === 'admin-raquel';
            currentUser = prof ? { ...prof } : (known ? s : null);
          }
        } catch (e) {}
      },
      async signIn(email, pw) {
        const d = db();
        const p = d.profiles.find(x => x.email.toLowerCase() === (email || '').toLowerCase());
        if (!p) return { error: 'No encontramos esa cuenta (en demo: usa raquel@elnido.com o regístrate).' };
        currentUser = { ...p }; localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser)); notify(); return {};
      },
      async signUp(email, pw, name, tipo) {
        const d = db();
        if (d.profiles.find(x => x.email.toLowerCase() === (email || '').toLowerCase())) return { error: 'Ese correo ya está registrado.' };
        const p = { id: uid(), email, full_name: name || email, role: 'member', status: 'pending', tipo: tipo || 'otro', avatar_url: '', created_at: new Date().toISOString().slice(0, 10) };
        d.profiles.push(p);
        try { write(d); } catch (e) { return { error: 'No se pudo crear la cuenta (espacio del navegador).' }; }
        currentUser = { ...p }; localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser)); notify();
        return { pending: true };
      },
      async demoLogin(role) {
        currentUser = role === 'admin'
          ? { id: 'admin-raquel', email: 'raquel@elnido.com', full_name: 'Raquel Sofía Díaz González', role: 'admin', status: 'approved', tipo: 'docente', avatar_url: '' }
          : { id: 'stu-demo', email: 'estudiante@demo.com', full_name: 'Estudiante demo', role: 'member', status: 'approved', tipo: 'estudiante', avatar_url: '' };
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser)); notify(); return {};
      },
      async signOut() { currentUser = null; localStorage.removeItem(SESSION_KEY); notify(); },

      async listPosts(opts = {}) {
        let r = db().posts.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        if (opts.type) r = r.filter(p => p.type === opts.type);
        if (opts.publishedOnly) r = r.filter(p => p.published);
        return r;
      },
      async getPost(idOrSlug) { return db().posts.find(p => p.id === idOrSlug || p.slug === idOrSlug) || null; },
      async savePost(post) {
        const d = db(); const now = new Date().toISOString().slice(0, 10);
        if (post.id) { const i = d.posts.findIndex(p => p.id === post.id); if (i >= 0) d.posts[i] = { ...d.posts[i], ...post, updated_at: now }; }
        else { post.id = uid(); post.slug = slugify(post.title) + '-' + post.id.replace(/[^a-z0-9]/gi, '').slice(0, 5); post.created_at = now; d.posts.push(post); }
        try { write(d); } catch (e) { return { error: e.message === 'QUOTA' ? 'El navegador se quedó sin espacio (modo demo). Conecta Supabase para guardado permanente.' : 'No se pudo guardar.' }; }
        return post;
      },
      async removePost(id) { const d = db(); d.posts = d.posts.filter(p => p.id !== id); write(d); },

      async listResources(opts = {}) {
        let r = db().resources.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return r;
      },
      async saveResource(meta, file) {
        const d = db(); const now = new Date().toISOString().slice(0, 10);
        if (file) {
          try { meta.file_url = await fileToDataURL(file); } catch (e) { return { error: 'No se pudo leer el archivo.' }; }
          meta.file_name = file.name; meta.file_type = file.type; meta.file_size = file.size;
        }
        if (meta.id) { const i = d.resources.findIndex(r => r.id === meta.id); if (i >= 0) d.resources[i] = { ...d.resources[i], ...meta }; }
        else { meta.id = uid(); meta.created_at = now; d.resources.push(meta); }
        try { write(d); } catch (e) { return { error: e.message === 'QUOTA' ? 'El archivo es muy grande para el modo demo (límite ~5 MB del navegador). Conecta Supabase para archivos reales.' : 'No se pudo guardar.' }; }
        return meta;
      },
      async removeResource(id) { const d = db(); d.resources = d.resources.filter(r => r.id !== id); write(d); },
      async resourceUrl(res) { return res.file_url; },

      async listStudents() { return db().profiles.filter(p => p.role !== 'admin'); },
      async setStudentStatus(id, status) {
        const d = db(); const p = d.profiles.find(x => x.id === id);
        if (p) { p.status = status; if (status === 'approved') p.role = 'member'; }
        try { write(d); } catch (e) {}
        if (p && currentUser && currentUser.id === id) { currentUser = { ...p }; notify(); }  // refresca su propia sesión
      },
      async setStudentTipo(id, tipo) {
        const d = db(); const p = d.profiles.find(x => x.id === id); if (p) p.tipo = tipo;
        try { write(d); } catch (e) {}
        if (p && currentUser && currentUser.id === id) { currentUser.tipo = tipo; notify(); }
      },
      async updateMe(patch) {
        if (!currentUser) return { error: 'Sin sesión.' };
        const d = db(); const me = d.profiles.find(p => p.id === currentUser.id);
        const allowed = {}; ['full_name', 'avatar_url', 'tipo'].forEach(k => { if (patch[k] !== undefined) allowed[k] = patch[k]; });
        if (me) Object.assign(me, allowed);
        try { write(d); } catch (e) { return { error: 'No se pudo guardar (espacio del navegador).' }; }
        Object.assign(currentUser, allowed); localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser)); notify();
        return currentUser;
      },
      async getAdmin() { const a = db().profiles.find(p => p.role === 'admin'); return a ? { full_name: a.full_name, avatar_url: a.avatar_url } : null; },

      async createLead(lead) { const d = db(); lead.id = uid(); lead.created_at = new Date().toISOString(); d.leads.unshift(lead); try { write(d); } catch (e) {} return lead; },
      async listLeads() { return db().leads.slice(); },

      async getContent() { return db().content || {}; },
      async saveContent(patch) {
        const d = db(); d.content = Object.assign({}, d.content || {}, patch);
        try { write(d); } catch (e) { return { error: 'No se pudo guardar (espacio del navegador).' }; }
        return d.content;
      },

      async uploadImage(file) { try { return { url: await fileToDataURL(file) }; } catch (e) { return { error: 'No se pudo leer la imagen.' }; } },
      async uploadAvatar(file) { try { return { url: await fileToDataURL(file) }; } catch (e) { return { error: 'No se pudo leer la imagen.' }; } }
    };
  })();

  /* ============================================================
     ADAPTADOR SUPABASE (backend real)
     ============================================================ */
  const Supa = (() => {
    let sb = null;
    async function client() {
      if (sb) return sb;
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      return sb;
    }
    async function loadProfile(user) {
      if (!user) return null;
      const s = await client();
      const { data } = await s.from('profiles').select('*').eq('id', user.id).maybeSingle();
      return { id: user.id, email: user.email, full_name: (data && data.full_name) || user.email, role: (data && data.role) || 'member', status: (data && data.status) || 'pending', tipo: (data && data.tipo) || 'otro', avatar_url: (data && data.avatar_url) || '' };
    }
    return {
      async init() {
        const s = await client();
        const { data } = await s.auth.getUser();
        currentUser = data && data.user ? await loadProfile(data.user) : null;
        s.auth.onAuthStateChange(async (_e, session) => { if (_e === 'INITIAL_SESSION') return; currentUser = session && session.user ? await loadProfile(session.user) : null; notify(); });
      },
      async signIn(email, pw) {
        const s = await client();
        const { error } = await s.auth.signInWithPassword({ email, password: pw });
        if (error) return { error: /not confirmed/i.test(error.message) ? 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja.' : error.message };
        const { data } = await s.auth.getUser(); currentUser = await loadProfile(data.user); return {};
      },
      async signUp(email, pw, name, tipo) {
        const s = await client();
        const { data, error } = await s.auth.signUp({ email, password: pw, options: { data: { full_name: name, tipo: tipo || 'otro' }, emailRedirectTo: cfg.SITE_URL } });
        if (error) return { error: error.message };
        if (data && data.user && data.user.identities && data.user.identities.length === 0) return { error: 'Ese correo ya está registrado.' };
        return { pending: true, needsConfirm: !(data && data.session) };
      },
      async demoLogin() { return { error: 'No disponible en modo real.' }; },
      async signOut() { const s = await client(); await s.auth.signOut(); currentUser = null; notify(); },

      async listPosts(opts = {}) {
        const s = await client();
        let q = s.from('posts').select('*').order('created_at', { ascending: false });
        if (opts.type) q = q.eq('type', opts.type);
        if (opts.publishedOnly) q = q.eq('published', true);
        const { data } = await q; return data || [];
      },
      async getPost(idOrSlug) {
        const s = await client();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
        const base = s.from('posts').select('*');
        const { data } = await (isUuid ? base.eq('id', idOrSlug) : base.eq('slug', idOrSlug)).maybeSingle();
        return data || null;
      },
      async savePost(post) {
        const s = await client();
        if (post.id) {
          const { data, error } = await s.from('posts').update(post).eq('id', post.id).select().maybeSingle();
          return error ? { error: error.message } : (data || { error: 'No se guardó (revisa permisos o sesión).' });
        }
        if (!post.slug && post.title) post.slug = slugify(post.title) + '-' + Math.random().toString(36).slice(2, 6);
        const { data, error } = await s.from('posts').insert(post).select().single();
        return error ? { error: error.message } : data;
      },
      async removePost(id) { const s = await client(); await s.from('posts').delete().eq('id', id); },

      async listResources() { const s = await client(); const { data } = await s.from('resources').select('*').order('created_at', { ascending: false }); return data || []; },
      async saveResource(meta, file) {
        const s = await client();
        if (file) {
          const bucket = meta.visibility === 'members' ? 'private' : 'public';
          const path = uid() + '-' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const up = await s.storage.from(bucket).upload(path, file, { upsert: false });
          if (up.error) return { error: up.error.message };
          meta.bucket = bucket; meta.file_path = path; meta.file_name = file.name; meta.file_type = file.type; meta.file_size = file.size;
          if (bucket === 'public') meta.file_url = s.storage.from('public').getPublicUrl(path).data.publicUrl;
        }
        if (meta.id) {
          const { data, error } = await s.from('resources').update(meta).eq('id', meta.id).select().maybeSingle();
          return error ? { error: error.message } : (data || { error: 'No se guardó (revisa permisos).' });
        }
        const { data, error } = await s.from('resources').insert(meta).select().single();
        return error ? { error: error.message } : data;
      },
      async removeResource(id) { const s = await client(); await s.from('resources').delete().eq('id', id); },
      async resourceUrl(res) {
        if (res.bucket === 'private' && res.file_path) { const s = await client(); const { data } = await s.storage.from('private').createSignedUrl(res.file_path, 3600); return data && data.signedUrl; }
        return res.file_url;
      },

      async listStudents() { const s = await client(); const { data } = await s.from('profiles').select('*').neq('role', 'admin'); return data || []; },
      async setStudentStatus(id, status) { const s = await client(); const patch = { status }; if (status === 'approved') patch.role = 'member'; await s.from('profiles').update(patch).eq('id', id); },
      async setStudentTipo(id, tipo) { const s = await client(); await s.from('profiles').update({ tipo }).eq('id', id); },
      async updateMe(patch) {
        const s = await client();
        const { data: { user } } = await s.auth.getUser();
        if (!user) return { error: 'Sin sesión.' };
        const allowed = {}; ['full_name', 'avatar_url', 'tipo'].forEach(k => { if (patch[k] !== undefined) allowed[k] = patch[k]; });
        const { error } = await s.from('profiles').update(allowed).eq('id', user.id);
        if (error) return { error: error.message };
        currentUser = await loadProfile(user); notify(); return currentUser;
      },
      async getAdmin() { const s = await client(); const { data } = await s.from('profiles').select('full_name,avatar_url').eq('role', 'admin').limit(1).maybeSingle(); return data || null; },

      async createLead(lead) { const s = await client(); const { data } = await s.from('leads').insert(lead).select().single(); return data; },
      async listLeads() { const s = await client(); const { data } = await s.from('leads').select('*').order('created_at', { ascending: false }); return data || []; },

      async getContent() {
        try {
          const s = await client();
          const { data, error } = await s.from('site_content').select('key,value');
          if (error) return {};   // la tabla aún no existe → usa los textos por defecto
          const o = {}; (data || []).forEach(r => { o[r.key] = r.value; }); return o;
        } catch (e) { return {}; }
      },
      async saveContent(patch) {
        const s = await client();
        const rows = Object.keys(patch).map(k => ({ key: k, value: patch[k] }));
        const { error } = await s.from('site_content').upsert(rows, { onConflict: 'key' });
        if (error) return { error: /site_content/.test(error.message) ? 'Falta crear la tabla site_content (corre el SQL pendiente).' : error.message };
        return patch;
      },

      async uploadImage(file) {
        const s = await client();
        const path = 'img/' + uid() + '-' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const up = await s.storage.from('public').upload(path, file, { upsert: false });
        if (up.error) return { error: up.error.message };
        return { url: s.storage.from('public').getPublicUrl(path).data.publicUrl };
      },
      async uploadAvatar(file) {
        const s = await client();
        const path = 'avatars/' + uid() + '-' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const up = await s.storage.from('public').upload(path, file, { upsert: false });
        if (up.error) return { error: up.error.message };
        return { url: s.storage.from('public').getPublicUrl(path).data.publicUrl };
      }
    };
  })();

  const A = MODE === 'supabase' ? Supa : Demo;

  /* ============================================================
     API PÚBLICA  (window.Store)
     ============================================================ */
  const ready = (async () => { try { await A.init(); } catch (e) { console.warn('Store init', e); } })();

  window.Store = {
    mode: MODE,
    ready,
    canSee,
    isAdmin,
    auth: {
      user: () => currentUser,
      onChange: (cb) => { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },
      signIn: (e, p) => A.signIn(e, p),
      signUp: (e, p, n, tipo) => A.signUp(e, p, n, tipo),
      demoLogin: (r) => A.demoLogin(r),
      signOut: () => A.signOut()
    },
    profile: {
      updateMe: (patch) => A.updateMe(patch),
      getAdmin: () => A.getAdmin()
    },
    posts: {
      list: (o) => A.listPosts(o),
      get: (id) => A.getPost(id),
      save: (p) => A.savePost(p),
      remove: (id) => A.removePost(id)
    },
    resources: {
      list: (o) => A.listResources(o),
      save: (m, f) => A.saveResource(m, f),
      remove: (id) => A.removeResource(id),
      url: (r) => A.resourceUrl(r)
    },
    students: { list: () => A.listStudents(), setStatus: (id, s) => A.setStudentStatus(id, s), setTipo: (id, t) => A.setStudentTipo(id, t) },
    leads: { create: (l) => A.createLead(l), list: () => A.listLeads() },
    content: { getAll: () => A.getContent(), save: (p) => A.saveContent(p) },
    uploadImage: (f) => A.uploadImage(f),
    uploadAvatar: (f) => A.uploadAvatar(f)
  };
})();
