const express = require('express');
const router = express.Router();
const multer = require('multer');
const classificationController = require('../controllers/classificationController');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/classify-image
router.post('/', upload.single('image'), classificationController.classifyImage);

module.exports = router;
