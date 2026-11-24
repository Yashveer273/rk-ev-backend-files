const express = require('express');
const {
  getPortfolioOverview,
  buyPortfolioProduct,
  getAssetDetail,
  renewAsset,
} = require('../controllers/portfolioController');
const { protectInvestor } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectInvestor);

router.get('/overview', getPortfolioOverview);
router.post('/buy', buyPortfolioProduct);
router.get('/assets/:assetId', getAssetDetail);
router.post('/assets/:assetId/renew', renewAsset);

module.exports = router;