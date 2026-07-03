const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const AppointmentRequest = require('../models/AppointmentRequest');

const router = express.Router();

/**
 * Which hospital's requests can this user see?
 * - Super (master) admins see everything.
 * - Everyone else is scoped to their own clinic.
 */
function clinicScope(req) {
  const role = req.user.role;
  if (role === 'super_master_admin' || role === 'super_admin') return {};
  const cid = (req.user.clinicId && req.user.clinicId._id) || req.user.clinicId;
  return cid ? { clinicId: cid } : {};
}

/**
 * GET /api/appointment-requests?status=pending
 * Incoming requests from the public appointment website for this hospital.
 */
router.get('/', auth, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const query = { ...clinicScope(req) };
    if (status && status !== 'all') query.status = status;

    const requests = await AppointmentRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const pendingCount = await AppointmentRequest.countDocuments({
      ...clinicScope(req),
      status: 'pending',
    });

    res.json({ success: true, count: requests.length, pendingCount, requests });
  } catch (err) {
    console.error('GET /api/appointment-requests failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load appointment requests' });
  }
});

/**
 * PATCH /api/appointment-requests/:id/review
 * Body: { status, reviewNotes? }. Marks the request approved/rejected.
 * Does not auto-create a patient/appointment (Patient requires many fields a
 * public request can't supply); staff schedule it afterwards.
 */
router.patch('/:id/review', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid request id' });
    }
    const { status, reviewNotes } = req.body || {};
    const allowed = ['approved', 'rejected', 'info_requested', 'pending'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const request = await AppointmentRequest.findOne({ _id: req.params.id, ...clinicScope(req) });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = status;
    request.reviewNotes = reviewNotes || request.reviewNotes;
    request.reviewedBy = req.user._id || req.user.id;
    await request.save();

    res.json({ success: true, message: `Request ${status}.`, request });
  } catch (err) {
    console.error('PATCH /api/appointment-requests/:id/review failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update request' });
  }
});

module.exports = router;
