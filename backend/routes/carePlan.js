const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/care-plan/:patientId
 * Surfaces a patient's Physio treatment plan + CDSS history (written by the
 * Consultant/CDSS side) inside the EMR. The EMR patient (`patients`) is bridged
 * to the Physio account (`users`) by email; plans/CDSS are keyed by that user id.
 */
router.get('/:patientId', auth, async (req, res) => {
  try {
    const id = req.params.patientId;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient id' });
    }
    const emrId = new mongoose.Types.ObjectId(id);
    const patient = await mongoose.connection.collection('patients').findOne({ _id: emrId });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const email = String(patient.email || '').toLowerCase();
    const user = email ? await mongoose.connection.collection('users').findOne({ email }) : null;
    const uid = user && user._id;

    const idMatch = uid ? [emrId, uid] : [emrId];
    const treatmentPlan = uid
      ? await mongoose.connection.collection('treatmentplans')
          .findOne({ patientId: uid, isActive: true })
      : null;
    const planHistory = uid
      ? await mongoose.connection.collection('treatmentplans')
          .find({ patientId: uid }).sort({ createdAt: -1 }).limit(10).toArray()
      : [];
    const cdss = await mongoose.connection.collection('cdssassessments')
      .find({ $or: [{ patientId: { $in: idMatch } }, { patientName: patient.fullName }] })
      .sort({ createdAt: -1 }).limit(10).toArray();

    res.json({
      success: true,
      hasAppAccount: !!user,
      smaartId: user && user.smaartId,
      treatmentPlan,
      planHistory,
      cdss,
    });
  } catch (err) {
    console.error('GET /api/care-plan/:patientId failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load care plan' });
  }
});

module.exports = router;
