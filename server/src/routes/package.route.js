const express = require('express');
const router = express.Router();
const packageCtrl = require('../controllers/package.controller');
const { optionalAuth, requireAdmin } = require('../middlewares/auth');

router.get('/', optionalAuth, packageCtrl.getAllPackages);
router.get('/:id', packageCtrl.getPackageByIdentifier);
router.post('/', requireAdmin, packageCtrl.createPackage);
router.put('/:id', requireAdmin, packageCtrl.updatePackage);
router.delete('/:id', requireAdmin, packageCtrl.deletePackage);

module.exports = router;
