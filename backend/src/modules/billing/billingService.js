'use strict';
const { withTenant, resolveClinicId, contains } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;

function computeTotals(input, current = {}) {
  const items = input.lineItems || input.items || current.lineItems || [];
  const subtotal = input.subtotal !== undefined ? money(input.subtotal) : money(items.reduce((s, i) => s + (Number(i.total) || (Number(i.quantity) || 1) * (Number(i.unitPrice ?? i.price ?? i.amount) || 0)), 0));
  const tax = money(input.tax ?? current.tax ?? 0);
  const discount = money(input.discount ?? current.discount ?? 0);
  const total = input.total !== undefined ? money(input.total) : input.totalAmount !== undefined ? money(input.totalAmount) : input.amount !== undefined ? money(input.amount) : money(subtotal + tax - discount);
  return { lineItems: items, subtotal, tax, discount, total };
}

function toDoc(input, current) {
  const d = computeTotals(input, current);
  if (input.patientId !== undefined) d.patientId = input.patientId || null;
  if (input.appointmentId !== undefined) d.appointmentId = input.appointmentId || null;
  if (input.encounterId !== undefined) d.encounterId = input.encounterId || null;
  if (input.invoiceNumber !== undefined || input.invoiceNo !== undefined) d.invoiceNumber = input.invoiceNumber || input.invoiceNo;
  if (input.invoiceDate !== undefined || input.date !== undefined) d.invoiceDate = new Date(input.invoiceDate || input.date);
  if (input.dueDate !== undefined) d.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.status !== undefined) d.status = input.status;
  else if (input.paymentStatus !== undefined) d.status = { paid: 'Paid', pending: 'Pending', partial: 'Partially Paid', overdue: 'Overdue', cancelled: 'Cancelled' }[String(input.paymentStatus).toLowerCase()] || input.paymentStatus;
  if (input.paymentMethod !== undefined) d.paymentMethod = input.paymentMethod;
  if (input.notes !== undefined) d.notes = input.notes;
  if (input.description !== undefined) d.description = input.description;
  if (input.paidAmount !== undefined) d.paidAmount = money(input.paidAmount);
  if (input.currency !== undefined) d.currency = input.currency;
  return d;
}

function serialize(r, { patient, clinic } = {}) {
  const s = serializeRow(r);
  const total = Number(r.total);
  const paid = Number(r.paidAmount || 0);
  return { ...s, invoiceNo: r.invoiceNumber, date: r.invoiceDate, items: r.lineItems, total, totalAmount: total, amount: total, subtotal: Number(r.subtotal), tax: Number(r.tax), discount: Number(r.discount), paidAmount: paid, balance: money(total - paid), paymentStatus: r.status === 'Paid' ? 'paid' : r.status === 'Partially Paid' ? 'partial' : r.status === 'Overdue' ? 'overdue' : r.status === 'Cancelled' ? 'cancelled' : 'pending', patientId: patient || (r.patientId ? ref(r.patientId) : null), patientName: patient ? patient.fullName : null, patientPhone: patient ? patient.phone : null, patientEmail: patient ? patient.email : null, clinicId: clinic ? ref(r.clinicId, { name: clinic.name }) : r.clinicId };
}

async function hydrate(db, rows) {
  if (!rows.length) return [];
  const [pmap, clinics] = await Promise.all([patients.refsFor(db, rows.map((r) => r.patientId)), db.c('clinics').find({ _id: { $in: [...new Set(rows.map((r) => r.clinicId))] } }, { projection: { name: 1 } })]);
  const cmap = Object.fromEntries(clinics.map((c) => [c._id, c]));
  return rows.map((r) => serialize(r, { patient: pmap[r.patientId], clinic: cmap[r.clinicId] }));
}

