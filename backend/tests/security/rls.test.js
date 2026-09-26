'use strict';
/** Row level security as the second isolation layer: even a query without an explicit clinic filter cannot cross tenants. */
const { resetData, twoClinics } = require('../helpers/api');
const { getKnex } = require('../../src/infrastructure/postgres/knex');
const { withTenant, withSystem } = require('../../src/infrastructure/postgres/tenant');

describe('postgres row level security', () => {
  let f;
  beforeAll(async () => {
    await resetData();
    f = await twoClinics();
  });
  it('an unscoped query as clinic B only returns clinic B rows', async () => {
    const rows = await withTenant({ role: 'clinic_admin', clinicId: f.b.clinic._id }, (trx) => trx('patients').select('id'), getKnex());
    expect(rows.map((r) => r.id)).toEqual([f.pb._id]);
    const byId = await withTenant({ role: 'clinic_admin', clinicId: f.b.clinic._id }, (trx) => trx('patients').where({ id: f.pa._id }).first(), getKnex());
    expect(byId).toBeUndefined();
  });
  it('clinic B cannot insert a row for clinic A', async () => {
    await expect(withTenant({ role: 'clinic_admin', clinicId: f.b.clinic._id }, (trx) => trx('patients').insert({ clinic_id: f.a.clinic._id, full_name: 'X' }), getKnex())).rejects.toThrow(/row-level security/);
  });
  it('clinic B cannot update or delete clinic A rows even by id', async () => {
    const n = await withTenant({ role: 'clinic_admin', clinicId: f.b.clinic._id }, (trx) => trx('patients').where({ id: f.pa._id }).update({ full_name: 'Hacked' }), getKnex());
    expect(n).toBe(0);
    const d = await withTenant({ role: 'clinic_admin', clinicId: f.b.clinic._id }, (trx) => trx('patients').where({ id: f.pa._id }).delete(), getKnex());
    expect(d).toBe(0);
  });
  it('a missing clinic setting sees nothing; system and super master admin see everything', async () => {
    const none = await withTenant({ role: 'clinic_admin', clinicId: null }, (trx) => trx('patients').select('id'), getKnex());
    expect(none).toEqual([]);
    const all = await withTenant({ role: 'super_master_admin' }, (trx) => trx('patients').select('id'), getKnex());
    expect(all).toHaveLength(2);
    const sys = await withSystem((trx) => trx('patients').select('id'), getKnex());
    expect(sys).toHaveLength(2);
  });
  it('audit logs cannot be updated or deleted by the application role', async () => {
    await expect(withSystem((trx) => trx('audit_logs').delete(), getKnex())).rejects.toThrow(/permission denied/);
    await expect(withSystem((trx) => trx('audit_logs').update({ action: 'X' }), getKnex())).rejects.toThrow(/permission denied/);
  });
  it('the application database role is not a superuser and cannot bypass RLS', async () => {
    const [row] = (await getKnex().raw('select rolsuper, rolbypassrls from pg_roles where rolname = current_user')).rows;
    expect(row.rolsuper).toBe(false);
    expect(row.rolbypassrls).toBe(false);
  });
});
