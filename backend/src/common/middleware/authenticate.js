'use strict';
const { verifyAccessToken } = require('../security/tokens');
const { unauthorized } = require('../errors/AppError');
const { isValidRole } = require('../security/rbac');
const { asyncHandler } = require('./asyncHandler');

/**
 * Builds the authenticate middleware. `sessionLookup(sid)` must return the live
 * session (with user state) or null; results are cached briefly by the auth service.
 */
function authenticate(sessionLookup) {
  return asyncHandler(async (req, _res, next) => {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (!token || !/^bearer$/i.test(scheme)) throw unauthorized('Access denied. No token provided.', 'NO_TOKEN');
    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (err) {
      if (err && err.name === 'TokenExpiredError') throw unauthorized('Session expired', 'TOKEN_EXPIRED');
      throw unauthorized('Invalid token.', 'INVALID_TOKEN');
    }
    if (!isValidRole(claims.role) || !claims.sid || !claims.sub) throw unauthorized('Invalid token.', 'INVALID_TOKEN');
    const session = await sessionLookup(claims.sid, claims.sub);
    if (!session) throw unauthorized('Session is no longer valid', 'SESSION_REVOKED');
    if (!session.user.is_active) throw unauthorized('Account is inactive', 'ACCOUNT_INACTIVE');
    if (session.user.role !== claims.role || String(session.user.clinic_id || '') !== String(claims.clinicId || '')) {
      throw unauthorized('Session is no longer valid', 'SESSION_STALE');
    }
    req.auth = Object.freeze({
      userId: session.user.id,
      role: session.user.role,
      clinicId: session.user.clinic_id || null,
      sessionId: claims.sid,
      tokenId: claims.jti,
      email: session.user.email,
    });
    req.user = session.user; // read-only convenience for controllers
    next();
  });
}

module.exports = { authenticate };
