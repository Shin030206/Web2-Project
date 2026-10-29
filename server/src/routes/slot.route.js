const express = require('express');
const router = express.Router();
const slotCtrl = require('../controllers/slot.controller');
const { optionalAuth } = require('../middlewares/auth');

router.get('/', slotCtrl.getAvailableSlots);
router.get('/occupied', slotCtrl.getOccupiedSlots);
router.post('/hold', optionalAuth, slotCtrl.holdSlot);
router.get('/hold/:id', slotCtrl.getHoldSlotById);
router.delete('/hold/:id', slotCtrl.releaseHoldSlot);

module.exports = router;
