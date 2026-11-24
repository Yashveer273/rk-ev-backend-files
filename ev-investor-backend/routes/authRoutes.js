const express = require('express');
const {
  registerInvestor,
  loginInvestor,
  logoutInvestor,
} = require('../controllers/authController');
const { protectInvestor } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerInvestor);
router.post('/login', loginInvestor);
router.post('/logout', protectInvestor, logoutInvestor);

module.exports = router;