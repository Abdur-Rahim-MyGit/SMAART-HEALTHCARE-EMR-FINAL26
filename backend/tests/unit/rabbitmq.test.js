'use strict';
/** RabbitMQ consumer retry/DLQ semantics and topology, verified with a fake confirm channel. */

function fakeChannel() {
  const calls = { ack: [], nack: [], publish: [], asserted: [], bound: [] };
  let handler;
  return {
    calls,
    prefetch: vi.fn(async () => {}),
    consume: vi.fn(async (_q, h) => { handler = h; }),
    ack: (m) => calls.ack.push(m),
    nack: (m, a, r) => calls.nack.push([m, a, r]),
    publish: (ex, rk, content, props, cb) => { calls.publish.push({ ex, rk, content, props }); if (cb) cb(null); return true; },
    assertExchange: vi.fn(async (name, type) => calls.asserted.push(['exchange', name, type])),
    assertQueue: vi.fn(async (name, opts) => calls.asserted.push(['queue', name, opts])),
    bindQueue: vi.fn(async (q, ex, rk) => calls.bound.push([q, ex, rk])),
    deliver: (msg) => handler(msg),
  };
}

describe('rabbitmq consumer', () => {
  let conn;
  beforeEach(() => {
    vi.resetModules();
    conn = require('../../src/infrastructure/rabbitmq/connection');
  });

  it('acks on success, re-publishes to the delayed retry queue on failure, and dead-letters after the last attempt', async () => {
    const ch = fakeChannel();
    vi.spyOn(conn, 'getChannel').mockReturnValue(ch);
    const { consume } = require('../../src/infrastructure/rabbitmq/consumer');
    const handler = vi.fn(async (event) => { if (event.fail) throw new Error('boom'); });
    await consume('smaart.email', handler);
    const msg = (body, attempt) => ({ content: Buffer.from(JSON.stringify(body)), properties: { messageId: 'm1', headers: { 'x-attempt': attempt } }, fields: { routingKey: 'auth.password.changed' } });
    await ch.deliver(msg({ type: 'ok' }, 0));
    expect(ch.calls.ack).toHaveLength(1);
    await ch.deliver(msg({ type: 'x', fail: true }, 0));
    expect(ch.calls.publish[0].rk).toBe('smaart.email.retry.0');
    expect(ch.calls.publish[0].props.headers['x-attempt']).toBe(1);
    await ch.deliver(msg({ type: 'x', fail: true }, 2));
    expect(ch.calls.publish[1].rk).toBe('smaart.email.retry.2');
    await ch.deliver(msg({ type: 'x', fail: true }, 3));
    expect(ch.calls.nack).toHaveLength(1);
    expect(ch.calls.nack[0][2]).toBe(false); // no requeue → dead letter exchange
    expect(ch.calls.publish).toHaveLength(2);
  });

  it('publisher waits for broker confirmation and fails without a channel', async () => {
    const ch = fakeChannel();
    vi.spyOn(conn, 'getChannel').mockReturnValue(ch);
    const { publishEvent } = require('../../src/infrastructure/rabbitmq/publisher');
    await publishEvent({ id: 'e1', type: 'patient.created', clinicId: 'c1', payload: {} });
    expect(ch.calls.publish[0].rk).toBe('patient.created');
    expect(ch.calls.publish[0].props.persistent).toBe(true);
    conn.getChannel.mockReturnValue(null);
    await expect(publishEvent({ id: 'e2', type: 'x' })).rejects.toThrow(/channel/);
  });

  it('declares durable queues with dead lettering and one delayed retry queue per attempt', () => {
    const t = conn.topology('smaart.events');
    expect(t.dlq).toBe('smaart.dlq');
    expect(Object.values(t.queues).map((q) => q.name)).toEqual(expect.arrayContaining(['smaart.email', 'smaart.notifications', 'smaart.fhir-sync', 'smaart.document-processing']));
    expect(conn.RETRY_DELAYS_MS.length).toBeGreaterThanOrEqual(3);
  });
});
