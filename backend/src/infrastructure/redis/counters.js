'use strict';
const { getRedis } = require('./client');
const key = (userId) => `notif:unread:${userId}`;

async function incrementUnread(userId, by = 1) {
  const r = getRedis();
  const v = await r.incrby(key(userId), by);
  await r.expire(key(userId), 60 * 60 * 24 * 30);
  return v;
}
async function resetUnread(userId, value = 0) {
  await getRedis().set(key(userId), String(value), 'EX', 60 * 60 * 24 * 30);
}
async function getUnread(userId) {
  const v = await getRedis().get(key(userId));
  return v === null ? null : Number(v);
}
module.exports = { incrementUnread, resetUnread, getUnread };
