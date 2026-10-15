'use strict';
/** Clinic latitude/longitude: saved from the form's pin, geocoded from the address, re-geocoded when it changes. */
const { api, resetData, adminToken, createClinic } = require('../helpers/api');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const nominatim = (lat, lon) => vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ lat: String(lat), lon: String(lon), display_name: 'x' }] }));

describe('clinic location', () => {
  let t;
  beforeAll(async () => {
    await resetData();
    t = await adminToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.GEOCODING = 'off';
  });

  it('keeps the point chosen on the map (pin) as given', async () => {
    const c = await createClinic(t, { address: '1 Anna Salai', city: 'Chennai', latitude: 13.0604, longitude: 80.2496, geoSource: 'pin' });
    expect(c.clinic).toMatchObject({ latitude: 13.0604, longitude: 80.2496, geoSource: 'pin' });
    expect(c.clinic.geocodedAt).toBeTruthy();
  });

  it('geocodes the address when no point is sent, and again when the address changes', async () => {
    process.env.GEOCODING = 'on';
    vi.stubGlobal('fetch', nominatim(12.9716, 77.5946));
    const c = await createClinic(t, { address: 'MG Road', city: 'Bengaluru', state: 'Karnataka', zipCode: '560001', country: 'India' });
    expect(c.clinic).toMatchObject({ latitude: 12.9716, longitude: 77.5946, geoSource: 'address' });

    // Unrelated edit: no lookup, point unchanged.
    const lookups = nominatim(1, 1);
    vi.stubGlobal('fetch', lookups);
    const r1 = await api().put(`/api/v1/clinics/${c.clinic._id}`).set(auth(t)).send({ phone: '9876543210' });
    expect(r1.status).toBe(200);
    expect(r1.body.clinic).toMatchObject({ latitude: 12.9716, longitude: 77.5946 });
    expect(lookups).not.toHaveBeenCalled();

    // New address: looked up again.
    vi.stubGlobal('fetch', nominatim(13.0827, 80.2707));
    const r2 = await api().put(`/api/v1/clinics/${c.clinic._id}`).set(auth(t)).send({ address: 'Mount Road', city: 'Chennai' });
    expect(r2.body.clinic).toMatchObject({ latitude: 13.0827, longitude: 80.2707, geoSource: 'address' });
  });

  it('saves the clinic without a point when the lookup fails', async () => {
    process.env.GEOCODING = 'on';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const c = await createClinic(t, { address: 'Somewhere', city: 'Madurai' });
    expect(c.clinic.latitude ?? null).toBeNull();
  });

  it('"Find on map" returns the point without saving; rejects impossible coordinates', async () => {
    process.env.GEOCODING = 'on';
    vi.stubGlobal('fetch', nominatim(11.0168, 76.9558));
    const g = await api().post('/api/v1/clinics/geocode').set(auth(t)).send({ city: 'Coimbatore', country: 'India' });
    expect(g.status).toBe(200);
    expect(g.body).toMatchObject({ found: true, latitude: 11.0168, longitude: 76.9558, source: 'city' });

    const bad = await api().post('/api/v1/clinics').set(auth(t)).send({ name: 'Bad', adminEmail: 'bad@clinic.local', adminPassword: 'Clinic12345', latitude: 123, longitude: 80 });
    expect(bad.status).toBe(422); // validation error
  });
});
