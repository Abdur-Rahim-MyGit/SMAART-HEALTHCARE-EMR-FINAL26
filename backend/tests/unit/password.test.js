'use strict';
const bcrypt = require('bcryptjs');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../../src/common/security/password');

describe('password', () => {
  it('hashes with bcrypt and verifies', async () => {
    const h = await hashPassword('Secret123');
    expect(h.startsWith('$2')).toBe(true);
    expect((await verifyPassword('Secret123', h)).ok).toBe(true);
    expect((await verifyPassword('wrong', h)).ok).toBe(false);
  });
  it('accepts bcrypt hashes written at any cost without asking for a rehash', async () => {
    const older = await bcrypt.hash('Legacy123', 10);
    const r = await verifyPassword('Legacy123', older);
    expect(r.ok).toBe(true);
    expect(r.needsRehash).toBe(false);
  });
  it('fails closed on a legacy argon2 hash when the argon2 package is not installed', async () => {
    const r = await verifyPassword('Secret123', '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$abc');
    expect(r.ok).toBe(false);
  });
  it('rejects plaintext stored values and short passwords', async () => {
    expect((await verifyPassword('plain', 'plain')).ok).toBe(false);
    await expect(hashPassword('short')).rejects.toThrow();
    expect(validatePasswordStrength('abcdefgh')).toContain('a digit');
    expect(validatePasswordStrength('Abcdefg1')).toEqual([]);
  });
});
