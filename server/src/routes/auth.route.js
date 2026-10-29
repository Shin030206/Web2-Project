const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/logout', authCtrl.logout);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/verify-reset-otp', authCtrl.verifyResetOtp);
router.post('/reset-password', authCtrl.resetPassword);
router.get('/me', requireAuth, authCtrl.getMe);
router.put('/me', requireAuth, authCtrl.updateMe);
router.put('/change-password', requireAuth, authCtrl.changePassword);
router.get('/me/points', requireAuth, authCtrl.getMyPoints);

module.exports = router;
