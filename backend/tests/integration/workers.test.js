'use strict';
/** Worker behaviours that need no broker: malware quarantine flow (fake clamd), backup export, notification fan-out. */
const net = require('net');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { api, resetData, adminToken, createClinic, createPatient } = require('../helpers/api');
const { getKnex } = require('../../src/infrastructure/postgres/knex');
const { withSystem } = require('../../src/infrastructure/postgres/tenant');
const doc = (id) => withSystem((trx) => trx('documents').where({ id }).first(), getKnex());
const { documentHandler } = require('../../src/workers/consumers/documents');
const { exportDocuments } = require('../../src/workers/backupExport');
const { notificationHandler } = require('../../src/workers/consumers/notifications');
const { scanBuffer } = require('../../src/infrastructure/security/malwareScanner');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7369b7e0000000049454e44ae426082', 'hex');
const auth = (t) => ({ Authorization: `Bearer ${t}` });

/** Minimal clamd emulator: answers FOUND when the stream contains the EICAR marker, OK otherwise. */
function fakeClamd() {
  const server = net.createServer((socket) => {
    const chunks = [];
    socket.on('data', (d) => {
      chunks.push(d);
      const all = Buffer.concat(chunks);
      if (all.length >= 4 && all.subarray(-4).equals(Buffer.alloc(4))) {
        socket.end(all.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

describe('workers', () => {
  let t, c, p, clam;
  beforeAll(async () => { await resetData(); t = await adminToken(); c = await createClinic(t); p = await createPatient(c.adminToken); clam = await fakeClamd(); process.env.CLAMAV_HOST = '127.0.0.1'; process.env.CLAMAV_PORT = String(clam.port); });
  afterAll(async () => { delete process.env.CLAMAV_HOST; delete process.env.CLAMAV_PORT; clam.server.close(); });

  it('clamd INSTREAM client parses OK and FOUND', async () => {
    expect((await scanBuffer(Buffer.from('hello'), { host: '127.0.0.1', port: clam.port })).status).toBe('clean');
    expect((await scanBuffer(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), { host: '127.0.0.1', port: clam.port })).status).toBe('infected');
  });

  it('marks clean uploads and quarantines infected ones so they can no longer be accessed', async () => {
    const clean = (await api().post('/api/v1/documents').set(auth(c.adminToken)).field('patientId', p._id).attach('file', PNG, 'ok.png')).body.data;
    await documentHandler({ type: 'document.uploaded', aggregateId: clean._id, clinicId: c.clinic._id });
    expect((await doc(clean._id)).scan_status).toBe('clean');
    const eicar = Buffer.concat([PNG, Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')]);
    const bad = (await api().post('/api/v1/documents').set(auth(c.adminToken)).field('patientId', p._id).attach('file', eicar, 'bad.png')).body.data;
    expect((await api().get(`/api/v1/documents/${bad._id}/access`).set(auth(c.adminToken))).status).toBe(200);
    await documentHandler({ type: 'document.uploaded', aggregateId: bad._id, clinicId: c.clinic._id });
    const row = await doc(bad._id);
    expect(row.scan_status).toBe('infected');
    expect(row.status).toBe('quarantined');
    expect((await api().get(`/api/v1/documents/${bad._id}/access`).set(auth(c.adminToken))).status).toBe(403);
    expect((await api().get('/api/v1/audit?action=DOCUMENT_QUARANTINED').set(auth(c.adminToken))).body.data.length).toBe(1);
  });

  it('exports a document manifest and verified file copies for disaster recovery', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smaart-backup-'));
    const { fetchBytes } = require('../../src/workers/consumers/documents');
    const r = await exportDocuments({ dir, copyFiles: true, fetchBytes });
    expect(r.count).toBeGreaterThanOrEqual(1);
    expect(r.failed).toBe(0);
    const manifest = JSON.parse(await fs.readFile(r.manifest, 'utf8'));
    expect(manifest.documents[0]).toHaveProperty('checksumSha256' in manifest.documents[0] ? 'checksumSha256' : 'checksum_sha256');
    const files = await fs.readdir(path.join(dir, r.day, 'files'));
    expect(files.length).toBe(r.copied);
    expect(r.copied).toBe(r.count);
  });

  it('notification consumer fans events out to clinic admins', async () => {
    await notificationHandler({ type: 'appointment.created', clinicId: c.clinic._id, aggregateType: 'appointment', aggregateId: 'x', payload: {} });
    const n = await api().get('/api/v1/notifications').set(auth(c.adminToken));
    expect(n.body.notifications[0].title).toBe('New Appointment');
  });
});
