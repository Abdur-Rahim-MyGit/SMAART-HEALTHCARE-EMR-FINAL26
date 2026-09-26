'use strict';
/**
 * Tenant-enforcing data access. Services never touch the driver directly: they
 * receive a TenantDb bound to the caller's scope (role + clinicId) and, when the
 * server supports it, to a multi-document transaction.
 *
 * Enforcement (the equivalent of the former PostgreSQL row level security):
 *  - every read/update/delete filter on a clinic-owned collection gets the
 *    caller's clinicId injected for clinic admins;
 *  - inserts by clinic admins are forced to their own clinic;
 *  - soft-deleted documents are hidden unless explicitly requested;
 *  - append-only collections refuse updates and deletes;
 *  - system-only collections are reachable only from the system role.
 */
const crypto = require('crypto');
const { getClient, getDb, supportsTransactions } = require('./connection');
const { COLLECTIONS } = require('./collections');
const { ROLES } = require('../../common/security/rbac');
const { forbidden, badRequest } = require('../../common/errors/AppError');

const SYSTEM_ROLE = 'system';
const isGlobal = (scope) => scope.role === ROLES.SUPER_MASTER_ADMIN || scope.role === SYSTEM_ROLE;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Case-insensitive "contains" matcher with escaped input (no regex injection). */
function contains(term) {
  return { $regex: escapeRegex(term), $options: 'i' };
}

class TenantCollection {
  constructor(name, scope, session) {
    const def = COLLECTIONS[name];
    if (!def) throw new Error(`Unknown collection ${name}`);
    if (def.systemOnly && scope.role !== SYSTEM_ROLE) throw forbidden('Access denied', 'SYSTEM_COLLECTION');
    this.name = name;
    this.def = def;
    this.scope = scope;
    this.session = session;
    this.col = getDb().collection(name);
  }

  /** Applies clinic scope and soft-delete visibility to a filter. */
  scoped(filter = {}, { includeDeleted = false } = {}) {
    const f = { ...filter };
    const tf = this.def.tenantField;
    if (this.def.softDelete && !includeDeleted && f.deletedAt === undefined) f.deletedAt = null;
    if (tf && !isGlobal(this.scope)) {
      if (!this.scope.clinicId) throw forbidden('Missing clinic scope', 'MISSING_CLINIC_SCOPE');
      if (f[tf] !== undefined) {
        // The caller's own tenant condition is kept but ANDed with the enforced clinic: asking for
        // another clinic yields nothing (never an error that reveals existence), $in narrows to own clinic.
        const requested = f[tf];
        delete f[tf];
        return { $and: [f, { [tf]: requested }, { [tf]: this.scope.clinicId }] };
      }
      f[tf] = this.scope.clinicId;
    }
    return f;
  }

  opts(extra = {}) {
    return { ...extra, session: this.session };
  }

  async find(filter, { sort, limit, skip, projection, includeDeleted } = {}) {
    let cur = this.col.find(this.scoped(filter, { includeDeleted }), this.opts({ projection }));
    if (sort) cur = cur.sort(sort);
    if (skip) cur = cur.skip(skip);
    if (limit) cur = cur.limit(limit);
    return cur.toArray();
  }
  async findOne(filter, { projection, includeDeleted } = {}) {
    return this.col.findOne(this.scoped(filter, { includeDeleted }), this.opts({ projection }));
  }
  async findById(id, options) {
    return this.findOne({ _id: id }, options);
  }
  async count(filter, { includeDeleted } = {}) {
    return this.col.countDocuments(this.scoped(filter, { includeDeleted }), this.opts());
  }
  async exists(filter) {
    return !!(await this.col.findOne(this.scoped(filter), this.opts({ projection: { _id: 1 } })));
  }
  async distinct(field, filter) {
    return this.col.distinct(field, this.scoped(filter), this.opts());
  }
  async aggregate(pipeline, { includeDeleted } = {}) {
    return this.col.aggregate([{ $match: this.scoped({}, { includeDeleted }) }, ...pipeline], this.opts()).toArray();
  }

  /** Validates the tenant field of a document about to be written. */
  tenantFor(doc) {
    const tf = this.def.tenantField;
    if (!tf || tf === '_id') return doc;
    const requested = doc[tf];
    if (!isGlobal(this.scope)) {
      if (requested && String(requested) !== String(this.scope.clinicId)) throw forbidden('You can only write to your own clinic', 'CROSS_CLINIC_WRITE');
      return { ...doc, [tf]: this.scope.clinicId };
    }
    if (!requested && this.def.requireTenant !== false) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
    return doc;
  }

  async insertOne(doc) {
    if (this.def.tenantField === '_id' && !isGlobal(this.scope)) throw forbidden('Access denied', 'CROSS_CLINIC_WRITE');
    const now = new Date();
    const full = { _id: doc._id || crypto.randomUUID(), ...this.tenantFor(doc), createdAt: doc.createdAt || now, updatedAt: now, createdBy: doc.createdBy ?? this.scope.userId ?? null, updatedBy: this.scope.userId ?? null };
    if (this.def.softDelete) full.deletedAt = null;
    if (!this.def.appendOnly) full.version = 1;
    await this.col.insertOne(full, this.opts());
    return full;
  }
  async insertMany(docs) {
    const out = [];
    for (const d of docs) out.push(await this.insertOne(d));
    return out;
  }

