const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/payment.controller');

router.get('/', paymentCtrl.getPaymentHistory);
router.get('/qr/:bookingId', paymentCtrl.getPaymentQR);
router.post('/confirm', paymentCtrl.confirmPayment);

module.exports = router;