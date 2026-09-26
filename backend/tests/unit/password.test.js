'use strict';
const bcrypt = require('bcryptjs');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../../src/common/security/password');

describe('password', () => {
  it('hashes with argon2id and verifies', async () => {
    const h = await hashPassword('Secret123');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect((await verifyPassword('Secret123', h)).ok).toBe(true);
    expect((await verifyPassword('wrong', h)).ok).toBe(false);
  });
  it('verifies legacy bcrypt hashes and asks for a rehash', async () => {
    const legacy = await bcrypt.hash('Legacy123', 10);
    const r = await verifyPassword('Legacy123', legacy);
    expect(r.ok).toBe(true);
    expect(r.needsRehash).toBe(true);
  });
  it('rejects plaintext stored values and short passwords', async () => {
    expect((await verifyPassword('plain', 'plain')).ok).toBe(false);
    await expect(hashPassword('short')).rejects.toThrow();
    expect(validatePasswordStrength('abcdefgh')).toContain('a digit');
    expect(validatePasswordStrength('Abcdefg1')).toEqual([]);
  });
});
