'use strict';
const express = require('express');
const { config } = require('./config');
const { requestId } = require('./common/middleware/requestId');
const { requestLogger } = require('./common/middleware/requestLogger');
const { securityMiddleware } = require('./common/middleware/security');
const { apiLimiter, fhirLimiter } = require('./common/middleware/rateLimit');
const { legacyApiAlias } = require('./common/middleware/legacyApiAlias');
const { authenticate } = require('./common/middleware/authenticate');
const { errorHandler, notFoundHandler } = require('./common/errors/errorHandler');
const { metricsMiddleware, metricsHandler } = require('./common/metrics');
const authService = require('./modules/auth/authService');

function createApp() {
  const env = config();
  const app = express();

  app.use(requestId);
  app.use(requestLogger());
  securityMiddleware(app);
  if (env.METRICS_ENABLED) app.use(metricsMiddleware);

  const health = require('./modules/health/routes');
  app.use('/health', health.router);
  app.use('/api/health', health.router);
  if (env.METRICS_ENABLED) app.get('/metrics', metricsHandler);

  app.use(legacyApiAlias);

  // ---- public + auth ----
  app.use('/api/v1/auth', require('./modules/auth/routes'));

  // Development-only local file delivery (signed, expiring token in the URL; no bearer needed for <img src>).
  app.get('/api/v1/documents/local/:token', require('./modules/documents/routes').localFileHandler);

  // ---- protected REST API ----
  const protectedApi = express.Router();
  protectedApi.use(authenticate(authService.lookupSession));
  protectedApi.use(apiLimiter());
  protectedApi.use('/clinics', require('./modules/clinics/routes'));
  protectedApi.use('/users', require('./modules/users/routes'));
  protectedApi.use('/patients', require('./modules/patients/routes'));
  protectedApi.use('/doctors', require('./modules/practitioners/routes').doctors);
  protectedApi.use('/nurses', require('./modules/practitioners/routes').nurses);
  protectedApi.use('/practitioners', require('./modules/practitioners/routes').practitioners);
  protectedApi.use('/appointments', require('./modules/appointments/routes'));
  protectedApi.use('/encounters', require('./modules/encounters/routes').encounters);
  protectedApi.use('/consultations', require('./modules/encounters/routes').consultations);
  protectedApi.use('/vitals', require('./modules/vitals/routes'));
  protectedApi.use('/conditions', require('./modules/clinical-records/routes').conditions);
  protectedApi.use('/allergies', require('./modules/clinical-records/routes').allergies);
  protectedApi.use('/medications', require('./modules/clinical-records/routes').medications);
  protectedApi.use('/prescriptions', require('./modules/prescriptions/routes'));
  protectedApi.use('/lab-orders', require('./modules/laboratory/routes').orders);
  protectedApi.use('/lab-results', require('./modules/laboratory/routes').results);
  protectedApi.use('/lab-reports', require('./modules/laboratory/routes').reports);
  protectedApi.use('/imaging-studies', require('./modules/imaging/routes').studies);
  protectedApi.use('/medical-images', require('./modules/imaging/routes').medicalImages);
  protectedApi.use('/documents', require('./modules/documents/routes'));
  protectedApi.use('/referrals', require('./modules/referrals/routes'));
  protectedApi.use('/teleconsultations', require('./modules/teleconsultations/routes'));
  protectedApi.use('/invoices', require('./modules/billing/routes').invoices);
  protectedApi.use('/billing', require('./modules/billing/routes').billing);
  protectedApi.use('/notifications', require('./modules/notifications/routes'));
  protectedApi.use('/dashboard', require('./modules/reports/routes'));
  protectedApi.use('/search', require('./modules/search/routes'));
  protectedApi.use('/timeline', require('./modules/timeline/routes'));
  protectedApi.use('/posts', require('./modules/community/routes'));
  protectedApi.use('/clinical-notes', require('./modules/clinical-notes/routes'));
  protectedApi.use('/audit', require('./modules/audit/routes'));
  app.use('/api/v1', protectedApi);

  // ---- FHIR R4 ----
  const fhir = express.Router();
  fhir.use(authenticate(authService.lookupSession));
  fhir.use(fhirLimiter());
  fhir.use(require('./fhir/routes'));
  app.use('/api/fhir/R4', fhir);

  if (env.SWAGGER_ENABLED) {
    const swaggerUi = require('swagger-ui-express');
    const spec = require('./docs/openapi');
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
    app.get('/api/docs.json', (_req, res) => res.json(spec));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
