'use strict';
/** Cloudinary provider: signed, expiring, authenticated delivery URLs without any network call. */

describe('cloudinary storage provider', () => {
  it('produces signed private download urls with expiry and authenticated type', async () => {
    vi.resetModules();
    const cfg = require('../../src/config');
    vi.spyOn(cfg, 'config').mockReturnValue({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123456', CLOUDINARY_API_SECRET: 'top-secret', CLOUDINARY_FOLDER: 'smaart-emr', DOCUMENT_ACCESS_TTL_SECONDS: 300 });
    const { CloudinaryStorage } = require('../../src/infrastructure/storage/CloudinaryStorage');
    const s = new CloudinaryStorage();
    expect(s.name).toBe('cloudinary');
    const a = await s.getAccessUrl({ key: 'smaart-emr/clinics/c1/lab/file', resourceType: 'raw', format: 'pdf', ttlSeconds: 300, fileName: 'report.pdf' });
    expect(a.url).toContain('https://api.cloudinary.com/v1_1/demo/raw/download');
    expect(a.url).toContain('expires_at=');
    expect(a.url).toContain('signature=');
    expect(a.url).toContain('type=authenticated');
    expect(new Date(a.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(a.expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 301 * 1000);
    // a different secret yields a different signature: the URL is not forgeable without the secret
    cfg.config.mockReturnValue({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123456', CLOUDINARY_API_SECRET: 'other', CLOUDINARY_FOLDER: 'smaart-emr' });
    const s2 = new CloudinaryStorage();
    const b = await s2.getAccessUrl({ key: 'smaart-emr/clinics/c1/lab/file', resourceType: 'raw', format: 'pdf', ttlSeconds: 300 });
    expect(new URL(a.url).searchParams.get('signature')).not.toBe(new URL(b.url).searchParams.get('signature'));
  });
});
