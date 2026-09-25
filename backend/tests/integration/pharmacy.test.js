'use strict';
const { api, resetData, adminToken, createClinic } = require('../helpers/api');
const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('pharmacy inventory (Pharmacy Management page contract)', () => {
  let t, a, b;
  beforeAll(async () => { await resetData(); t = await adminToken(); a = await createClinic(t); b = await createClinic(t); });

  it('supports the page list contract with computed status and stats, clinic scoped', async () => {
    const add = async (token, item) => api().post('/api/v1/medications').set(auth(token)).send(item);
    expect((await add(a.adminToken, { name: 'Paracetamol 500mg', category: 'Pain Relief', stock: 150, minStock: 50, price: 25, supplier: 'MediCorp', expiryDate: '2030-12-15' })).status).toBe(201);
    expect((await add(a.adminToken, { name: 'Amoxicillin 250mg', category: 'Antibiotic', stock: 10, minStock: 50, price: 40 })).status).toBe(201);
    expect((await add(a.adminToken, { name: 'Old Syrup', category: 'Cough', stock: 5, minStock: 1, price: 10, expiryDate: '2020-01-01' })).status).toBe(201);
    const list = await api().get(`/api/v1/medications/clinic/${a.clinic._id}`).set(auth(a.adminToken));
    expect(list.status).toBe(200);
    expect(list.body.medications.map((m) => m.status).sort()).toEqual(['expired', 'inStock', 'lowStock']);
    expect(list.body.stats).toMatchObject({ total: 3, inStock: 1, lowStock: 1, expired: 1, outOfStock: 0 });
    expect(list.body.medications[0]).toHaveProperty('minStock');
    const low = await api().get(`/api/v1/medications/clinic/${a.clinic._id}/low-stock`).set(auth(a.adminToken));
    expect(low.body.medications).toHaveLength(1);
    // clinic B cannot read clinic A inventory, by URL or by id
    expect((await api().get(`/api/v1/medications/clinic/${a.clinic._id}`).set(auth(b.adminToken))).status).toBe(403);
    expect((await api().get(`/api/v1/medications/${list.body.medications[0]._id}`).set(auth(b.adminToken))).status).toBe(404);
    expect((await api().get(`/api/v1/medications/clinic/${b.clinic._id}`).set(auth(b.adminToken))).body.medications).toEqual([]);
    // stock adjustment cannot go negative
    const id = list.body.medications.find((m) => m.name.startsWith('Amox'))._id;
    expect((await api().patch(`/api/v1/medications/${id}/stock`).set(auth(a.adminToken)).send({ adjustment: -100 })).status).toBe(400);
    const adj = await api().patch(`/api/v1/medications/${id}/stock`).set(auth(a.adminToken)).send({ adjustment: 100, reason: 'delivery' });
    expect(adj.body.medication.stock).toBe(110);
    expect(adj.body.medication.status).toBe('inStock');
    // super master admin can read any clinic's inventory
    expect((await api().get(`/api/v1/medications/clinic/${a.clinic._id}`).set(auth(t))).body.count).toBe(3);
  });
});
