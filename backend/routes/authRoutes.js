const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/register - Register a new user
router.post('/register', authController.register);

// POST /api/auth/login - Login a user
router.post('/login', authController.login);

// PUT /api/auth/profile - Update user profile (protected)
router.put('/profile', authenticateToken, authController.updateProfile);

// POST /api/auth/password-reset/request
router.post('/password-reset/request', authController.requestPasswordReset);

// POST /api/auth/password-reset/confirm
router.post('/password-reset/confirm', authController.confirmPasswordReset);

// POST /api/auth/refresh - refresh Supabase session
router.post('/refresh', authController.refresh);

module.exports = router;
