const express = require('express');
const router = express.Router();
const bookingCtrl = require('../controllers/booking.controller');
const { requireAuth, optionalAuth, requireAdmin } = require('../middlewares/auth');

router.post('/quote', optionalAuth, bookingCtrl.getQuote);
router.get('/lookup', bookingCtrl.lookupBooking);
router.get('/my', requireAuth, bookingCtrl.getMyBookings);
router.get('/', requireAdmin, bookingCtrl.getBookings);
router.post('/', optionalAuth, bookingCtrl.createBooking);
router.get('/:id', optionalAuth, bookingCtrl.getBookingById);
router.put('/:id/reschedule', optionalAuth, bookingCtrl.rescheduleBooking);
router.put('/:id/cancel', optionalAuth, bookingCtrl.cancelBooking);
router.patch('/:id/status', requireAdmin, bookingCtrl.updateBookingStatus);

module.exports = router;
