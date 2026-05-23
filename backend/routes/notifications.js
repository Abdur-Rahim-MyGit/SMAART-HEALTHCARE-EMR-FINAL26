const express = require('express');
const router = express.Router();

// Placeholder routes for notifications module
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Notifications module - Coming soon' });
});

module.exports = router;