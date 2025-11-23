const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin: Fetch all reports with owner data
router.get('/reports', authenticateToken, requireAdmin, adminController.getAllReports);

// Admin: Moderate report
router.patch('/reports/:id/moderate', authenticateToken, requireAdmin, adminController.moderateReport);

// Admin: Update report status
router.patch('/reports/:id/status', authenticateToken, requireAdmin, adminController.updateReportStatus);

// Admin: List users
router.get('/users', authenticateToken, requireAdmin, adminController.listUsers);

// Admin: Block/Unblock user
router.patch('/users/:id/block', authenticateToken, requireAdmin, adminController.toggleUserBlock);

// Admin: Delete user
router.delete('/users/:id', authenticateToken, requireAdmin, adminController.deleteUser);

module.exports = router;
