'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { withTenant, resolveClinicId, contains } = require('../../infrastructure/mongodb/tenant');
const { notFound, forbidden, badRequest } = require('../../common/errors/AppError');
const { ROLES } = require('../../common/security/rbac');
const { auditInTrx } = require('../audit/auditRepository');
const { idParam, uuid } = require('../../common/validation/schemas');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const displayName = (u) => u.fullName || u.full_name || [u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(' ') || u.email;
const withLike = (post, userId) => ({ ...post, id: post._id, isLikedByCurrentUser: (post.likedBy || []).some((l) => l.userId === userId) });
const PUBLISHED = { status: 'Published', published: true };

router.get('/', authorize('community:read'), tenantScope(), validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), category: z.string().max(60).optional(), sortBy: z.enum(['createdAt', 'likes', 'views', 'title']).default('createdAt'), sortOrder: z.enum(['asc', 'desc']).default('desc'), search: z.string().max(100).optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { ...PUBLISHED };
  if (q.category && q.category !== 'all') filter.category = q.category;
  if (q.search) filter.$or = [{ title: contains(q.search) }, { content: contains(q.search) }];
  const { posts, total } = await withTenant(req.scope, async (db) => {
    const col = db.c('community_posts');
    const [posts, total] = await Promise.all([col.find(filter, { sort: { [q.sortBy]: q.sortOrder === 'desc' ? -1 : 1 }, skip: (q.page - 1) * q.limit, limit: q.limit }), col.count(filter)]);
    return { posts, total };
  });
  res.json({ success: true, posts: posts.map((p) => withLike(p, req.auth.userId)), pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
}));
router.get('/stats', authorize('community:read'), tenantScope(), asyncHandler(async (req, res) => {
  const out = await withTenant(req.scope, async (db) => {
    const col = db.c('community_posts');
    const [totalPosts, featuredPosts, categoryStats, topAuthors] = await Promise.all([col.count(PUBLISHED), col.count({ ...PUBLISHED, featured: true }), col.aggregate([{ $match: PUBLISHED }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]), col.aggregate([{ $match: PUBLISHED }, { $group: { _id: '$author', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }])]);
    return { totalPosts, featuredPosts, categoryStats, topAuthors };
  });
  res.json({ success: true, ...out });
}));
router.get('/:id', authorize('community:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const post = await withTenant(req.scope, (db) => db.c('community_posts').updateOne({ _id: req.params.id }, {}, { inc: { views: 1 } }));
  if (!post) throw notFound('Post');
  res.json({ success: true, post: withLike(post, req.auth.userId) });
}));
const postBody = z.object({ title: z.string().trim().min(1).max(200), content: z.string().min(1).max(20000), excerpt: z.string().max(500).optional(), category: z.string().max(60).optional(), tags: z.array(z.string().max(50)).max(20).optional(), featured: z.boolean().optional(), published: z.boolean().optional(), status: z.enum(['Draft', 'Published', 'Archived']).optional(), clinicId: uuid.optional() });
router.post('/', authorize('community:write'), tenantScope(), validate({ body: postBody }), asyncHandler(async (req, res) => {
  const clinicId = resolveClinicId(req.scope, req.body.clinicId);
  if (!clinicId) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  const post = await withTenant(req.scope, async (db) => {
    const created = await db.c('community_posts').insertOne({ category: 'General', tags: [], featured: false, published: true, status: 'Published', likes: 0, views: 0, likedBy: [], comments: [], ...req.body, clinicId, authorId: req.auth.userId, author: displayName(req.user), authorRole: req.auth.role, excerpt: req.body.excerpt || req.body.content.slice(0, 200) });
    await auditInTrx(db, { ...req.scope, clinicId }, { action: 'COMMUNITY_POST_CREATED', resourceType: 'community_post', resourceId: created._id, ...ctxOf(req) });
    return created;
  });
  res.status(201).json({ success: true, message: 'Post created', post: withLike(post, req.auth.userId) });
}));
async function ownedPost(db, req) {
  const post = await db.c('community_posts').findById(req.params.id);
  if (!post) throw notFound('Post');
  if (post.authorId !== req.auth.userId && req.auth.role !== ROLES.SUPER_MASTER_ADMIN && req.auth.role !== ROLES.CLINIC_ADMIN) throw forbidden('You can only modify your own posts');
  return post;
}
router.put('/:id', authorize('community:write'), tenantScope(), validate({ params: idParam, body: postBody.partial().omit({ clinicId: true }) }), asyncHandler(async (req, res) => {
  const post = await withTenant(req.scope, async (db) => {
    await ownedPost(db, req);
    const updated = await db.c('community_posts').updateOne({ _id: req.params.id }, req.body);
    await auditInTrx(db, req.scope, { action: 'COMMUNITY_POST_UPDATED', resourceType: 'community_post', resourceId: req.params.id, ...ctxOf(req) });
    return updated;
  });
  res.json({ success: true, message: 'Post updated', post: withLike(post, req.auth.userId) });
}));
router.delete('/:id', authorize('community:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await withTenant(req.scope, async (db) => {
    await ownedPost(db, req);
    await db.c('community_posts').deleteOne({ _id: req.params.id });
    await auditInTrx(db, req.scope, { action: 'COMMUNITY_POST_DELETED', resourceType: 'community_post', resourceId: req.params.id, ...ctxOf(req) });
  });
  res.json({ success: true, message: 'Post deleted' });
}));
router.post('/:id/like', authorize('community:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const out = await withTenant(req.scope, async (db) => {
    const col = db.c('community_posts');
    const post = await col.updateOne({ _id: req.params.id, 'likedBy.userId': { $ne: req.auth.userId } }, {}, { inc: { likes: 1 }, push: { likedBy: { userId: req.auth.userId, likedAt: new Date() } } });
    if (post) return { likes: post.likes };
    const exists = await col.findById(req.params.id);
    if (!exists) throw notFound('Post');
    return { likes: exists.likes };
  });
  res.json({ success: true, likes: out.likes, isLikedByCurrentUser: true });
}));
router.post('/:id/unlike', authorize('community:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const out = await withTenant(req.scope, async (db) => {
    const col = db.c('community_posts');
    const post = await col.updateOne({ _id: req.params.id, 'likedBy.userId': req.auth.userId }, {}, { inc: { likes: -1 }, pull: { likedBy: { userId: req.auth.userId } } });
    if (post) return { likes: Math.max(0, post.likes) };
    const exists = await col.findById(req.params.id);
    if (!exists) throw notFound('Post');
    return { likes: exists.likes };
  });
  res.json({ success: true, likes: out.likes, isLikedByCurrentUser: false });
}));
router.post('/:id/comments', authorize('community:read'), tenantScope(), validate({ params: idParam, body: z.object({ content: z.string().trim().min(1).max(2000) }) }), asyncHandler(async (req, res) => {
  const post = await withTenant(req.scope, (db) => db.c('community_posts').updateOne({ _id: req.params.id }, {}, { push: { comments: { _id: require('crypto').randomUUID(), userId: req.auth.userId, author: displayName(req.user), content: req.body.content, createdAt: new Date() } } }));
  if (!post) throw notFound('Post');
  res.status(201).json({ success: true, post: withLike(post, req.auth.userId) });
}));
module.exports = router;
