'use strict';
const { z } = require('zod');

const searchParams = z.object({ _count: z.coerce.number().int().min(1).max(200).default(50), _page: z.coerce.number().int().min(1).default(1), patient: z.string().uuid().optional(), subject: z.string().max(80).optional(), encounter: z.string().uuid().optional(), status: z.string().max(40).optional(), date: z.string().max(40).optional(), name: z.string().max(100).optional(), identifier: z.string().max(100).optional(), _lastUpdated: z.string().max(40).optional(), organization: z.string().uuid().optional(), _summary: z.enum(['count', 'true', 'false']).optional() }).passthrough();

/** Minimal validation of an inbound FHIR Patient for create/update. */
const inboundPatient = z.object({ resourceType: z.literal('Patient'), id: z.string().uuid().optional(), active: z.boolean().optional(), name: z.array(z.object({ text: z.string().max(150).optional(), family: z.string().max(80).optional(), given: z.array(z.string().max(80)).optional() })).min(1), gender: z.enum(['male', 'female', 'other', 'unknown']).optional(), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), telecom: z.array(z.object({ system: z.enum(['phone', 'email', 'fax', 'pager', 'url', 'sms', 'other']), value: z.string().max(254) })).optional(), address: z.array(z.object({ line: z.array(z.string().max(200)).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), postalCode: z.string().max(20).optional(), country: z.string().max(100).optional() })).optional(), identifier: z.array(z.object({ system: z.string().max(200).optional(), value: z.string().max(100) })).optional(), managingOrganization: z.object({ reference: z.string().max(120) }).optional() });

/** Extracts a bare id from "Type/id" or "id". */
function refId(value) {
  if (!value) return undefined;
  const parts = String(value).split('/');
  return parts[parts.length - 1];
}

module.exports = { searchParams, inboundPatient, refId };
