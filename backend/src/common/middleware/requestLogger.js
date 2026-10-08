'use strict';
const pinoHttp = require('pino-http');
const { getLogger } = require('../logging/logger');

function requestLogger() {
  return pinoHttp({
    logger: getLogger(),
    genReqId: (req) => req.id,
    customProps: (req) => ({
      requestId: req.id,
      userId: req.auth?.userId,
      clinicId: req.auth?.clinicId,
      role: req.auth?.role,
    }),
    serializers: {
      req: (req) => ({ method: req.method, url: req.url?.split('?')[0], remoteAddress: req.remoteAddress }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: { ignore: (req) => req.url === '/health/live' || req.url === '/metrics' },
  });
}
module.exports = { requestLogger };
