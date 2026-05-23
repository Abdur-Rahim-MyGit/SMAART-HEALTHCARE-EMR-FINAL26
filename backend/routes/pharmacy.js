const express = require('express');
const router = express.Router();

// Placeholder routes for pharmacy module
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Pharmacy module - Coming soon' });
});

module.exports = router;