const express = require('express');
const router = express.Router();
const packageCtrl = require('../controllers/package.controller');

router.get('/', packageCtrl.getAllPackages);
router.get('/:identifier', packageCtrl.getPackageByIdentifier);
router.post('/', packageCtrl.createPackage);
router.put('/', packageCtrl.updatePackage);
router.delete('/:id', packageCtrl.deletePackage);

module.exports = router;