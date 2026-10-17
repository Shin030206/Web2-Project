const express = require('express');
const router = express.Router();
const slotCtrl = require('../controllers/slot.controller');

router.get('/occupied', slotCtrl.getOccupiedSlots);
router.post('/hold', slotCtrl.holdSlot);
router.get('/hold/:id', slotCtrl.getHoldSlotById);

module.exports = router;