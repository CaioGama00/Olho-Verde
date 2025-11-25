const express = require('express');
const router = express.Router();
const multer = require('multer');
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/reports - Get all reports
router.get('/', reportController.getAllReports);

// GET /api/reports/:id/image-proxy - proxy image to avoid CORS issues
router.get('/:id/image-proxy', reportController.proxyReportImage);

// GET /api/reports/:id - Report details + comments + user vote
router.get('/:id', reportController.getReportById);

// GET /api/reports/:id/comments - list comments
router.get('/:id/comments', reportController.getReportComments);

// POST /api/reports/:id/comments - add new comment (protected)
router.post('/:id/comments', authenticateToken, reportController.addComment);

// POST /api/reports - Create a new report (protected)
router.post('/', authenticateToken, upload.single('image'), reportController.createReport);

// POST /api/reports/:id/vote - Vote on a report (protected)
router.post('/:id/vote', authenticateToken, reportController.voteOnReport);

module.exports = router;