async function nextNumber(db, clinicId) {
  const seq = await db.nextSequence(`invoice:${clinicId}`);
  return `INV-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
}

async function list(scope, { patientId, status, search, from, to, clinicId, page = 1, limit = 50, offset = 0 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    if (from || to) filter.invoiceDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    if (search) {
      const matches = await db.c('patients').find({ fullName: contains(search) }, { projection: { _id: 1 }, limit: 200 });
      filter.$or = [{ invoiceNumber: contains(search) }, { patientId: { $in: matches.map((p) => p._id) } }];
    }
    const col = db.c('invoices');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { invoiceDate: -1, createdAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, id) {
  return withTenant(scope, async (db) => {
    const row = await db.c('invoices').findById(id);
    if (!row) throw notFound('Invoice');
    return (await hydrate(db, [row]))[0];
  });
}
async function create(scope, input, ctx) {
  return withTenant(scope, async (db) => {
    let clinicId = resolveClinicId(scope, input.clinicId);
    if (input.patientId) { const patient = await patients.assertPatient(db, scope, input.patientId); clinicId = patient.clinicId; }
    if (!clinicId) throw badRequest('clinicId or patientId is required', 'CLINIC_REQUIRED');
    const d = toDoc(input);
    let created;
    try {
      created = await db.c('invoices').insertOne({ status: 'Pending', currency: 'INR', paidAmount: 0, payments: [], patientId: null, appointmentId: null, encounterId: null, dueDate: null, paymentMethod: null, notes: null, description: null, ...d, clinicId, invoiceNumber: d.invoiceNumber || (await nextNumber(db, clinicId)), invoiceDate: d.invoiceDate || new Date() });
    } catch (err) {
      if (err.code === 11000) throw badRequest('Invoice number already exists', 'DUPLICATE_INVOICE_NUMBER');
      throw err;
    }
    await auditInTrx(db, { ...scope, clinicId }, { action: 'INVOICE_CREATED', resourceType: 'invoice', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'invoice.created', aggregateType: 'invoice', aggregateId: created._id, clinicId, actorId: scope.userId, payload: { total: created.total } });
    return (await hydrate(db, [created]))[0];
  });
}
async function update(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const col = db.c('invoices');
    const current = await col.findById(id);
    if (!current) throw notFound('Invoice');
    const d = toDoc(input, current);
    delete d.patientId;
    if (input.status === 'Approved') d.approvedBy = scope.userId;
    if (input.status === 'Rejected') { d.rejectedBy = scope.userId; d.rejectionReason = input.rejectionReason || null; }
    const updated = await col.updateOne({ _id: id }, d);
    await auditInTrx(db, scope, { action: 'INVOICE_UPDATED', resourceType: 'invoice', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { status: updated.status } });
    await enqueueEvent(db, { type: 'invoice.updated', aggregateType: 'invoice', aggregateId: id, clinicId: updated.clinicId, actorId: scope.userId, payload: { status: updated.status } });
    return (await hydrate(db, [updated]))[0];
  });
}
async function addPayment(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const col = db.c('invoices');
    const current = await col.findById(id);
    if (!current) throw notFound('Invoice');
    const amount = money(input.amount);
    if (amount <= 0) throw badRequest('Payment amount must be positive', 'VALIDATION_ERROR');
    const method = input.method || input.paymentMethod || 'cash';
    const payment = { amount, method, reference: input.reference || null, paidAt: input.paidAt ? new Date(input.paidAt) : new Date(), recordedBy: scope.userId };
    const paid = money(Number(current.paidAmount || 0) + amount);
    const status = paid >= Number(current.total) ? 'Paid' : 'Partially Paid';
    // Optimistic concurrency: two simultaneous payments cannot both apply to the same version.
    const updated = await col.updateOne({ _id: id }, { paidAmount: paid, status, paymentMethod: input.method || input.paymentMethod || current.paymentMethod }, { push: { payments: payment }, expectedVersion: current.version });
    if (!updated) throw badRequest('Invoice was modified concurrently, please retry', 'CONCURRENT_MODIFICATION');
    await auditInTrx(db, scope, { action: 'INVOICE_PAYMENT_RECORDED', resourceType: 'invoice', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { amount } });
    await enqueueEvent(db, { type: 'invoice.payment.recorded', aggregateType: 'invoice', aggregateId: id, clinicId: updated.clinicId, actorId: scope.userId, payload: { amount, status } });
    return (await hydrate(db, [updated]))[0];
  });
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const n = await db.c('invoices').softDelete({ _id: id });
    if (!n) throw notFound('Invoice');
    await auditInTrx(db, scope, { action: 'INVOICE_DELETED', resourceType: 'invoice', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}
async function stats(scope) {
  return withTenant(scope, async (db) => {
    const col = db.c('invoices');
    const [totalInvoices, paidInvoices, pendingInvoices, overdueInvoices, sums] = await Promise.all([
      col.count({}), col.count({ status: 'Paid' }), col.count({ status: { $in: ['Pending', 'Approved', 'Partially Paid'] } }), col.count({ status: 'Overdue' }),
      col.aggregate([{ $group: { _id: null, revenue: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$total', 0] } }, outstanding: { $sum: { $cond: [{ $in: ['$status', ['Paid', 'Cancelled', 'Rejected']] }, 0, { $subtract: ['$total', { $ifNull: ['$paidAmount', 0] }] }] } } } }]),
    ]);
    const s = sums[0] || {};
    return { totalInvoices, paidInvoices, pendingInvoices, overdueInvoices, totalRevenue: money(s.revenue), outstandingAmount: money(s.outstanding) };
  });
}
module.exports = { list, getById, create, update, addPayment, remove, stats };
