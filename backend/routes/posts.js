const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { auth } = require('../middleware/auth');

// @route   GET /api/posts
// @desc    Get all posts with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search 
    } = req.query;

    // Build filter
    const filter = {
      status: 'Published',
      published: true
    };

    // Filter by clinic if not super_master_admin
    if (req.user.role !== 'super_master_admin') {
      filter.clinicId = req.user.clinicId;
    }

    // Add category filter if provided
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Add search filter if provided
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const posts = await Post.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add isLikedByCurrentUser field
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLikedByCurrentUser: post.likedBy?.some(like => like.userId === req.user.userId) || false
    }));

    // Get total count for pagination
    const total = await Post.countDocuments(filter);

    res.json({
      success: true,
      posts: postsWithLikeStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts',
      error: error.message
    });
  }
});

// @route   GET /api/posts/stats
// @desc    Get post statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const filter = {
      status: 'Published',
      published: true
    };

    // Filter by clinic if not super_master_admin
    if (req.user.role !== 'super_master_admin') {
      filter.clinicId = req.user.clinicId;
    }

    // Total posts
    const totalPosts = await Post.countDocuments(filter);

    // Featured posts
    const featuredPosts = await Post.countDocuments({
      ...filter,
      featured: true
    });

    // Category stats
    const categoryStats = await Post.aggregate([
      { $match: filter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Top authors
    const topAuthors = await Post.aggregate([
      { $match: filter },
      { $group: { _id: '$author', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      totalPosts,
      featuredPosts,
      categoryStats,
      topAuthors
    });
  } catch (error) {
    console.error('Error fetching post stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post statistics',
      error: error.message
    });
  }
});

// @route   GET /api/posts/:id
// @desc    Get single post by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check access permissions
    if (req.user.role !== 'super_master_admin' && 
        post.clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add isLikedByCurrentUser field
    const postWithLikeStatus = {
      ...post,
      isLikedByCurrentUser: post.likedBy?.some(like => like.userId === req.user.userId) || false
    };

    // Increment views
    await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json({
      success: true,
      post: postWithLikeStatus
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post',
      error: error.message
    });
  }
});

// @route   POST /api/posts
// @desc    Create new post
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const postData = {
      ...req.body,
      clinicId: req.user.clinicId,
      author: req.user.role === 'clinic_admin' 
        ? req.user.adminName || req.user.name 
        : `${req.user.firstName} ${req.user.lastName}`,
      authorId: req.user.userId
    };

    const post = new Post(postData);
    await post.save();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post',
      error: error.message
    });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update post
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is author or admin
    if (post.authorId !== req.user.userId && 
        req.user.role !== 'clinic_admin' && 
        req.user.role !== 'super_master_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post'
      });
    }

    // Update post
    Object.assign(post, req.body);
    post.updatedAt = new Date();
    await post.save();

    res.json({
      success: true,
      message: 'Post updated successfully',
      post
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update post',
      error: error.message
    });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete post
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is author or admin
    if (post.authorId !== req.user.userId && 
        req.user.role !== 'clinic_admin' && 
        req.user.role !== 'super_master_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post',
      error: error.message
    });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like a post
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.like(req.user.userId, req.user.role);

    res.json({
      success: true,
      message: 'Post liked successfully',
      likes: post.likes
    });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to like post'
    });
  }
});

// @route   POST /api/posts/:id/unlike
// @desc    Unlike a post
// @access  Private
router.post('/:id/unlike', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.unlike(req.user.userId);

    res.json({
      success: true,
      message: 'Post unliked successfully',
      likes: post.likes
    });
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to unlike post'
    });
  }
});

// @route   POST /api/posts/:id/comments
// @desc    Add comment to post
// @access  Private
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comment = {
      author: req.user.role === 'clinic_admin' 
        ? req.user.adminName || req.user.name 
        : `${req.user.firstName} ${req.user.lastName}`,
      authorId: req.user.userId,
      content: req.body.content
    };

    await post.addComment(comment);

    res.json({
      success: true,
      message: 'Comment added successfully',
      post
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
});

module.exports = router;
