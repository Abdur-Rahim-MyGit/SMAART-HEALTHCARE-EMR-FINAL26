'use strict';
const { api, raw, resetData, adminToken, createClinic, createPatient } = require('../helpers/api');
const { publishBatch } = require('../../src/workers/outboxPublisher');
const { housekeeping } = require('../../src/workers/schedulers');
const { withLock } = require('../../src/infrastructure/redis/lock');
const { notify, list } = require('../../src/modules/notifications/notificationService');

describe('outbox, locks, notifications and housekeeping', () => {
  let t, c;
  beforeAll(async () => { await resetData(); t = await adminToken(); c = await createClinic(t); });

  it('domain writes enqueue outbox events in the same transaction', async () => {
    const p = await createPatient(c.adminToken);
    const rows = await raw('outbox_events').find({ aggregateId: p._id }).toArray();
    expect(rows.map((r) => r.eventType)).toContain('patient.created');
    expect(rows[0].clinicId).toBe(c.clinic._id);
    expect(rows[0].publishedAt).toBeNull();
  });

  it('publisher leaves events in the outbox when no broker is configured', async () => {
    const n = await publishBatch();
    expect(n).toBe(0);
    expect(await raw('outbox_events').countDocuments({ publishedAt: null })).toBeGreaterThan(0);
  });

  it('distributed lock rejects concurrent holders', async () => {
    let inner;
    await withLock('t1', 2000, async () => {
      inner = await withLock('t1', 2000, async () => 'x', { retries: 0 }).catch((e) => e.code);
    });
    expect(inner).toBe('LOCKED');
    expect(await withLock('t1', 2000, async () => 'ok')).toBe('ok');
  });

  it('notifications fan out to clinic users with unread counters', async () => {
    const n = await notify({ clinicId: c.clinic._id, type: 'test', title: 'Hi', message: 'There' });
    expect(n).toBe(1);
    const res = await api().get('/api/v1/notifications').set('Authorization', `Bearer ${c.adminToken}`);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.notifications[0].title).toBe('Hi');
    await api().put(`/api/v1/notifications/${res.body.notifications[0]._id}/read`).set('Authorization', `Bearer ${c.adminToken}`);
    expect((await api().get('/api/v1/notifications').set('Authorization', `Bearer ${c.adminToken}`)).body.unreadCount).toBe(0);
    void list;
  });

  it('housekeeping marks overdue invoices', async () => {
    const p = await createPatient(c.adminToken);
    const inv = await api().post('/api/v1/invoices').set('Authorization', `Bearer ${c.adminToken}`).send({ patientId: p._id, total: 10, dueDate: '2020-01-01' });
    await housekeeping();
    const after = await api().get(`/api/v1/invoices/${inv.body.data._id}`).set('Authorization', `Bearer ${c.adminToken}`);
    expect(after.body.data.status).toBe('Overdue');
  });
});
