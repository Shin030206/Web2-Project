const express = require('express');
const catalogCtrl = require('../controllers/catalog.controller');
const { optionalAuth, requireAdmin } = require('../middlewares/auth');

// Route CRUD giống nhau cho concept, bộ sưu tập, dịch vụ thêm, voucher
function crudRouter(crud, extend) {
  const router = express.Router();
  if (extend) extend(router);
  router.get('/', optionalAuth, crud.list);
  router.get('/:id', crud.getOne);
  router.post('/', requireAdmin, crud.create);
  router.put('/:id', requireAdmin, crud.update);
  router.delete('/:id', requireAdmin, crud.remove);
  return router;
}

module.exports = {
  conceptRouter: crudRouter(catalogCtrl.concept),
  collectionRouter: crudRouter(catalogCtrl.album),
  addonRouter: crudRouter(catalogCtrl.addon),
  voucherRouter: crudRouter(catalogCtrl.voucher, router => {
    router.post('/validate', optionalAuth, catalogCtrl.validateVoucher);
  })
};
