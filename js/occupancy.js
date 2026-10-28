// Stima delle persone presenti dalla CO2 (bilancio di massa in regime stazionario):
//   CO2 - CO2_esterna = G * N / Q   ->   N = (CO2 - CO2_ext) * Q / G
// Q = portata d'aria di ricambio (m3/s) = volume * ricambi_orari / 3600, G = CO2 emessa da una persona.
// E' una stima: dipende da volume e ventilazione reali, quindi i valori per zona vanno tarati.
const CO2_EXT = 420;            // ppm all'aperto
const G = 0.005 / 1000;         // m3/s di CO2 per persona seduta (~18 L/h)
const DEFAULT = { vol: 60, ach: 3 };
// Taratura per zona (nome zona esatto): volume in m3 e ricambi d'aria orari.
export const ZONE_CFG = {
  'Sala conferenze': { vol: 120, ach: 4 },
  'Open space': { vol: 220, ach: 3 },
  'Showroom': { vol: 250, ach: 3 },
  'Zona 2': { vol: 60, ach: 3 },
  'Nuova zona 1': { vol: 60, ach: 3 },
};

/** Persone stimate (intero >= 0) oppure null se manca la CO2. */
export function estimatePeople(zoneId, co2) {
  if (co2 == null) return null;
  const { vol, ach } = ZONE_CFG[zoneId] || DEFAULT;
  const q = vol * ach / 3600;
  return Math.max(0, Math.round((co2 - CO2_EXT) * 1e-6 * q / G));
}
