'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { isMongoConnected } = require('../../infrastructure/mongodb/connection');
const { tenantFilter, writeClinicId } = require('../../infrastructure/mongodb/tenantModel');
const { unavailable, notFound, forbidden, badRequest } = require('../../common/errors/AppError');
const { ROLES } = require('../../common/security/rbac');
const { writeAudit } = require('../audit/auditRepository');
const { likePattern } = require('../../common/validation/schemas');
const { uuid } = require('../../common/validation/schemas');

const router = express.Router();
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier format');
router.use((req, _res, next) => { if (!isMongoConnected()) return next(unavailable('Community hub is temporarily unavailable')); req.CommunityPost = require('../../infrastructure/mongodb/models').CommunityPost; next(); });

const withLike = (post, userId) => ({ ...post, isLikedByCurrentUser: (post.likedBy || []).some((l) => l.userId === userId) });
const audit = (req, action, id) => writeAudit({ user_id: req.auth.userId, role: req.auth.role, clinic_id: req.scope.clinicId, action, resource_type: 'community_post', resource_id: id ? String(id) : null, ip: req.ip, request_id: req.id, result: 'SUCCESS', details: '{}' }).catch(() => {});

router.get('/', authorize('community:read'), tenantScope(), validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), category: z.string().max(60).optional(), sortBy: z.enum(['createdAt', 'likes', 'views', 'title']).default('createdAt'), sortOrder: z.enum(['asc', 'desc']).default('desc'), search: z.string().max(100).optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = tenantFilter(req.scope, { status: 'Published', published: true });
  if (q.category && q.category !== 'all') filter.category = q.category;
  if (q.search) filter.$or = [{ title: { $regex: likePattern(q.search).slice(1, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { content: { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }];
  const [posts, total] = await Promise.all([req.CommunityPost.find(filter).sort({ [q.sortBy]: q.sortOrder === 'desc' ? -1 : 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), req.CommunityPost.countDocuments(filter)]);
  res.json({ success: true, posts: posts.map((p) => withLike(p, req.auth.userId)), pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } });
}));
router.get('/stats', authorize('community:read'), tenantScope(), asyncHandler(async (req, res) => {
  const filter = tenantFilter(req.scope, { status: 'Published', published: true });
  const [totalPosts, featuredPosts, categoryStats, topAuthors] = await Promise.all([req.CommunityPost.countDocuments(filter), req.CommunityPost.countDocuments({ ...filter, featured: true }), req.CommunityPost.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]), req.CommunityPost.aggregate([{ $match: filter }, { $group: { _id: '$author', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }])]);
  res.json({ success: true, totalPosts, featuredPosts, categoryStats, topAuthors });
}));
router.get('/:id', authorize('community:read'), tenantScope(), validate({ params: z.object({ id: objectId }) }), asyncHandler(async (req, res) => {
  const post = await req.CommunityPost.findOneAndUpdate(tenantFilter(req.scope, { _id: req.params.id }), { $inc: { views: 1 } }, { new: true }).lean();
  if (!post) throw notFound('Post');
  res.json({ success: true, post: withLike(post, req.auth.userId) });
}));
const postBody = z.object({ title: z.string().trim().min(1).max(200), content: z.string().min(1).max(20000), excerpt: z.string().max(500).optional(), category: z.string().max(60).optional(), tags: z.array(z.string().max(50)).max(20).optional(), featured: z.boolean().optional(), published: z.boolean().optional(), status: z.enum(['Draft', 'Published', 'Archived']).optional(), clinicId: uuid.optional() });
router.post('/', authorize('community:write'), tenantScope(), validate({ body: postBody }), asyncHandler(async (req, res) => {
  const clinicId = writeClinicId(req.scope, req.body.clinicId);
  const author = req.user.full_name || [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.email;
  const post = await req.CommunityPost.create({ ...req.body, clinicId, authorId: req.auth.userId, author, authorRole: req.auth.role, createdBy: req.auth.userId, excerpt: req.body.excerpt || req.body.content.slice(0, 200) });
  audit(req, 'COMMUNITY_POST_CREATED', post._id);
  res.status(201).json({ success: true, message: 'Post created', post: withLike(post.toObject(), req.auth.userId) });
}));
async function ownedPost(req) {
  const post = await req.CommunityPost.findOne(tenantFilter(req.scope, { _id: req.params.id }));
  if (!post) throw notFound('Post');
  if (post.authorId !== req.auth.userId && req.auth.role !== ROLES.SUPER_MASTER_ADMIN && req.auth.role !== ROLES.CLINIC_ADMIN) throw forbidden('You can only modify your own posts');
  return post;
}
router.put('/:id', authorize('community:write'), tenantScope(), validate({ params: z.object({ id: objectId }), body: postBody.partial().omit({ clinicId: true }) }), asyncHandler(async (req, res) => {
  const post = await ownedPost(req);
  Object.assign(post, req.body, { updatedBy: req.auth.userId });
  await post.save();
  audit(req, 'COMMUNITY_POST_UPDATED', post._id);
  res.json({ success: true, message: 'Post updated', post: withLike(post.toObject(), req.auth.userId) });
}));
router.delete('/:id', authorize('community:write'), tenantScope(), validate({ params: z.object({ id: objectId }) }), asyncHandler(async (req, res) => {
  const post = await ownedPost(req);
  await post.deleteOne();
  audit(req, 'COMMUNITY_POST_DELETED', post._id);
  res.json({ success: true, message: 'Post deleted' });
}));
router.post('/:id/like', authorize('community:read'), tenantScope(), validate({ params: z.object({ id: objectId }) }), asyncHandler(async (req, res) => {
  const post = await req.CommunityPost.findOneAndUpdate(tenantFilter(req.scope, { _id: req.params.id, 'likedBy.userId': { $ne: req.auth.userId } }), { $inc: { likes: 1 }, $push: { likedBy: { userId: req.auth.userId } } }, { new: true }).lean();
  if (!post) { const exists = await req.CommunityPost.findOne(tenantFilter(req.scope, { _id: req.params.id })).lean(); if (!exists) throw notFound('Post'); return res.json({ success: true, likes: exists.likes, isLikedByCurrentUser: true }); }
  res.json({ success: true, likes: post.likes, isLikedByCurrentUser: true });
}));
router.post('/:id/unlike', authorize('community:read'), tenantScope(), validate({ params: z.object({ id: objectId }) }), asyncHandler(async (req, res) => {
  const post = await req.CommunityPost.findOneAndUpdate(tenantFilter(req.scope, { _id: req.params.id, 'likedBy.userId': req.auth.userId }), { $inc: { likes: -1 }, $pull: { likedBy: { userId: req.auth.userId } } }, { new: true }).lean();
  if (!post) { const exists = await req.CommunityPost.findOne(tenantFilter(req.scope, { _id: req.params.id })).lean(); if (!exists) throw notFound('Post'); return res.json({ success: true, likes: exists.likes, isLikedByCurrentUser: false }); }
  res.json({ success: true, likes: Math.max(0, post.likes), isLikedByCurrentUser: false });
}));
router.post('/:id/comments', authorize('community:read'), tenantScope(), validate({ params: z.object({ id: objectId }), body: z.object({ content: z.string().trim().min(1).max(2000) }) }), asyncHandler(async (req, res) => {
  if (!req.body.content) throw badRequest('content is required');
  const author = req.user.full_name || req.user.email;
  const post = await req.CommunityPost.findOneAndUpdate(tenantFilter(req.scope, { _id: req.params.id }), { $push: { comments: { userId: req.auth.userId, author, content: req.body.content } } }, { new: true }).lean();
  if (!post) throw notFound('Post');
  res.status(201).json({ success: true, post: withLike(post, req.auth.userId) });
}));
module.exports = router;
