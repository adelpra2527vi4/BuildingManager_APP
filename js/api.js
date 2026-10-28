// Sessione (token dal QR) e chiamate all'API in sola lettura del Raspberry.
const KEY = 'fair.session';

/** Legge #t=TOKEN&a=URL dal QR, lo salva e ripulisce l'URL. Ritorna la sessione valida o null. */
export function initSession() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('a')) {
    try {
      const u = new URL(h.get('a'));
      // Solo HTTPS su un host Tailscale: un link manipolato non puo' puntare altrove.
      // TEMP test senza login: accesso libero (token vuoto) anche a http su IP di rete locale.
      const lan = u.protocol === 'http:' && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname);
      if ((u.protocol === 'https:' && u.hostname.endsWith('.ts.net') && h.get('t')) || (lan && !h.get('t')))
        localStorage.setItem(KEY, JSON.stringify({ t: h.get('t') || '', a: u.origin }));
    } catch { /* URL non valido: ignora */ }
    history.replaceState(null, '', location.pathname + location.search);
  }
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && (!s.t || Number(s.t.split('.')[1]) * 1000 > Date.now())) return s;
  } catch { /* storage assente o corrotto */ }
  return null;
}

export const expiresAt = (s) => s.t ? Number(s.t.split('.')[1]) * 1000 : Infinity;
export const clearSession = () => { try { localStorage.removeItem(KEY); } catch { /* ok */ } };

async function call(s, path) {
  const r = await fetch(s.a + path, { headers: s.t ? { Authorization: 'Bearer ' + s.t } : {}, cache: 'no-store' });
  if (r.status === 401) throw Object.assign(new Error('auth'), { auth: true });
  if (!r.ok) throw new Error('http ' + r.status);
  return r;
}

export const getState = async (s) => (await call(s, '/fair/api/state')).json();

const planCache = new Map();
/** La pianta e' protetta dal token: si scarica con fetch e si usa come blob URL. */
export async function getPlanUrl(s, id) {
  if (!planCache.has(id))
    planCache.set(id, call(s, '/fair/plan/' + encodeURIComponent(id)).then(r => r.blob()).then(b => URL.createObjectURL(b)));
  return planCache.get(id);
}
