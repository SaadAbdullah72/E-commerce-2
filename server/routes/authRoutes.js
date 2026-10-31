const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public routes
router.post('/signup', authController.signup);
router.post('/register', authController.signup); // friendly alias
router.post('/login', authController.login);
router.post('/make-admin', authController.makeAdmin); // dev/admin promotion route

// Protected routes
router.get('/me', authenticateToken, authController.getMe);
router.put('/profile', authenticateToken, authController.updateProfile);

// Admin-only route verification
router.get('/check-admin', authenticateToken, requireAdmin, (req, res) => {
  res.json({ success: true, message: 'Admin verified', user: req.user });
});

module.exports = router;
