# Avvio rapido — Building Live (web app da fiera)

Istruzioni per far partire la web app su un PC nella stessa rete del Raspberry. Pensate per essere eseguite da un assistente AI o da uno sviluppatore, senza altro contesto.

## Cos'è
Sito statico (HTML + JS, nessuna build, nessuna dipendenza) che mostra in tempo reale i dati del Building Manager: pianta con zone colorate, temperatura, umidità, CO₂, persone stimate dalla CO₂, presenza (PIR), spettro della luce e dimmer delle luci. I dati arrivano dal Raspberry che esegue il Manager ([repo Building_Manager](https://github.com/adelpra2527vi4/Building_Manager), file `fair_api.py`; checklist installazione nel suo README).

```
browser (PC/telefono) -> questa cartella servita da un web server statico
        \-- fetch --> http://<IP-RASPBERRY>:5000/fair/api/state   (Manager sul Raspberry)
```

## Requisiti
- Un browser moderno (Chrome, Edge, Safari recenti).
- Python 3 **oppure** Node.js, solo per servire i file statici (aprire `index.html` con doppio clic NON funziona: usa moduli ES e richiede `http://`).
- PC e Raspberry nella stessa rete locale.

## 1. Clonare e servire
```bash
git clone https://github.com/adelpra2527vi4/BuildingManager_APP
cd BuildingManager_APP
python -m http.server 8080          # alternativa: npx serve -l 8080
```
La pagina è ora su `http://localhost:8080/`.

## 2. Prova senza Raspberry (dati simulati)
Apri `http://localhost:8080/?demo`. Per aprire direttamente la scheda di una zona: `http://localhost:8080/?demo&open=Sala%20conferenze` (aggiungi `&metric=co2|hum|lux` per la metrica, oppure `&focus=air|light|lights|rele` per i pannelli Aria, Luce, Luci, Relè).

## 3. Collegarsi al Raspberry
L'indirizzo del Raspberry viene passato nel frammento dell'URL (`#a=`) e salvato nel browser, quindi basta farlo una volta.

Indirizzo di test: `http://192.168.103.198:5000` (**può cambiare**: se non risponde, chiedilo a chi gestisce il Raspberry).

Verifica che sia raggiungibile:
```bash
curl http://192.168.103.198:5000/fair/api/ping      # atteso: {"ok":true}
curl http://192.168.103.198:5000/fair/api/state     # atteso: JSON con "zones", "piani", "totali"
```

**Solo lettura** (vedere i dati):
```
http://localhost:8080/#a=http://192.168.103.198:5000
```

**Con comandi** (dimmer delle luci): serve un token, da generare dalla rete locale (valido N ore):
```bash
curl "http://192.168.103.198:5000/fair-admin/token?hours=12"      # risposta: {"token":"v1.<exp>.<firma>", ...}
```
poi apri:
```
http://localhost:8080/#t=<TOKEN>&a=http://192.168.103.198:5000
```
Nel pannello "Luci" (pulsante sotto la mappa) si muovono dimmer e colore; senza token gli slider sono disattivati.

Note:
- La pagina accetta `#a=` solo con `https://*.ts.net` (Tailscale Funnel) oppure `http://` verso `localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`.
- Il Raspberry deve avere la variabile `FAIR_OPEN=1` (già impostata sul Pi di test): serve a permettere le letture senza token e a rispondere al CORS da qualsiasi origine. Senza di essa tutte le richieste danno 401 e la pagina mostra "QR scaduto o non valido".

## 4. Aprirla da un telefono (stessa Wi-Fi)
1. Trova l'IP del PC (`ipconfig` su Windows, `ifconfig`/`ip a` altrove), ad esempio `192.168.103.50`.
2. `python -m http.server 8080` ascolta già su tutte le interfacce. Su Windows consenti la porta 8080 nel firewall quando richiesto.
3. Dal telefono apri `http://192.168.103.50:8080/#t=<TOKEN>&a=http://192.168.103.198:5000`.

GitHub Pages (https) **non** può leggere il Raspberry in `http` (blocco "mixed content"): per usarla da internet serve Tailscale Funnel con un indirizzo `https://<host>.ts.net` sul Raspberry. Non è ancora configurato.

## Struttura
| File | Ruolo |
|---|---|
| `index.html`, `css/app.css` | pagina e stile |
| `js/main.js` | stato, polling ogni 2 s, scheda zona, dimmer |
| `js/api.js` | sessione (indirizzo + token) e chiamate al Raspberry |
| `js/map.js` | pianta e poligoni delle zone |
| `js/fx.js` | grafici spettro e cromaticità, conteggio animato, sparkline |
| `js/occupancy.js` | stima persone dalla CO₂ (volume e ricambi d'aria per zona in `ZONE_CFG`) |
| `js/scales.js`, `js/demo.js` | scale colore e dati simulati |

API usate (tutte sul Raspberry): `GET /fair/api/state`, `GET /fair/plan/<piano>` (SVG pianta), `GET /fair/api/zone/<zona>/history?m=t|hum|co2|lux&hours=1..48` (storico per il grafico), `POST /fair/api/zone/<zona>/luci` con `{"pct": 0..100}` e/o `{"ct": 2700..6500}` in kelvin, solo con token (il colore agisce solo sulle lampade che lo supportano), `POST /fair/api/zone/<zona>/rele` con `{"k":"hvac_caldo|hvac_freddo|ventola|umidificatore|deumidificatore","on":true}`, `{"k":"ventola","vel":0..3}` o `{"manuale":false}` (solo con token; il comando mette la zona in manuale), `POST /fair/api/zone/<zona>/persone` con `{"n": persone presenti ora}` per tarare la stima persone o `{"reset": true}` (solo con token). La stima persone arriva calcolata dal Raspberry (`persone` nello stato) con il termine del transitorio della CO₂, il volume della zona e il fattore di taratura. Se il sensore CO₂ sta vicino a una porta o finestra segnata sulla pianta, lo stato porta `sens_aperture` (`{t, d}` in metri) e il pannello Aria mostra un avviso.

## Problemi comuni
| Sintomo | Causa / rimedio |
|---|---|
| Schermata "Indirizzo non configurato" | manca `#a=…` nell'URL |
| "QR scaduto o non valido" | il Raspberry risponde 401: manca `FAIR_OPEN=1` oppure il token è scaduto, rigenerarlo |
| Sfondo vuoto | cache del browser con file vecchi: Ctrl+F5; guardare la console (F12) per errori JavaScript |
| Dati fermi | il piè di pagina mostra "Aggiornato alle hh:mm:ss": se non avanza, il Raspberry non risponde |
| Gli slider luci sono grigi | manca il token nell'URL. Lo slider colore compare solo se la zona ha lampade con temperatura colore |
| Grafico vuoto ("Nessun dato storico") | la zona non ha letture per quella metrica nelle ultime ore |
| Nessuna "persona stimata" | la zona non ha sensore CO₂ (resta solo il PIR) |
| `curl` al Raspberry non risponde | IP cambiato o reti diverse: verificare IP e che PC e Raspberry siano nella stessa rete |

## Note di sicurezza
- Con `FAIR_OPEN=1` chiunque sulla rete locale legge i dati; i comandi (luci, colore, relè HVAC/ventola/umidità) richiedono sempre il token. Chi ha il QR può accendere HVAC e ventole della zona: usa token di poche ore e riporta le zone in automatico a fine giornata. Non esporre il Raspberry su internet in questa modalità.
- Non committare token né indirizzi privati nel repo.
