'use strict';
/**
 * Pharmacy inventory (clinic stock). Mounted at /medications to honour the
 * existing Pharmacy Management page; patient medication records live under
 * /patient-medications.
 */
const express = require('express');
const { z } = require('zod');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString, likePattern } = require('../../common/validation/schemas');
const { serializeRow, pickForDb } = require('../../common/utils/serialize');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { auditInTrx } = require('../audit/auditRepository');

const repo = new BaseRepository('inventory_items');
const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const FIELDS = ['name', 'genericName', 'category', 'form', 'strength', 'unit', 'stock', 'minStock', 'price', 'costPrice', 'supplier', 'manufacturer', 'batchNumber', 'expiryDate', 'location', 'description', 'isActive'];

function statusOf(r) {
  if (r.expiry_date && new Date(r.expiry_date) < new Date()) return 'expired';
  if (r.stock === 0) return 'outOfStock';
  if (r.stock <= r.min_stock) return 'lowStock';
  return 'inStock';
}
const serialize = (r) => ({ ...serializeRow(r), price: Number(r.price), costPrice: r.cost_price === null ? null : Number(r.cost_price), status: statusOf(r), value: Math.round(Number(r.price) * r.stock * 100) / 100 });
function stats(rows) {
  const s = { total: rows.length, inStock: 0, lowStock: 0, outOfStock: 0, expired: 0, totalValue: 0 };
  for (const r of rows) { s[r.status] += 1; s.totalValue += r.value; }
  s.totalValue = Math.round(s.totalValue * 100) / 100;
  return s;
}

const body = z.object({ name: z.string().trim().min(1).max(200).optional(), genericName: optionalString(200), category: optionalString(80), form: optionalString(40), strength: optionalString(40), unit: optionalString(20), stock: z.coerce.number().int().min(0).optional(), minStock: z.coerce.number().int().min(0).optional(), price: z.coerce.number().min(0).optional(), costPrice: z.coerce.number().min(0).optional().nullable(), supplier: optionalString(150), manufacturer: optionalString(150), batchNumber: optionalString(80), expiryDate: z.union([z.coerce.date(), z.literal(''), z.null()]).optional(), location: optionalString(80), description: optionalString(1000), isActive: z.boolean().optional(), clinicId: uuid.optional() }).passthrough();
const listQuery = z.object({ search: z.string().max(100).optional(), status: z.enum(['inStock', 'lowStock', 'outOfStock', 'expired', '']).optional(), category: z.string().max(80).optional(), supplier: z.string().max(150).optional(), sortBy: z.enum(['name', 'stock', 'expiryDate', 'price', 'category']).default('name'), limit: z.coerce.number().int().min(1).max(1000).default(500) });

async function listFor(scope, q) {
  return withTenant(scope, async (trx) => {
    let query = repo.scoped(trx, scope).where('is_active', true);
    if (q.search) query = query.where((b) => b.whereILike('name', likePattern(q.search)).orWhereILike('category', likePattern(q.search)).orWhereILike('supplier', likePattern(q.search)));
    if (q.category) query = query.whereILike('category', likePattern(q.category));
    if (q.supplier) query = query.whereILike('supplier', likePattern(q.supplier));
    const sort = { name: 'name', stock: 'stock', expiryDate: 'expiry_date', price: 'price', category: 'category' }[q.sortBy] || 'name';
    const rows = (await query.orderBy(sort).limit(q.limit)).map(serialize);
    const filtered = q.status ? rows.filter((r) => r.status === q.status) : rows;
    return { medications: filtered, stats: stats(rows) };
  }, getKnex());
}