  /** $set-style update of one document; returns the updated document or null. */
  async updateOne(filter, set, { unset, inc, push, pull, expectedVersion, includeDeleted } = {}) {
    if (this.def.appendOnly) throw forbidden('Collection is append-only', 'APPEND_ONLY');
    const f = this.scoped(filter, { includeDeleted });
    if (expectedVersion !== undefined) f.version = expectedVersion;
    const tf = this.def.tenantField;
    const cleanSet = { ...(set || {}) };
    if (tf && tf !== '_id' && cleanSet[tf] !== undefined && !isGlobal(this.scope) && String(cleanSet[tf]) !== String(this.scope.clinicId)) throw forbidden('You can only write to your own clinic', 'CROSS_CLINIC_WRITE');
    delete cleanSet._id;
    const update = { $set: { ...cleanSet, updatedAt: new Date(), updatedBy: this.scope.userId ?? null } };
    if (unset) update.$unset = unset;
    if (inc) update.$inc = { ...inc };
    if (!this.def.appendOnly) update.$inc = { ...(update.$inc || {}), version: 1 };
    if (push) update.$push = push;
    if (pull) update.$pull = pull;
    return this.col.findOneAndUpdate(f, update, this.opts({ returnDocument: 'after' }));
  }
  async updateMany(filter, set, { includeDeleted } = {}) {
    if (this.def.appendOnly) throw forbidden('Collection is append-only', 'APPEND_ONLY');
    const r = await this.col.updateMany(this.scoped(filter, { includeDeleted }), { $set: { ...set, updatedAt: new Date(), updatedBy: this.scope.userId ?? null } }, this.opts());
    return r.modifiedCount;
  }
  /** Upsert keyed by a unique filter (used for identifiers, refs, counters). */
  async upsertOne(filter, set, setOnInsert = {}) {
    if (this.def.appendOnly) throw forbidden('Collection is append-only', 'APPEND_ONLY');
    const f = this.scoped(filter);
    const now = new Date();
    const insertDefaults = { _id: crypto.randomUUID(), createdAt: now, createdBy: this.scope.userId ?? null, ...setOnInsert };
    if (this.def.softDelete) insertDefaults.deletedAt = null;
    const scopedSet = this.tenantFor({ ...set });
    for (const k of Object.keys(scopedSet)) if (k in insertDefaults) delete insertDefaults[k];
    return this.col.findOneAndUpdate(f, { $set: { ...scopedSet, updatedAt: now }, $setOnInsert: insertDefaults }, this.opts({ upsert: true, returnDocument: 'after' }));
  }
  async softDelete(filter) {
    if (!this.def.softDelete) throw new Error(`${this.name} does not support soft delete`);
    const r = await this.col.updateMany(this.scoped(filter), { $set: { deletedAt: new Date(), updatedAt: new Date(), updatedBy: this.scope.userId ?? null } }, this.opts());
    return r.modifiedCount;
  }
  async deleteMany(filter) {
    if (this.def.appendOnly) throw forbidden('Collection is append-only', 'APPEND_ONLY');
    const r = await this.col.deleteMany(this.scoped(filter, { includeDeleted: true }), this.opts());
    return r.deletedCount;
  }
  async deleteOne(filter) {
    if (this.def.appendOnly) throw forbidden('Collection is append-only', 'APPEND_ONLY');
    const r = await this.col.deleteOne(this.scoped(filter, { includeDeleted: true }), this.opts());
    return r.deletedCount;
  }
}

class TenantDb {
  constructor(scope, session) {
    this.scope = scope;
    this.session = session;
  }
  c(name) {
    return new TenantCollection(name, this.scope, this.session);
  }
  /** Atomic sequence for human-readable numbers (UHID, RX-, INV-). */
  async nextSequence(key) {
    const r = await getDb().collection('counters').findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session: this.session });
    return r.seq;
  }
  /** Direct collection access for the system role only (workers, migrations). */
  raw(name) {
    if (this.scope.role !== SYSTEM_ROLE) throw forbidden('Access denied', 'SYSTEM_COLLECTION');
    return getDb().collection(name);
  }
}

/**
 * Runs fn(db) inside a transaction bound to the scope. Falls back to a plain
 * session when the server is not a replica set (development only).
 */
async function withTenant(scope, fn) {
  if (!scope || !scope.role) throw new Error('withTenant requires a scope with a role');
  if (!supportsTransactions()) return fn(new TenantDb(scope, undefined));
  const session = getClient().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(new TenantDb(scope, session));
    }, { readConcern: { level: 'majority' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    return result;
  } finally {
    await session.endSession();
  }
}
function withSystem(fn) {
  return withTenant({ role: SYSTEM_ROLE }, fn);
}
/** Effective clinic filter for a scope: null means "no filter" (global roles). */
function clinicFilter(scope) {
  if (isGlobal(scope)) return null;
  if (!scope.clinicId) throw forbidden('Missing clinic scope', 'MISSING_CLINIC_SCOPE');
  return scope.clinicId;
}
/** Clinic a write should target: clinic admins always their own; global roles must name one. */
function resolveClinicId(scope, requested) {
  if (isGlobal(scope)) return requested || null;
  if (requested && String(requested) !== String(scope.clinicId)) throw forbidden('You can only manage records of your own clinic', 'CROSS_CLINIC_WRITE');
  return scope.clinicId;
}

module.exports = { withTenant, withSystem, clinicFilter, resolveClinicId, contains, escapeRegex, SYSTEM_ROLE, TenantDb };
