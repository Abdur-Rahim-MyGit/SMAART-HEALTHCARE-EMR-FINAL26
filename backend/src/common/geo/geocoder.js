'use strict';
/**
 * Address -> latitude/longitude for clinics.
 *
 * Provider: Google Geocoding when GOOGLE_MAPS_API_KEY is set (best for Indian
 * street addresses), otherwise OpenStreetMap Nominatim (free; usage policy: at
 * most 1 request per second and an identifying User-Agent, both handled here).
 *
 * Tries the full address first, then zip code, then city, and reports which one
 * matched in `source` ('address' | 'zip' | 'city'), so the admin knows how
 * precise the point is and can drag the pin to the exact building.
 *
 * "No match" moves on to the next, coarser try; a network/HTTP error stops at
 * once (and is thrown), so an unreachable geocoder costs one timeout, not four.
 * GEOCODING=off disables lookups (tests, offline installs).
 */

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const GOOGLE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const TIMEOUT_MS = 6000;
const MIN_GAP_MS = 1100; // Nominatim: max 1 request/second

let lastCall = 0;
let queue = Promise.resolve();
/** Runs fn after the previous call, at least MIN_GAP_MS apart (Nominatim only). */
function throttled(fn) {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

const clean = (v) => String(v == null ? '' : v).trim();
const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`geocoder HTTP ${res.status}`);
  return res.json();
}

async function nominatim(params) {
  const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', addressdetails: '0', ...params });
  if (process.env.GEOCODER_EMAIL) qs.set('email', process.env.GEOCODER_EMAIL);
  const ua = process.env.GEOCODER_USER_AGENT || 'SMAART-Healthcare-EMR/1.0 (clinic geocoding)';
  const rows = await throttled(() => getJson(`${NOMINATIM_URL}?${qs}`, { 'User-Agent': ua, Accept: 'application/json' }));
  const top = Array.isArray(rows) ? rows[0] : null;
  if (!top) return null;
  const lat = Number(top.lat); const lng = Number(top.lon);
  return validPoint(lat, lng) ? { latitude: lat, longitude: lng, displayName: top.display_name || null } : null;
}

async function google(address, components) {
  const qs = new URLSearchParams({ key: process.env.GOOGLE_MAPS_API_KEY });
  if (address) qs.set('address', address);
  if (components) qs.set('components', components);
  const body = await getJson(`${GOOGLE_URL}?${qs}`, { Accept: 'application/json' });
  const top = body && body.status === 'OK' ? body.results[0] : null;
  if (!top) return null;
  const lat = Number(top.geometry.location.lat); const lng = Number(top.geometry.location.lng);
  return validPoint(lat, lng) ? { latitude: lat, longitude: lng, displayName: top.formatted_address || null } : null;
}

/**
 * @param {{address?: string, city?: string, state?: string, zipCode?: string, country?: string}} a
 * @returns {Promise<null | {latitude: number, longitude: number, source: 'address'|'zip'|'city', provider: string, displayName: string|null}>}
 */
async function geocodeAddress(a) {
  const address = clean(a.address); const city = clean(a.city); const state = clean(a.state);
  const zip = clean(a.zipCode); const country = clean(a.country) || 'India';
  if (!address && !city && !zip) return null;
  if (String(process.env.GEOCODING || '').toLowerCase() === 'off') return null;

  const useGoogle = !!process.env.GOOGLE_MAPS_API_KEY;
  const provider = useGoogle ? 'google' : 'openstreetmap';
  const attempts = useGoogle
    ? [
      ['address', () => google([address, city, state, zip, country].filter(Boolean).join(', '))],
      ['zip', () => (zip ? google(null, `postal_code:${zip}|country:${country}`) : null)],
      ['city', () => (city ? google([city, state, country].filter(Boolean).join(', ')) : null)],
    ]
    : [
      // Structured search first; free-text as a second try (house numbers / "No. 12, ..." often defeat the structured form).
      ['address', () => (address ? nominatim({ street: address, city, state, postalcode: zip, country }) : null)],
      ['address', () => (address ? nominatim({ q: [address, city, state, zip, country].filter(Boolean).join(', ') }) : null)],
      ['zip', () => (zip ? nominatim({ postalcode: zip, country }) : null)],
      ['city', () => (city ? nominatim({ city, state, country }) : null)],
    ];

  for (const [source, attempt] of attempts) {
    const hit = await attempt();
    if (hit) return { ...hit, source, provider };
  }
  return null;
}

module.exports = { geocodeAddress, validPoint, _test: { reset: () => { lastCall = 0; queue = Promise.resolve(); } } };
