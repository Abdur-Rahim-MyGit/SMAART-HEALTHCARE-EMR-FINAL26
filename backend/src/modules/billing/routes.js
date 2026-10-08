'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./billingService');

const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const lineItem = z.object({ description: optionalString(300), name: optionalString(300), quantity: z.coerce.number().min(0).optional(), unitPrice: z.coerce.number().min(0).optional(), price: z.coerce.number().min(0).optional(), amount: z.coerce.number().min(0).optional(), total: z.coerce.number().min(0).optional() }).passthrough();
const STATUS = z.enum(['Draft', 'Pending', 'Approved', 'Rejected', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled']);
const body = z.object({ patientId: uuid.optional().nullable(), appointmentId: uuid.optional().nullable(), encounterId: uuid.optional().nullable(), clinicId: uuid.optional(), invoiceNumber: optionalString(40), invoiceNo: optionalString(40), invoiceDate: z.coerce.date().optional(), date: z.coerce.date().optional(), dueDate: z.union([z.coerce.date(), z.literal(''), z.null()]).optional(), status: STATUS.optional(), paymentStatus: optionalString(20), paymentMethod: optionalString(40), lineItems: z.array(lineItem).max(200).optional(), items: z.array(lineItem).max(200).optional(), subtotal: z.coerce.number().min(0).optional(), tax: z.coerce.number().min(0).optional(), discount: z.coerce.number().min(0).optional(), total: z.coerce.number().min(0).optional(), totalAmount: z.coerce.number().min(0).optional(), amount: z.coerce.number().min(0).optional(), paidAmount: z.coerce.number().min(0).optional(), notes: optionalString(2000), description: optionalString(500), currency: optionalString(3), rejectionReason: optionalString(500) }).passthrough();
const listQuery = paginationQuery.extend({ patientId: uuid.optional(), status: z.string().max(20).optional(), search: z.string().max(100).optional(), startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional(), clinicId: uuid.optional() });

const invoices = express.Router();
invoices.get('/', authorize('billing:read'), tenantScope(), validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, from: q.startDate, to: q.endDate, offset: (q.page - 1) * q.limit });
  res.json({ success: true, data: r.data, invoices: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
invoices.get('/stats', authorize('billing:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.stats(req.scope) })));
invoices.get('/stats/overview', authorize('billing:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.stats(req.scope) })));
invoices.get('/overdue', authorize('billing:read'), tenantScope(), asyncHandler(async (req, res) => { const r = await service.list(req.scope, { status: 'Overdue', limit: 200 }); res.json({ success: true, data: r.data }); }));
invoices.get('/patient/:patientId', authorize('billing:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => { const r = await service.list(req.scope, { patientId: req.params.patientId, limit: 200 }); res.json({ success: true, data: r.data, invoices: r.data }); }));
invoices.get('/:id', authorize('billing:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ success: true, data: await service.getById(req.scope, req.params.id) })));
invoices.post('/', authorize('billing:write'), tenantScope(), validate({ body }), asyncHandler(async (req, res) => res.status(201).json({ success: true, message: 'Invoice created successfully', data: await service.create(req.scope, req.body, ctxOf(req)) })));
invoices.put('/:id', authorize('billing:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => res.json({ success: true, message: 'Invoice updated successfully', data: await service.update(req.scope, req.params.id, req.body, ctxOf(req)) })));
invoices.put('/:id/status', authorize('billing:write'), tenantScope(), validate({ params: idParam, body: z.object({ status: STATUS, rejectionReason: optionalString(500) }) }), asyncHandler(async (req, res) => res.json({ success: true, message: 'Invoice status updated', data: await service.update(req.scope, req.params.id, req.body, ctxOf(req)) })));
invoices.post('/:id/payments', authorize('billing:write'), tenantScope(), validate({ params: idParam, body: z.object({ amount: z.coerce.number().positive(), method: optionalString(40), paymentMethod: optionalString(40), reference: optionalString(100), paidAt: z.coerce.date().optional() }) }), asyncHandler(async (req, res) => res.json({ success: true, message: 'Payment recorded', data: await service.addPayment(req.scope, req.params.id, req.body, ctxOf(req)) })));
invoices.delete('/:id', authorize('billing:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => { await service.remove(req.scope, req.params.id, ctxOf(req)); res.json({ success: true, message: 'Invoice deleted' }); }));

// Legacy /billing contract: same invoices, `bills` key.
const billing = express.Router();
billing.get('/', authorize('billing:read'), tenantScope(), validate({ query: listQuery.extend({ limit: z.coerce.number().int().min(1).max(500).default(200) }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, bills: r.data, billingRecords: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
billing.get('/:id', authorize('billing:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ success: true, bill: await service.getById(req.scope, req.params.id) })));
billing.post('/', authorize('billing:write'), tenantScope(), validate({ body }), asyncHandler(async (req, res) => res.status(201).json({ success: true, message: 'Bill created', bill: await service.create(req.scope, req.body, ctxOf(req)) })));
billing.put('/:id', authorize('billing:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => res.json({ success: true, message: 'Bill updated', bill: await service.update(req.scope, req.params.id, req.body, ctxOf(req)) })));

module.exports = { invoices, billing };
