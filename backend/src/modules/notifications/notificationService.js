'use strict';
const { withTenant, withSystem } = require('../../infrastructure/mongodb/tenant');
const { serializeRow } = require('../../common/utils/serialize');
const { notFound } = require('../../common/errors/AppError');
const { incrementUnread, resetUnread, getUnread } = require('../../infrastructure/redis/counters');

/** Creates a notification for one user (or all admins of a clinic) — used by workers. */
async function notify({ clinicId, userId, type, title, message, data = {} }) {
  return withSystem(async (db) => {
    let targets = userId ? [userId] : [];
    if (!userId && clinicId) targets = (await db.c('users').find({ clinicId, isActive: true }, { projection: { _id: 1 } })).map((u) => u._id);
    for (const uid of targets) {
      await db.c('notifications').insertOne({ clinicId: clinicId || null, userId: uid, type, title, message, data, readAt: null });
      await incrementUnread(uid);
    }
    return targets.length;
  });
}

/** Notifications are always scoped to the authenticated user, on top of the clinic scope. */
async function list(scope, { limit = 20, offset = 0, unreadOnly = false }) {
  return withTenant(scope, async (db) => {
    const col = db.c('notifications');
    const filter = { userId: scope.userId, ...(unreadOnly ? { readAt: null } : {}) };
    const rows = await col.find(filter, { sort: { createdAt: -1 }, limit, skip: offset });
    let unread = await getUnread(scope.userId);
    if (unread === null) {
      unread = await col.count({ userId: scope.userId, readAt: null });
      await resetUnread(scope.userId, unread);
    }
    return { data: rows.map((r) => ({ ...serializeRow(r), read: !!r.readAt, time: r.createdAt })), unreadCount: unread };
  });
}

async function markRead(scope, id) {
  return withTenant(scope, async (db) => {
    const col = db.c('notifications');
    const updated = await col.updateOne({ _id: id, userId: scope.userId, readAt: null }, { readAt: new Date() });
    if (!updated) { if (!(await col.exists({ _id: id, userId: scope.userId }))) throw notFound('Notification'); return; }
    await resetUnread(scope.userId, await col.count({ userId: scope.userId, readAt: null }));
  });
}
async function markAllRead(scope) {
  return withTenant(scope, async (db) => {
    await db.c('notifications').updateMany({ userId: scope.userId, readAt: null }, { readAt: new Date() });
    await resetUnread(scope.userId, 0);
  });
}
module.exports = { notify, list, markRead, markAllRead };
