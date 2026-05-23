const express = require('express');
const router = express.Router();

// Placeholder routes for audit module
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Audit module - Coming soon' });
});

module.exports = router;