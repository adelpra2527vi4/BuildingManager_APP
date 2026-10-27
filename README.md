# Building Live (web app da fiera)

> Stato del lavoro, architettura, contratto API e prossimi passi: vedi [PLAN.md](PLAN.md).

Web app statica (HTML/CSS/JS, nessuna build) per vedere da smartphone la mappa del Building Manager con dati live: temperatura, CO₂, umidità, luce, potenza; scheda zona con aria animata (CO₂) e spettro/colore della luce. Pubblicata con GitHub Pages; i dati arrivano dal Raspberry (`Manager-raspi`, modulo `fair_api.py`) tramite Tailscale Funnel.

## Come funziona l'accesso

1. Dal pannello `http://<ip-raspberry>:5000/fair-admin/` (solo rete locale) si genera un **QR** con un token firmato a scadenza.
2. Il QR contiene `https://<pages>/#t=TOKEN&a=https://<host>.ts.net`: il token sta nel frammento, quindi non finisce nei log dei server.
3. La web app lo salva, ripulisce l'URL e chiama `/fair/api/*` con `Authorization: Bearer`. Senza token valido mostra "Inquadra il QR".
4. "Revoca tutti" nel pannello cambia il segreto e invalida ogni QR emesso.

Limite: chi riceve il link lo può inoltrare finché il token non scade. Per una fiera è sufficiente; la scadenza è nel pannello (1–72 h).

## Prova senza Raspberry

`python -m http.server 8000` e apri `http://localhost:8000/?demo` (dati simulati).

## Pubblicazione

Push su `main` → il workflow `.github/workflows/pages.yml` pubblica. In Settings → Pages scegli "GitHub Actions" come sorgente.

## Lato Raspberry (CORS e Funnel)

Vedi `setup_fair.sh` in `Manager-raspi`. In breve: `FAIR_ORIGINS` = origin di Pages (es. `https://utente.github.io`), Funnel solo su `/fair`.
