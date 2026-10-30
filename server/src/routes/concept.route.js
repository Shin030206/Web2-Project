const express = require('express');
const router = express.Router();
const conceptController = require('../controllers/concept.controller');

router.get('/', conceptController.getAllConcepts);
router.get('/:code', conceptController.getConceptByCode);

module.exports = router;

