const jwt = require('jsonwebtoken');
const Investor = require('../models/Investor');

const protectInvestor = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token missing',
      });
    }

    const token = authHeader.split(' ')[1].trim();
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: 'JWT secret is not configured',
      });
    }

    const decoded = jwt.verify(token, secret);
    const investor = await Investor.findById(decoded.sub);

    if (!investor || investor.tokenVersion !== decoded.tv) {
      return res.status(401).json({
        success: false,
        message: 'Session invalid or expired',
      });
    }

    req.investor = investor;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

module.exports = { protectInvestor };