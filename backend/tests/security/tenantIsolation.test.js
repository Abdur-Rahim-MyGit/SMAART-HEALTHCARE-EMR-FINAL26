'use strict';
/**
 * Data-layer tenant isolation. The tenant wrapper is the only way services reach
 * MongoDB, so these tests prove a clinic admin scope can never read, change,
 * create or delete another clinic's documents, whatever filter it supplies.
 */
const crypto = require('crypto');
const { resetData, raw } = require('../helpers/api');
const { withTenant, withSystem } = require('../../src/infrastructure/mongodb/tenant');
const { ROLES } = require('../../src/common/security/rbac');

const uuid = () => crypto.randomUUID();
const clinicA = uuid(), clinicB = uuid();
const adminA = { role: ROLES.CLINIC_ADMIN, clinicId: clinicA, userId: uuid() };
const adminB = { role: ROLES.CLINIC_ADMIN, clinicId: clinicB, userId: uuid() };
const superAdmin = { role: ROLES.SUPER_MASTER_ADMIN, clinicId: null, userId: uuid() };
let pa, pb;

describe('tenant enforcement in the data layer', () => {
  beforeAll(async () => {
    await resetData();
    await withSystem(async (db) => {
      for (const [id, name] of [[clinicA, 'A'], [clinicB, 'B']]) await db.c('clinics').insertOne({ _id: id, name: `Clinic ${name}`, adminEmail: `${name.toLowerCase()}@iso.local`, isActive: true, validityStart: new Date(), validityEnd: new Date(Date.now() + 86400000 * 365) });
      pa = await db.c('patients').insertOne({ clinicId: clinicA, fullName: 'Alice A', status: 'active' });
      pb = await db.c('patients').insertOne({ clinicId: clinicB, fullName: 'Bob B', status: 'active' });
    });
  });

  it('reads are always filtered to the caller clinic, even with a forged filter', async () => {
    await withTenant(adminA, async (db) => {
      expect((await db.c('patients').find({})).map((p) => p._id)).toEqual([pa._id]);
      expect(await db.c('patients').findById(pb._id)).toBeNull();
      expect(await db.c('patients').findOne({ clinicId: clinicB })).toBeNull();
      expect(await db.c('patients').count({ clinicId: { $in: [clinicA, clinicB] } })).toBe(1);
      expect(await db.c('patients').count({ $or: [{ clinicId: clinicB }, { fullName: 'Bob B' }] })).toBe(0);
      expect(await db.c('clinics').findById(clinicB)).toBeNull();
      expect((await db.c('clinics').find({})).map((c) => c._id)).toEqual([clinicA]);
    });
    await withTenant(superAdmin, async (db) => {
      expect(await db.c('patients').count({})).toBe(2);
    });
  });

  it('writes cannot target or move documents across clinics', async () => {
    await withTenant(adminA, async (db) => {
      expect(await db.c('patients').updateOne({ _id: pb._id }, { fullName: 'Hacked' })).toBeNull();
      await expect(db.c('patients').insertOne({ clinicId: clinicB, fullName: 'Intruder', status: 'active' })).rejects.toMatchObject({ code: 'CROSS_CLINIC_WRITE' });
      await expect(db.c('patients').updateOne({ _id: pa._id }, { clinicId: clinicB })).rejects.toMatchObject({ code: 'CROSS_CLINIC_WRITE' });
      await expect(db.c('clinics').insertOne({ name: 'Rogue', adminEmail: 'r@x.local', isActive: true, validityStart: new Date(), validityEnd: new Date() })).rejects.toMatchObject({ code: 'CROSS_CLINIC_WRITE' });
      expect(await db.c('patients').softDelete({ _id: pb._id })).toBe(0);
      expect(await db.c('patients').deleteMany({ _id: pb._id })).toBe(0);
      expect(await db.c('patients').deleteMany({ clinicId: clinicB })).toBe(0);
      const inserted = await db.c('patients').insertOne({ fullName: 'Carol A', status: 'active' });
      expect(inserted.clinicId).toBe(clinicA);
    });
    expect((await raw('patients').findOne({ _id: pb._id })).fullName).toBe('Bob B');
    expect(await raw('patients').countDocuments({ clinicId: clinicB })).toBe(1);
  });

  it('soft-deleted documents disappear from normal reads but stay in the database', async () => {
    await withTenant(adminB, async (db) => {
      expect(await db.c('patients').softDelete({ _id: pb._id })).toBe(1);
      expect(await db.c('patients').findById(pb._id)).toBeNull();
      expect(await db.c('patients').findById(pb._id, { includeDeleted: true })).not.toBeNull();
    });
    expect((await raw('patients').findOne({ _id: pb._id })).deletedAt).toBeInstanceOf(Date);
  });

  it('append-only and system collections refuse misuse', async () => {
    await withTenant(adminA, async (db) => {
      await expect(db.c('audit_logs').updateOne({ action: 'x' }, { action: 'y' })).rejects.toMatchObject({ code: 'APPEND_ONLY' });
      await expect(db.c('audit_logs').deleteMany({})).rejects.toMatchObject({ code: 'APPEND_ONLY' });
      expect(() => db.c('auth_sessions')).toThrow(/Access denied/);
      expect(() => db.c('outbox_events')).toThrow(/Access denied/);
      expect(() => db.raw('users')).toThrow(/Access denied/);
      expect(() => db.c('nonexistent')).toThrow(/Unknown collection/);
    });
    await withTenant(superAdmin, async (db) => {
      expect(() => db.c('auth_sessions')).toThrow(/Access denied/);
    });
  });

  it('a clinic admin without a clinic scope gets nothing', async () => {
    await withTenant({ role: ROLES.CLINIC_ADMIN, clinicId: null, userId: uuid() }, async (db) => {
      await expect(db.c('patients').find({})).rejects.toMatchObject({ code: 'MISSING_CLINIC_SCOPE' });
    });
  });

  it('optimistic locking rejects stale writes', async () => {
    await withTenant(adminA, async (db) => {
      const fresh = await db.c('patients').findById(pa._id);
      expect(await db.c('patients').updateOne({ _id: pa._id }, { fullName: 'Alice v2' }, { expectedVersion: fresh.version })).not.toBeNull();
      expect(await db.c('patients').updateOne({ _id: pa._id }, { fullName: 'Alice stale' }, { expectedVersion: fresh.version })).toBeNull();
    });
  });
});
