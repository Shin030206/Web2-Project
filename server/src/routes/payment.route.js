const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/payment.controller');
const { optionalAuth, requireAdmin } = require('../middlewares/auth');

router.post('/', optionalAuth, paymentCtrl.createPayment);
router.post('/vnpay', optionalAuth, paymentCtrl.createVnpayPayment);
router.get('/vnpay/return', paymentCtrl.vnpayReturn);
router.get('/vnpay/ipn', paymentCtrl.vnpayIpn);
router.get('/', requireAdmin, paymentCtrl.getPayments);
router.get('/qr/:bookingId', optionalAuth, paymentCtrl.getPaymentQR);
router.put('/:id/confirm', requireAdmin, paymentCtrl.confirmPayment);
router.put('/:id/reject', requireAdmin, paymentCtrl.rejectPayment);

module.exports = router;
