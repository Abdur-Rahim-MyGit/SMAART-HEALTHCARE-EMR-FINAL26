'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { likePattern } = require('../../common/validation/schemas');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');

const repo = new BaseRepository('invoices');
const money = (v) => Math.round((Number(v) || 0) * 100) / 100;

function computeTotals(input, current = {}) {
  const items = input.lineItems || input.items || current.line_items || [];
  const subtotal = input.subtotal !== undefined ? money(input.subtotal) : money(items.reduce((s, i) => s + (Number(i.total) || (Number(i.quantity) || 1) * (Number(i.unitPrice ?? i.price ?? i.amount) || 0)), 0));
  const tax = money(input.tax ?? current.tax ?? 0);
  const discount = money(input.discount ?? current.discount ?? 0);
  const total = input.total !== undefined ? money(input.total) : input.totalAmount !== undefined ? money(input.totalAmount) : input.amount !== undefined ? money(input.amount) : money(subtotal + tax - discount);
  return { line_items: JSON.stringify(items), subtotal, tax, discount, total };
}

function toRow(input, current) {
  const row = computeTotals(input, current);
  if (input.patientId !== undefined) row.patient_id = input.patientId || null;
  if (input.appointmentId !== undefined) row.appointment_id = input.appointmentId || null;
  if (input.encounterId !== undefined) row.encounter_id = input.encounterId || null;
  if (input.invoiceNumber !== undefined || input.invoiceNo !== undefined) row.invoice_number = input.invoiceNumber || input.invoiceNo;
  if (input.invoiceDate !== undefined || input.date !== undefined) row.invoice_date = new Date(input.invoiceDate || input.date);
  if (input.dueDate !== undefined) row.due_date = input.dueDate || null;
  if (input.status !== undefined) row.status = input.status;
  else if (input.paymentStatus !== undefined) row.status = { paid: 'Paid', pending: 'Pending', partial: 'Partially Paid', overdue: 'Overdue', cancelled: 'Cancelled' }[String(input.paymentStatus).toLowerCase()] || input.paymentStatus;
  if (input.paymentMethod !== undefined) row.payment_method = input.paymentMethod;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.description !== undefined) row.description = input.description;
  if (input.paidAmount !== undefined) row.paid_amount = money(input.paidAmount);
  if (input.currency !== undefined) row.currency = input.currency;
  return row;
}

function serialize(r, { patient, clinic } = {}) {
  const s = serializeRow(r);
  const total = Number(r.total);
  return { ...s, invoiceNo: r.invoice_number, date: r.invoice_date, items: r.line_items, total, totalAmount: total, amount: total, subtotal: Number(r.subtotal), tax: Number(r.tax), discount: Number(r.discount), paidAmount: Number(r.paid_amount), balance: money(total - Number(r.paid_amount)), paymentStatus: r.status === 'Paid' ? 'paid' : r.status === 'Partially Paid' ? 'partial' : r.status === 'Overdue' ? 'overdue' : r.status === 'Cancelled' ? 'cancelled' : 'pending', patientId: patient || (r.patient_id ? ref(r.patient_id) : null), patientName: patient ? patient.fullName : null, patientPhone: patient ? patient.phone : null, patientEmail: patient ? patient.email : null, clinicId: clinic ? ref(r.clinic_id, { name: clinic.name }) : r.clinic_id };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const pmap = await patients.refsFor(trx, rows.map((r) => r.patient_id));
  const clinics = await trx('clinics').whereIn('id', [...new Set(rows.map((r) => r.clinic_id))]).select('id', 'name');
  const cmap = Object.fromEntries(clinics.map((c) => [c.id, c]));
  return rows.map((r) => serialize(r, { patient: pmap[r.patient_id], clinic: cmap[r.clinic_id] }));
}

async function nextNumber(trx, clinicId) {
  const [{ c }] = await trx('invoices').where({ clinic_id: clinicId }).count({ c: '*' });
  return `INV-${new Date().getFullYear()}-${String(Number(c) + 1).padStart(6, '0')}`;
}

