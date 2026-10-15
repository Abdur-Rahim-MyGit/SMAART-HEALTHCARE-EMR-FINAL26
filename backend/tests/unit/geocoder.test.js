'use strict';
/** Clinic geocoder: fallback order, provider choice and failure handling, with fetch stubbed (no network). */

const okJson = (body) => ({ ok: true, status: 200, json: async () => body });

describe('clinic geocoder', () => {
  let geo;
  beforeEach(() => {
    vi.resetModules();
    process.env.GEOCODING = 'on';
    delete process.env.GOOGLE_MAPS_API_KEY;
    geo = require('../../src/common/geo/geocoder');
    geo._test.reset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.GEOCODING = 'off';
  });

  it('uses the full address when OpenStreetMap finds it', async () => {
    const fetch = vi.fn(async () => okJson([{ lat: '13.0604', lon: '80.2496', display_name: 'Anna Salai, Chennai' }]));
    vi.stubGlobal('fetch', fetch);
    const r = await geo.geocodeAddress({ address: '1 Anna Salai', city: 'Chennai', state: 'Tamil Nadu', zipCode: '600002', country: 'India' });
    expect(r).toMatchObject({ latitude: 13.0604, longitude: 80.2496, source: 'address', provider: 'openstreetmap' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('street=1+Anna+Salai');
    expect(url).toContain('postalcode=600002');
    expect(init.headers['User-Agent']).toMatch(/SMAART/);
  });

  it('falls back to the zip code, then the city, and says which one matched', async () => {
    const answers = [[], [], [{ lat: '13.08', lon: '80.27' }]]; // structured, free-text: none; zip: hit
    vi.stubGlobal('fetch', vi.fn(async () => okJson(answers.shift() || [])));
    const r = await geo.geocodeAddress({ address: 'No. 12, Unknown Lane', city: 'Chennai', zipCode: '600002', country: 'India' });
    expect(r).toMatchObject({ source: 'zip', latitude: 13.08, longitude: 80.27 });

    geo._test.reset();
    const cityOnly = [[{ lat: '12.97', lon: '77.59' }]];
    vi.stubGlobal('fetch', vi.fn(async () => okJson(cityOnly.shift() || [])));
    const c = await geo.geocodeAddress({ city: 'Bengaluru', country: 'India' });
    expect(c).toMatchObject({ source: 'city' });
  });

  it('returns null when nothing matches and stops at the first network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson([])));
    expect(await geo.geocodeAddress({ address: 'x', city: 'Nowhere', zipCode: '000000' })).toBeNull();

    geo._test.reset();
    const failing = vi.fn(async () => { throw new Error('getaddrinfo ENOTFOUND'); });
    vi.stubGlobal('fetch', failing);
    await expect(geo.geocodeAddress({ address: 'x', city: 'Chennai', zipCode: '600002' })).rejects.toThrow(/ENOTFOUND/);
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('uses Google when an API key is set, and ignores 0,0 / out-of-range points', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      expect(url).toContain('maps.googleapis.com');
      return okJson({ status: 'OK', results: [{ geometry: { location: { lat: 0, lng: 0 } } }] });
    }));
    expect(await geo.geocodeAddress({ address: 'a', city: 'b' })).toBeNull();
    expect(geo.validPoint(13, 80)).toBe(true);
    expect(geo.validPoint(91, 80)).toBe(false);
  });

  it('does nothing when GEOCODING=off or there is no address', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    process.env.GEOCODING = 'off';
    expect(await geo.geocodeAddress({ city: 'Chennai' })).toBeNull();
    process.env.GEOCODING = 'on';
    expect(await geo.geocodeAddress({})).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