router.get('/clinic/:clinicId', authorize('settings:read'), tenantScope({ paramName: 'clinicId' }), validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const r = await listFor(req.scope, req.validatedQuery);
  res.json({ success: true, ...r, count: r.medications.length });
}));
router.get('/clinic/:clinicId/stats', authorize('settings:read'), tenantScope({ paramName: 'clinicId' }), asyncHandler(async (req, res) => {
  const r = await listFor(req.scope, { sortBy: 'name', limit: 1000 });
  res.json({ success: true, stats: r.stats });
}));
router.get('/clinic/:clinicId/low-stock', authorize('settings:read'), tenantScope({ paramName: 'clinicId' }), asyncHandler(async (req, res) => {
  const r = await listFor(req.scope, { sortBy: 'stock', limit: 1000 });
  res.json({ success: true, medications: r.medications.filter((m) => m.status === 'lowStock' || m.status === 'outOfStock') });
}));
router.get('/clinic/:clinicId/expiring', authorize('settings:read'), tenantScope({ paramName: 'clinicId' }), validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(90) }) }), asyncHandler(async (req, res) => {
  const limit = new Date(Date.now() + req.validatedQuery.days * 86400000);
  const r = await listFor(req.scope, { sortBy: 'expiryDate', limit: 1000 });
  res.json({ success: true, medications: r.medications.filter((m) => m.expiryDate && new Date(m.expiryDate) <= limit) });
}));
router.get('/:id', authorize('settings:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const row = await withTenant(req.scope, (trx) => repo.findById(trx, req.scope, req.params.id), getKnex());
  if (!row) throw notFound('Medication');
  res.json({ success: true, medication: serialize(row) });
}));
router.post('/', authorize('settings:write'), tenantScope(), validate({ body: body.extend({ name: z.string().trim().min(1).max(200) }) }), asyncHandler(async (req, res) => {
  const clinicId = repo.resolveClinicId(req.scope, req.body.clinicId);
  if (!clinicId) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  const row = await withTenant(req.scope, async (trx) => {
    const data = pickForDb(req.body, FIELDS);
    if (data.expiry_date === '') data.expiry_date = null;
    const [r] = await trx('inventory_items').insert({ ...data, clinic_id: clinicId, created_by: req.scope.userId, updated_by: req.scope.userId }).returning('*');
    await auditInTrx(trx, { ...req.scope, clinicId }, { action: 'INVENTORY_ITEM_CREATED', resourceType: 'inventory_item', resourceId: r.id, ...ctxOf(req) });
    return r;
  }, getKnex());
  res.status(201).json({ success: true, message: 'Medication added', medication: serialize(row) });
}));
router.put('/:id', authorize('settings:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
  const row = await withTenant(req.scope, async (trx) => {
    const data = pickForDb(req.body, FIELDS);
    if (data.expiry_date === '') data.expiry_date = null;
    const r = await repo.update(trx, req.scope, req.params.id, data);
    if (!r) throw notFound('Medication');
    await auditInTrx(trx, req.scope, { action: 'INVENTORY_ITEM_UPDATED', resourceType: 'inventory_item', resourceId: r.id, ...ctxOf(req) });
    return r;
  }, getKnex());
  res.json({ success: true, message: 'Medication updated', medication: serialize(row) });
}));
router.patch('/:id/stock', authorize('settings:write'), tenantScope(), validate({ params: idParam, body: z.object({ adjustment: z.coerce.number().int().optional(), stock: z.coerce.number().int().min(0).optional(), reason: optionalString(200) }) }), asyncHandler(async (req, res) => {
  const row = await withTenant(req.scope, async (trx) => {
    const current = await repo.findById(trx, req.scope, req.params.id);
    if (!current) throw notFound('Medication');
    const stock = req.body.stock !== undefined ? req.body.stock : current.stock + (req.body.adjustment || 0);
    if (stock < 0) throw badRequest('Stock cannot go below zero', 'INVALID_STOCK');
    const r = await repo.update(trx, req.scope, req.params.id, { stock });
    await auditInTrx(trx, req.scope, { action: 'INVENTORY_STOCK_ADJUSTED', resourceType: 'inventory_item', resourceId: r.id, ...ctxOf(req), details: { from: current.stock, to: stock, reason: req.body.reason } });
    return r;
  }, getKnex());
  res.json({ success: true, medication: serialize(row) });
}));
router.delete('/:id', authorize('settings:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await withTenant(req.scope, async (trx) => {
    const ok = await repo.remove(trx, req.scope, req.params.id);
    if (!ok) throw notFound('Medication');
    await auditInTrx(trx, req.scope, { action: 'INVENTORY_ITEM_DELETED', resourceType: 'inventory_item', resourceId: req.params.id, ...ctxOf(req) });
  }, getKnex());
  res.json({ success: true, message: 'Medication removed' });
}));
module.exports = router;
