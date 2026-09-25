'use strict';
/**
 * OpenAPI 3 description of the REST API. Generated from the route table so the
 * documentation cannot drift from the mounted modules; details per operation are
 * kept intentionally compact.
 */
const envelope = { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, requestId: { type: 'string' } } };
const error = { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string' }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } }, requestId: { type: 'string' } } };
const resources = [
  ['clinics', 'Clinics', 'clinics:read / clinics:manage (super master admin)'], ['users', 'Users', 'users:read / users:manage'], ['patients', 'Patients', 'patients:*'], ['doctors', 'Practitioners (doctors)', 'practitioners:*'], ['nurses', 'Practitioners (nurses)', 'practitioners:*'], ['appointments', 'Appointments', 'appointments:*'], ['consultations', 'Encounters (legacy consultations contract)', 'clinical:*'], ['encounters', 'Encounters', 'clinical:*'], ['vitals', 'Vitals', 'clinical:*'], ['conditions', 'Clinical conditions', 'clinical:*'], ['allergies', 'Allergies', 'clinical:*'], ['medications', 'Medications', 'clinical:*'], ['prescriptions', 'Prescriptions', 'clinical:*'], ['lab-orders', 'Lab orders', 'clinical:*'], ['lab-reports', 'Lab results / reports', 'clinical:*'], ['medical-images', 'Imaging studies (legacy medical images contract)', 'clinical:read, documents:write'], ['documents', 'Documents (Cloudinary backed, signed access)', 'documents:*'], ['referrals', 'Referrals', 'referrals:*'], ['teleconsultations', 'Teleconsultations', 'clinical:*'], ['invoices', 'Invoices', 'billing:*'], ['billing', 'Invoices (legacy billing contract)', 'billing:*'], ['notifications', 'Notifications', 'notifications:read'], ['dashboard', 'Reports & dashboards', 'reports:*'], ['search', 'Search', 'patients:read'], ['posts', 'Community hub (MongoDB)', 'community:*'], ['clinical-notes', 'Clinical notes (MongoDB)', 'clinical:*'], ['audit', 'Audit logs (append only)', 'audit:read'],
];
const paths = {
  '/health': { get: { tags: ['Health'], summary: 'Overall health with dependency checks', security: [], responses: { 200: { description: 'ok' }, 503: { description: 'degraded' } } } },
  '/health/live': { get: { tags: ['Health'], summary: 'Liveness', security: [], responses: { 200: { description: 'alive' } } } },
  '/health/ready': { get: { tags: ['Health'], summary: 'Readiness (PostgreSQL, MongoDB, Redis, RabbitMQ)', security: [], responses: { 200: { description: 'ready' }, 503: { description: 'not ready' } } } },
  '/api/v1/auth/login': { post: { tags: ['Auth'], summary: 'Password login (development only; production requires OTP)', security: [], requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 200: { description: 'access token + refresh cookie' }, 401: { description: 'invalid credentials' } } } },
  '/api/v1/auth/clinic-login': { post: { tags: ['Auth'], summary: 'Clinic admin login', security: [], responses: { 200: { description: 'token + clinic' } } } },
  '/api/v1/auth/request-login-otp': { post: { tags: ['Auth'], summary: 'Step 1 of OTP login', security: [], responses: { 200: { description: 'userId' } } } },
  '/api/v1/auth/verify-login-otp': { post: { tags: ['Auth'], summary: 'Step 2 of OTP login', security: [], responses: { 200: { description: 'token' } } } },
  '/api/v1/auth/refresh': { post: { tags: ['Auth'], summary: 'Rotate refresh token (httpOnly cookie) and issue a new access token', security: [], responses: { 200: { description: 'token' } } } },
  '/api/v1/auth/logout': { post: { tags: ['Auth'], summary: 'Revoke current session', responses: { 200: { description: 'ok' } } } },
  '/api/v1/auth/forgot-password': { post: { tags: ['Auth'], summary: 'Send reset OTP (no user enumeration)', security: [], responses: { 200: { description: 'ok' } } } },
  '/api/v1/auth/verify-reset-otp': { post: { tags: ['Auth'], summary: 'Verify reset OTP → resetToken', security: [], responses: { 200: { description: 'resetToken' } } } },
  '/api/v1/auth/reset-password': { post: { tags: ['Auth'], summary: 'Set new password with resetToken; revokes all sessions', security: [], responses: { 200: { description: 'ok' } } } },
  '/api/v1/auth/me': { get: { tags: ['Auth'], summary: 'Current user', responses: { 200: { description: 'user' } } } },
  '/api/v1/auth/sessions': { get: { tags: ['Auth'], summary: 'List own sessions', responses: { 200: { description: 'sessions' } } } },
  '/api/v1/auth/change-password': { post: { tags: ['Auth'], summary: 'Change own password', responses: { 200: { description: 'ok' } } } },
  '/api/v1/documents/{id}/access': { get: { tags: ['Documents'], summary: 'Short-lived signed URL for an authorised document', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'url + expiresAt' }, 403: { description: 'not available' }, 404: { description: 'not found' } } } },
  '/api/v1/documents/{id}/download': { get: { tags: ['Documents'], summary: 'Stream a document through the API (audited)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'file' } } } },
  '/api/fhir/R4/metadata': { get: { tags: ['FHIR'], summary: 'CapabilityStatement', security: [], responses: { 200: { description: 'CapabilityStatement' } } } },
  '/api/fhir/R4/{resourceType}': { get: { tags: ['FHIR'], summary: 'Search (Patient, Organization, Practitioner, Appointment, Encounter, Condition, Observation, AllergyIntolerance, Medication, MedicationRequest, DiagnosticReport, DocumentReference, ImagingStudy, Procedure, ServiceRequest)', parameters: [{ name: 'resourceType', in: 'path', required: true, schema: { type: 'string' } }, { name: 'patient', in: 'query', schema: { type: 'string', format: 'uuid' } }, { name: '_count', in: 'query', schema: { type: 'integer' } }, { name: '_page', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'Bundle' } } } },
  '/api/fhir/R4/{resourceType}/{id}': { get: { tags: ['FHIR'], summary: 'Read', parameters: [{ name: 'resourceType', in: 'path', required: true, schema: { type: 'string' } }, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'resource' }, 404: { description: 'OperationOutcome' } } } },
};
for (const [path, tag, perm] of resources) {
  const idParam = [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }];
  paths[`/api/v1/${path}`] = { get: { tags: [tag], summary: `List ${tag} (clinic scoped; ${perm})`, parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'list' }, 401: { description: 'unauthenticated', content: { 'application/json': { schema: error } } }, 403: { description: 'forbidden' } } }, post: { tags: [tag], summary: `Create (${perm})`, responses: { 201: { description: 'created' }, 422: { description: 'validation error', content: { 'application/json': { schema: error } } } } } };
  paths[`/api/v1/${path}/{id}`] = { get: { tags: [tag], summary: 'Read', parameters: idParam, responses: { 200: { description: 'item' }, 404: { description: 'not found' } } }, put: { tags: [tag], summary: 'Update', parameters: idParam, responses: { 200: { description: 'updated' } } }, delete: { tags: [tag], summary: 'Delete (soft)', parameters: idParam, responses: { 200: { description: 'deleted' } } } };
}
module.exports = {
  openapi: '3.0.3',
  info: { title: 'SMAART Healthcare EMR API', version: '2.0.0', description: 'Secure multi-tenant EMR API. Roles: super_master_admin, clinic_admin. All /api/v1 and /api/fhir/R4 routes require a Bearer access token; clinic scope is derived from the token. Legacy un-versioned paths (/api/<module>) are aliases of /api/v1/<module>.' },
  servers: [{ url: '/' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas: { Envelope: envelope, Error: error } },
  security: [{ bearerAuth: [] }],
  paths,
};
