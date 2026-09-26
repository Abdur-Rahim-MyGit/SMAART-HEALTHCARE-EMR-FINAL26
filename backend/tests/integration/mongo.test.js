'use strict';
/** Flexible clinical documents (community hub, clinical notes): clinic scoped, audited, injection safe. */
const { api, resetData, adminToken, createClinic, createPatient } = require('../helpers/api');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('flexible document modules', () => {
  let t, a, b, pa;
  beforeAll(async () => {
    await resetData();
    t = await adminToken();
    a = await createClinic(t);
    b = await createClinic(t);
    pa = await createPatient(a.adminToken);
  });

  it('community posts are clinic scoped and author-owned', async () => {
    const post = await api().post('/api/v1/posts').set(auth(a.adminToken)).send({ title: 'Hello', content: 'World', category: 'General' });
    expect(post.status).toBe(201);
    expect(post.body.post.clinicId).toBe(a.clinic._id);
    expect((await api().get('/api/v1/posts').set(auth(b.adminToken))).body.posts).toEqual([]);
    expect((await api().get(`/api/v1/posts/${post.body.post._id}`).set(auth(b.adminToken))).status).toBe(404);
    expect((await api().put(`/api/v1/posts/${post.body.post._id}`).set(auth(b.adminToken)).send({ title: 'Hacked' })).status).toBe(404);
    const liked = await api().post(`/api/v1/posts/${post.body.post._id}/like`).set(auth(a.adminToken));
    expect(liked.body.likes).toBe(1);
    expect((await api().post(`/api/v1/posts/${post.body.post._id}/like`).set(auth(a.adminToken))).body.likes).toBe(1);
    const stats = await api().get('/api/v1/posts/stats').set(auth(a.adminToken));
    expect(stats.body.totalPosts).toBe(1);
    const inj = await api().get('/api/v1/posts?search=%7B%22%24ne%22%3Anull%7D').set(auth(a.adminToken));
    expect(inj.status).toBe(200);
  });

  it('clinical notes require a patient of the caller clinic and are audited', async () => {
    const note = await api().post('/api/v1/clinical-notes').set(auth(a.adminToken)).send({ patientId: pa._id, noteType: 'soap', content: { subjective: 'headache' } });
    expect(note.status).toBe(201);
    expect(note.body.data.clinicId).toBe(a.clinic._id);
    expect((await api().post('/api/v1/clinical-notes').set(auth(b.adminToken)).send({ patientId: pa._id, content: 'x' })).status).toBe(404);
    expect((await api().get(`/api/v1/clinical-notes/patient/${pa._id}`).set(auth(b.adminToken))).status).toBe(404);
    const list = await api().get(`/api/v1/clinical-notes/patient/${pa._id}`).set(auth(a.adminToken));
    expect(list.body.count).toBe(1);
    const audit = await api().get('/api/v1/audit?action=CLINICAL_NOTE_CREATED').set(auth(a.adminToken));
    expect(audit.body.data.length).toBe(1);
  });
});
