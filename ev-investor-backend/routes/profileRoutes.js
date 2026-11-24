const express = require('express');
const {
  getProfile,
  updateProfile,
  updateBankDetails,
  submitFeedback,
  getKycStatus,
  submitKyc
} = require('../controllers/profileController');
const { protectInvestor } = require('../middleware/authMiddleware');
const { kycUploadMiddleware } = require('../middleware/kycUpload');
const router = express.Router();

router.use(protectInvestor);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/bank-details', updateBankDetails);
router.post('/feedback', submitFeedback);
router.get('/kyc/status', getKycStatus);
router.post('/kyc/submit', kycUploadMiddleware, submitKyc);

module.exports = router;