# PLAN — Web app da fiera (Building Live)

## Obiettivo
Ai visitatori della fiera, solo da smartphone (nessuno schermo), mostrare i dati del Building Manager: mappa con zone colorate, CO₂ e spettro luce con animazioni d'impatto. Dati dal Raspberry via Tailscale Funnel; accesso solo con QR.

## Architettura
```
smartphone ──QR──> GitHub Pages (questo repo, statico)
     │  fetch + Authorization: Bearer <token>
     ▼
https://<host>.<tailnet>.ts.net/fair/*   (Tailscale Funnel, SOLO path /fair)
     ▼
Raspberry :5000  Manager.py + fair_api.py   (repo adelpra2527vi4/Building_Manager)
```
- Funnel espone solo `/fair`; dashboard e comandi (`/`, `/api/*`) non sono raggiungibili da internet.
- `/fair-admin/` (genera QR, revoca) risponde solo da LAN e mai con header Funnel.
- Token: `v1.<exp_epoch>.<hmac>` firmato con segreto in `.fair_secret` (o env `FAIR_SECRET`), nel frammento URL del QR: `#t=TOKEN&a=https://host.ts.net`. `api.js` accetta solo `a` https su `*.ts.net`.
- CORS: solo origin in `FAIR_ORIGINS` (default `https://adelpra2527vi4.github.io`); preflight OPTIONS senza auth e senza dati.

## Contratto API (`GET /fair/api/state`, ogni ~2 s, cache server 1.5 s)
```
{ ts, nome, piani:[{id,nome,img}],
  zones:[{id,piano,pts:[[x,y]..] (normalizzati 0..1), colore,
          t,hum,co2,lux,pir,cct, luci:[on,tot], w, wh}],
  spectra:{ "<zona>":[{id,name,cct,cx,cy,spec:[10]}] },   // spec = F1..F8 (415..680 nm), clear, NIR
  totali:{w,wh,luci:[on,tot]} }
GET /fair/plan/<piano_id>  → SVG della pianta (con token; la web app lo scarica come blob)
GET /fair/api/ping
```
Sorgenti lato Pi: `api_zone_layers`, `_planimetrie_list`, `_spettro_nodes` (zones.py) passati a `fair_api.init(...)` da Manager.py.

## File
- `index.html`, `css/app.css`
- `js/main.js` stato, polling, scheda zona · `js/api.js` sessione/token · `js/map.js` pianta+poligoni
- `js/fx.js` AirField (CO₂), SpectrumChart, ChromaChart, countTo, sparkline · `js/scales.js` scale colore, colorimetria · `js/demo.js` dati simulati
- `.github/workflows/pages.yml` deploy su push a `main`
- Lato Pi (repo Building_Manager): `fair_api.py`, `setup_fair.sh`, `deploy/hvac.service`, modifica a `_require_customer_code` in Manager.py

## Fatto
- API sola lettura, token, CORS, rate limit, pannello QR — testati con curl sul Pi (401 senza token, preflight 204, origin estranea senza header CORS, admin 404 con header Funnel).
- Web app completa, provata in Chrome headless con `?demo`.
- Pages attivo: https://adelpra2527vi4.github.io/BuildingManager_APP/
- Fix installazione pulita: senza codice cliente ogni pagina dava 500.

## Da fare (prossimo passo in alto)
1. **Commit/push di `fair_api.py`, `setup_fair.sh`, `deploy/`, `Manager.py`, `README.md`, `.gitignore` nella repo Building_Manager** (il Pi della fiera usa quella repo; non ancora fatto).
2. Sul Pi della fiera: `./setup_fair.sh` (Tailscale + Funnel su `/fair`), impostare `FAIR_PUBLIC_URL` in `fair.env`, riavviare `hvac.service`.
3. Abilitare HTTPS e attributo "funnel" nel pannello admin Tailscale.
4. Prova end-to-end da smartphone fuori dalla LAN con un QR vero.
5. Verificare lo spettro con sensori AS7341 reali (nel Pi di test non ce ne sono: formato `spec` non provato dal vivo).
6. Rifiniture: eventuale storico/sparkline lato server, mostrare i sensori sulla pianta (non esposta la posizione), PWA installabile (manifest), test su iOS Safari/Android.

## Rischi / limiti
- Funnel pubblica il Raspberry su internet (solo `/fair`, token + rate limit). QR inoltrabile fino alla scadenza token (1–72 h); "Revoca tutti" cambia il segreto.
- Le planimetrie non sono in Git: sul Pi della fiera vanno caricate dall'app.
- Il QR usa qrcode-generator da cdnjs: serve internet sul dispositivo che apre `/fair-admin/`.

## Riprendere da casa
```
git clone https://github.com/adelpra2527vi4/BuildingManager_APP
git clone https://github.com/adelpra2527vi4/Building_Manager     # contiene fair_api.py solo dopo il punto 1
cd BuildingManager_APP && python -m http.server 8000             # apri http://localhost:8000/?demo
```
Test API (sul Pi): `T=$(curl -s localhost:5000/fair-admin/token?hours=1 | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])'); curl -H "Authorization: Bearer $T" localhost:5000/fair/api/state`
Credenziali e IP del Raspberry non sono in questo repo.
