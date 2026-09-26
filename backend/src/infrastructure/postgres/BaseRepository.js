'use strict';
const { clinicFilter } = require('./tenant');
const { forbidden } = require('../../common/errors/AppError');
const { ROLES } = require('../../common/security/rbac');

/**
 * Generic clinic-scoped repository over a single table. Every method takes a
 * transaction (trx) and the caller's scope; clinic filters are mandatory for
 * clinic admins. Soft deletes are honoured when the table has deleted_at.
 */
class BaseRepository {
  constructor(table, { softDelete = true, tenantColumn = 'clinic_id' } = {}) {
    this.table = table;
    this.softDelete = softDelete;
    this.tenantColumn = tenantColumn;
  }

  scoped(trx, scope) {
    let q = trx(this.table);
    if (this.softDelete) q = q.whereNull(`${this.table}.deleted_at`);
    const clinicId = this.tenantColumn ? clinicFilter(scope) : null;
    if (clinicId) q = q.where(`${this.table}.${this.tenantColumn}`, clinicId);
    return q;
  }

  /**
   * Resolves the clinic a write should target. Clinic admins always write to
   * their own clinic; the super master admin must name one explicitly.
   */
  resolveClinicId(scope, requested) {
    if (scope.role === ROLES.SUPER_MASTER_ADMIN) return requested || null;
    if (requested && String(requested) !== String(scope.clinicId)) {
      throw forbidden('You can only manage records of your own clinic', 'CROSS_CLINIC_WRITE');
    }
    return scope.clinicId;
  }

  async findById(trx, scope, id) {
    return this.scoped(trx, scope).where(`${this.table}.id`, id).first();
  }

  async list(trx, scope, { where = {}, orderBy = [{ column: 'created_at', order: 'desc' }], limit, offset } = {}) {
    let q = this.scoped(trx, scope);
    for (const [k, v] of Object.entries(where)) if (v !== undefined) q = q.where(`${this.table}.${k}`, v);
    for (const o of orderBy) q = q.orderBy(`${this.table}.${o.column}`, o.order);
    if (limit !== undefined) q = q.limit(limit);
    if (offset !== undefined) q = q.offset(offset);
    return q;
  }

  async count(trx, scope, where = {}) {
    let q = this.scoped(trx, scope);
    for (const [k, v] of Object.entries(where)) if (v !== undefined) q = q.where(`${this.table}.${k}`, v);
    const [{ count }] = await q.count({ count: '*' });
    return Number(count);
  }

  async insert(trx, scope, data) {
    const [row] = await trx(this.table).insert({ ...data, created_by: scope.userId || null, updated_by: scope.userId || null }).returning('*');
    return row;
  }

  async update(trx, scope, id, data, { expectedVersion } = {}) {
    let q = this.scoped(trx, scope).where(`${this.table}.id`, id);
    if (expectedVersion !== undefined) q = q.where(`${this.table}.version`, expectedVersion);
    const patch = { ...data, updated_by: scope.userId || null, updated_at: trx.fn.now() };
    const rows = await q.update(patch).returning('*');
    return rows[0] || null;
  }

  async remove(trx, scope, id) {
    if (this.softDelete) {
      const rows = await this.scoped(trx, scope).where(`${this.table}.id`, id).update({ deleted_at: trx.fn.now(), updated_by: scope.userId || null }).returning('id');
      return rows.length > 0;
    }
    const n = await this.scoped(trx, scope).where(`${this.table}.id`, id).delete();
    return n > 0;
  }
}

module.exports = { BaseRepository };
