const express = require('express');
const router = express.Router();

const evProductInvestorController = require('../controllers/evProduct_investor.controller');
const evCouponInvestorController = require('../controllers/evCoupon_investor.controller');
const { verifyEncryptionAuth } = require('../middleware/authMiddleware');

// --- Investor App Product GET APIs (Supports search, category, page, limit) ---
router.get('/products', evProductInvestorController.getProductsInvestor);
router.get('/products/search', evProductInvestorController.getProductsInvestor);
router.get('/products/:id', evProductInvestorController.getProductByIdInvestor);

// --- Coupon Validation API (2-Step: Existence/Status -> User ID Match) ---
router.post('/coupons/validate', evCouponInvestorController.validateCouponTwoStep);

// --- Admin Product APIs (Protected with verifyEncryptionAuth) ---
// Supports query params: ?search=&category=&status=&page=1&limit=10
router.get(
  '/admin/products',
 
  evProductInvestorController.getProductsAdmin
);
router.get(
  '/admin/products/search',

  evProductInvestorController.getProductsAdmin
);
router.post(
  '/admin/products',
  verifyEncryptionAuth,
  evProductInvestorController.createProductAdmin
);
router.put(
  '/admin/products/:id',
  verifyEncryptionAuth,
  evProductInvestorController.updateProductAdmin
);
router.patch(
  '/admin/products/:id',
  verifyEncryptionAuth,
  evProductInvestorController.updateProductAdmin
);
router.delete(
  '/admin/products/:id',
  verifyEncryptionAuth,
  evProductInvestorController.deleteProductAdmin
);

// --- Admin Coupon APIs (Protected with verifyEncryptionAuth) ---
router.get(
  '/admin/coupons',
 
  evCouponInvestorController.getCouponsAdmin
);
router.post(
  '/admin/coupons/generate',
  verifyEncryptionAuth,
  evCouponInvestorController.generateCouponForUser
);
router.delete(
  '/admin/coupons/:id',
  verifyEncryptionAuth,
  evCouponInvestorController.deleteCouponAdmin
);

module.exports = router;