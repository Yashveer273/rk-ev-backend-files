const express = require('express');
const router = express.Router();
const {
  getAnalytics,
  getAnalyticsById,
  createAnalytics,
  updateAnalytics,
  deleteAnalytics
} = require('../controllers/analyticsController');

router.route('/').get(getAnalytics).post(createAnalytics);
router.route('/:id').get(getAnalyticsById).put(updateAnalytics).delete(deleteAnalytics);

module.exports = router;
