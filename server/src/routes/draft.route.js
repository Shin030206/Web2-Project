const express = require('express');
const router = express.Router();
const draftCtrl = require('../controllers/draft.controller');
const { optionalAuth } = require('../middlewares/auth');

router.get('/', optionalAuth, draftCtrl.getDraft);
router.put('/', optionalAuth, draftCtrl.saveDraft);
router.delete('/', optionalAuth, draftCtrl.deleteDraft);

module.exports = router;
