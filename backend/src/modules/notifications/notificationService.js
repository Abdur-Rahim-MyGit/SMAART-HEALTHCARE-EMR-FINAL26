'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant, withSystem } = require('../../infrastructure/postgres/tenant');
const { serializeRow } = require('../../common/utils/serialize');
const { notFound } = require('../../common/errors/AppError');
const { incrementUnread, resetUnread, getUnread } = require('../../infrastructure/redis/counters');

/** Creates a notification for one user (or all admins of a clinic) — used by workers. */
async function notify({ clinicId, userId, type, title, message, data = {} }) {
  return withSystem(async (trx) => {
    let targets = userId ? [userId] : [];
    if (!userId && clinicId) targets = (await trx('users').where({ clinic_id: clinicId, is_active: true }).whereNull('deleted_at').select('id')).map((u) => u.id);
    for (const uid of targets) {
      await trx('notifications').insert({ clinic_id: clinicId || null, user_id: uid, type, title, message, data: JSON.stringify(data) });
      await incrementUnread(uid);
    }
    return targets.length;
  }, getKnex());
}

async function list(scope, { limit = 20, offset = 0, unreadOnly = false }) {
  return withTenant(scope, async (trx) => {
    let q = trx('notifications').where('user_id', scope.userId);
    if (unreadOnly) q = q.whereNull('read_at');
    const rows = await q.orderBy('created_at', 'desc').limit(limit).offset(offset);
    let unread = await getUnread(scope.userId);
    if (unread === null) {
      unread = Number((await trx('notifications').where('user_id', scope.userId).whereNull('read_at').count({ c: '*' }))[0].c);
      await resetUnread(scope.userId, unread);
    }
    return { data: rows.map((r) => ({ ...serializeRow(r), read: !!r.read_at, time: r.created_at })), unreadCount: unread };
  }, getKnex());
}

async function markRead(scope, id) {
  return withTenant(scope, async (trx) => {
    const rows = await trx('notifications').where({ id, user_id: scope.userId }).whereNull('read_at').update({ read_at: trx.fn.now() }).returning('id');
    if (!rows.length) { const exists = await trx('notifications').where({ id, user_id: scope.userId }).first('id'); if (!exists) throw notFound('Notification'); return; }
    const unread = Number((await trx('notifications').where('user_id', scope.userId).whereNull('read_at').count({ c: '*' }))[0].c);
    await resetUnread(scope.userId, unread);
  }, getKnex());
}
async function markAllRead(scope) {
  return withTenant(scope, async (trx) => {
    await trx('notifications').where({ user_id: scope.userId }).whereNull('read_at').update({ read_at: trx.fn.now() });
    await resetUnread(scope.userId, 0);
  }, getKnex());
}
module.exports = { notify, list, markRead, markAllRead };
