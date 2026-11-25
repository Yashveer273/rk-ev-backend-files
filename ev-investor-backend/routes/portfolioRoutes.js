
const express = require('express');
const router = express.Router();

const {
  // Investor APIs
  getPortfolioOverview,
  getPortfolioGraph,
  buyPortfolioProduct,
  getAssetDetail,
  getAssetGraph,
  renewAsset,
  getInvestorNextPayments,
  getInvestorReturnHistory,
  getInvestorPortfolioHistory,

  // Admin APIs
  getAdminPortfolioOverview,
  getAdminPortfolioRecords,
  getAdminPortfolioGraph,
  getAdminInvestmentHistory,
  addAdminInvestment,
  getAdminReturnSettlements,
  settleAdminReturnProfit,
  updateAdminNextPayment,
} = require('../controllers/portfolioController');

// ==================================================
// INVESTOR APIs
// ==================================================

// Portfolio overview
// GET /portfolio/overview
router.get('/overview', getPortfolioOverview);

// Overall portfolio graph
// GET /portfolio/graph?months=6
// GET /portfolio/graph?months=12
router.get('/graph', getPortfolioGraph);

// Buy portfolio product
// POST /portfolio/buy
router.post('/buy', buyPortfolioProduct);

// Particular asset detail
// GET /portfolio/assets/:assetId
router.get('/assets/:assetId', getAssetDetail);

// Particular asset graph
// GET /portfolio/assets/:assetId/graph?months=6
// GET /portfolio/assets/:assetId/graph?months=12
router.get('/assets/:assetId/graph', getAssetGraph);

// Renew / reinvest asset
// POST /portfolio/assets/:assetId/renew
router.post('/assets/:assetId/renew', renewAsset);

// Upcoming reinvestments
// GET /portfolio/next-payment
router.get('/next-payment', getInvestorNextPayments);

// Existing return settlements history
// GET /portfolio/return-history
router.get('/return-history', getInvestorReturnHistory);

// Combined investment and return history
// GET /portfolio/history?months=6
// GET /portfolio/history?months=12
router.get('/history', getInvestorPortfolioHistory);


// ==================================================
// ADMIN APIs
// ==================================================

// Admin portfolio overview
// GET /portfolio/admin/overview
router.get('/admin/overview', getAdminPortfolioOverview);

// Admin portfolio records
// GET /portfolio/admin/records
router.get('/admin/records', getAdminPortfolioRecords);

// Admin portfolio graph
// GET /portfolio/admin/graph?months=6
// GET /portfolio/admin/graph?months=12
// Optional: &investorId=ID
// Optional: &assetId=ASSET_ID
router.get('/admin/graph', getAdminPortfolioGraph);

// Admin investment history
// GET /portfolio/admin/investments
router.get('/admin/investments', getAdminInvestmentHistory);

// Admin add investment
// POST /portfolio/admin/investments
router.post('/admin/investments', addAdminInvestment);

// Admin return settlements
// GET /portfolio/admin/settlements
router.get('/admin/settlements', getAdminReturnSettlements);

// Admin add return settlement
// POST /portfolio/admin/settlements
router.post('/admin/settlements', settleAdminReturnProfit);

// Admin update next reinvestment
// PUT /portfolio/admin/next-payment
router.put('/admin/next-payment', updateAdminNextPayment);

module.exports = router;
