'use strict';
const jwt = require('jsonwebtoken');
const { signAccessToken, verifyAccessToken, signPurposeToken, verifyPurposeToken, sha256, timingSafeEqualHex } = require('../../src/common/security/tokens');
const { config } = require('../../src/config');

describe('tokens', () => {
  it('signs minimal claims only', () => {
    const { token } = signAccessToken({ userId: 'u1', role: 'clinic_admin', clinicId: 'c1', sessionId: 's1' });
    const claims = verifyAccessToken(token);
    expect(Object.keys(claims).sort()).toEqual(['clinicId', 'exp', 'iat', 'iss', 'jti', 'role', 'sid', 'sub'].sort());
    expect(claims.sub).toBe('u1');
  });
  it('rejects expired, tampered and wrong-issuer tokens', () => {
    const env = config();
    const expired = jwt.sign({ role: 'clinic_admin', sid: 's' }, env.JWT_SECRET, { subject: 'u', issuer: env.JWT_ISSUER, expiresIn: -10 });
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
    const other = jwt.sign({ role: 'clinic_admin', sid: 's' }, 'another-secret-another-secret-another', { subject: 'u', issuer: env.JWT_ISSUER });
    expect(() => verifyAccessToken(other)).toThrow();
    const wrongIss = jwt.sign({ role: 'clinic_admin', sid: 's' }, env.JWT_SECRET, { subject: 'u', issuer: 'evil' });
    expect(() => verifyAccessToken(wrongIss)).toThrow();
    const none = jwt.sign({ role: 'super_master_admin', sid: 's' }, '', { subject: 'u', issuer: env.JWT_ISSUER, algorithm: 'none' });
    expect(() => verifyAccessToken(none)).toThrow();
  });
  it('purpose tokens cannot be swapped between purposes', () => {
    const t = signPurposeToken('password_reset', { sub: 'u' }, '5m');
    expect(verifyPurposeToken(t, 'password_reset').sub).toBe('u');
    expect(() => verifyPurposeToken(t, 'local-file')).toThrow();
  });
  it('hashes and compares safely', () => {
    expect(timingSafeEqualHex(sha256('a'), sha256('a'))).toBe(true);
    expect(timingSafeEqualHex(sha256('a'), sha256('b'))).toBe(false);
  });
});
