const express = require('express');
const router = express.Router();
const bookingCtrl = require('../controllers/booking.controller');

router.get('/', bookingCtrl.getBookings);
router.post('/', bookingCtrl.createBooking);
router.put('/reschedule', bookingCtrl.rescheduleBooking);
router.put('/cancel', bookingCtrl.cancelBooking);

module.exports = router;