async function list(scope, { patientId, status, search, from, to, clinicId, page = 1, limit = 50, offset = 0 }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (status) q = q.where('status', status);
    if (from) q = q.where('invoice_date', '>=', from);
    if (to) q = q.where('invoice_date', '<=', to);
    if (search) q = q.where((b) => b.whereILike('invoice_number', likePattern(search)).orWhereIn('patient_id', trx('patients').select('id').whereILike('full_name', likePattern(search))));
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('invoice_date', 'desc').orderBy('created_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}
async function getById(scope, id) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Invoice');
    const [i] = await hydrate(trx, [row]);
    return i;
  }, getKnex());
}
async function create(scope, input, ctx) {
  return withTenant(scope, async (trx) => {
    let clinicId = repo.resolveClinicId(scope, input.clinicId);
    if (input.patientId) { const patient = await patients.assertPatient(trx, scope, input.patientId); clinicId = patient.clinic_id; }
    if (!clinicId) throw badRequest('clinicId or patientId is required', 'CLINIC_REQUIRED');
    const row = toRow(input);
    let created;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        [created] = await trx('invoices').insert({ ...row, clinic_id: clinicId, invoice_number: row.invoice_number || (await nextNumber(trx, clinicId)), invoice_date: row.invoice_date || new Date(), created_by: scope.userId, updated_by: scope.userId }).returning('*');
        break;
      } catch (err) { if (err.code !== '23505' || row.invoice_number || attempt === 2) throw err; }
    }
    await auditInTrx(trx, { ...scope, clinicId }, { action: 'INVOICE_CREATED', resourceType: 'invoice', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'invoice.created', aggregateType: 'invoice', aggregateId: created.id, clinicId, actorId: scope.userId, payload: { total: created.total } });
    const [i] = await hydrate(trx, [created]);
    return i;
  }, getKnex());
}
async function update(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Invoice');
    const row = toRow(input, current);
    delete row.patient_id;
    if (input.status === 'Approved') row.approved_by = scope.userId;
    if (input.status === 'Rejected') { row.rejected_by = scope.userId; row.rejection_reason = input.rejectionReason || null; }
    const updated = await repo.update(trx, scope, id, row);
    await auditInTrx(trx, scope, { action: 'INVOICE_UPDATED', resourceType: 'invoice', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { status: updated.status } });
    await enqueueEvent(trx, { type: 'invoice.updated', aggregateType: 'invoice', aggregateId: id, clinicId: updated.clinic_id, actorId: scope.userId, payload: { status: updated.status } });
    const [i] = await hydrate(trx, [updated]);
    return i;
  }, getKnex());
}
async function addPayment(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Invoice');
    const amount = money(input.amount);
    if (amount <= 0) throw badRequest('Payment amount must be positive', 'VALIDATION_ERROR');
    const payments = [...(current.payments || []), { amount, method: input.method || input.paymentMethod || 'cash', reference: input.reference || null, paidAt: input.paidAt || new Date(), recordedBy: scope.userId }];
    const paid = money(Number(current.paid_amount) + amount);
    const status = paid >= Number(current.total) ? 'Paid' : 'Partially Paid';
    const updated = await repo.update(trx, scope, id, { payments: JSON.stringify(payments), paid_amount: paid, status, payment_method: input.method || input.paymentMethod || current.payment_method });
    await auditInTrx(trx, scope, { action: 'INVOICE_PAYMENT_RECORDED', resourceType: 'invoice', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { amount } });
    await enqueueEvent(trx, { type: 'invoice.payment.recorded', aggregateType: 'invoice', aggregateId: id, clinicId: updated.clinic_id, actorId: scope.userId, payload: { amount, status } });
    const [i] = await hydrate(trx, [updated]);
    return i;
  }, getKnex());
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const ok = await repo.remove(trx, scope, id);
    if (!ok) throw notFound('Invoice');
    await auditInTrx(trx, scope, { action: 'INVOICE_DELETED', resourceType: 'invoice', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}
async function stats(scope) {
  return withTenant(scope, async (trx) => {
    const base = repo.scoped(trx, scope);
    const n = async (q) => Number((await q.count({ c: '*' }))[0].c);
    const [totalInvoices, paidInvoices, pendingInvoices, overdueInvoices] = await Promise.all([n(base.clone()), n(base.clone().where('status', 'Paid')), n(base.clone().whereIn('status', ['Pending', 'Approved', 'Partially Paid'])), n(base.clone().where('status', 'Overdue'))]);
    const [{ revenue }] = await base.clone().where('status', 'Paid').sum({ revenue: 'total' });
    const [{ outstanding }] = await base.clone().whereNotIn('status', ['Paid', 'Cancelled', 'Rejected']).sum({ outstanding: trx.raw('total - paid_amount') });
    return { totalInvoices, paidInvoices, pendingInvoices, overdueInvoices, totalRevenue: money(revenue), outstandingAmount: money(outstanding) };
  }, getKnex());
}
module.exports = { list, getById, create, update, addPayment, remove, stats, repo };
