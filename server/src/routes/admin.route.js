const express = require('express');
const fileUpload = require('express-fileupload');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
const authCtrl = require('../controllers/auth.controller');
const { requireAdmin } = require('../middlewares/auth');

const upload = fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true,
  limitHandler: (req, res) => res.status(413).send({ error: "Ảnh tối đa 10MB!" })
});

router.use(requireAdmin);
router.get('/stats', adminCtrl.getStats);
router.get('/users', authCtrl.listUsers);
router.patch('/users/:id', authCtrl.updateUserByAdmin);
router.post('/uploads', upload, adminCtrl.uploadImage);

module.exports = router;
