const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Investor = require('../models/Investor');

const normalizePhone = (raw = '') => {
  let clean = String(raw).replace(/\s+/g, '').trim();
  if (clean.startsWith('+91')) {
    clean = clean.slice(3);
  } else if (clean.startsWith('91') && clean.length > 10) {
    clean = clean.slice(2);
  }
  return clean;
};

const signToken = (investor) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { sub: investor._id.toString(), tv: investor.tokenVersion },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/register

const registerInvestor = async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const phone = normalizePhone(req.body.phone || '');
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const city = String(
      req.body.city || 'Aligarh, Uttar Pradesh'
    ).trim();

    // ==========================================
    // REQUIRED FIELD VALIDATION
    // ==========================================

    if (!fullName || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, phone, email, and password are required',
      });
    }

    // ==========================================
    // FULL NAME VALIDATION
    // ==========================================

    if (fullName.length < 2 || fullName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be between 2 and 50 characters',
      });
    }

    if (!/^[a-zA-Z\s.'-]+$/.test(fullName)) {
      return res.status(400).json({
        success: false,
        message: 'Full name contains invalid characters',
      });
    }

    // ==========================================
    // PHONE VALIDATION
    // ==========================================

    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number',
      });
    }

    // ==========================================
    // EMAIL VALIDATION
    // ==========================================

    if (email.length < 5 || email.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Email must be between 5 and 100 characters',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // ==========================================
    // PASSWORD VALIDATION
    // ==========================================

    if (password.length < 6 || password.length > 32) {
      return res.status(400).json({
        success: false,
        message: 'Password must be between 6 and 32 characters',
      });
    }

    // ==========================================
    // CITY VALIDATION
    // ==========================================

    if (city.length < 2 || city.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'City must be between 2 and 100 characters',
      });
    }

    // ==========================================
    // CHECK EXISTING INVESTOR
    // ==========================================

    const existing = await Investor.findOne({
      $or: [{ phone }, { email }],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Investor with this phone or email already exists',
      });
    }

    // ==========================================
    // CREATE INVESTOR
    // ==========================================

    const investor = await Investor.create({
      investorId: String(crypto.randomInt(10000000, 99999999)),
      fullName,
      phone,
      email,
      password,
      city,
    });

    // ==========================================
    // GENERATE JWT TOKEN
    // ==========================================

    const token = signToken(investor);

    return res.status(201).json({
      success: true,
      message: 'Investor registered successfully',
      token,
      investor: investor.toSafeJSON(),
    });

  } catch (err) {
console.log(err);
    if (err.name === 'ValidationError') {
      const firstMsg =
        Object.values(err.errors)[0]?.message || 'Validation error';

      return res.status(400).json({
        success: false,
        message: firstMsg,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to register investor',
    });
  }
};


// POST /api/auth/login
const loginInvestor = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone || '');
    const password = String(req.body.password || '');

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required',
      });
    }

    const investor = await Investor.findOne({ phone }).select('+password');
    if (!investor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password',
      });
    }

    const isMatch = await investor.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password',
      });
    }

    const token = signToken(investor);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      investor: investor.toSafeJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
};

// POST /api/auth/logout
const logoutInvestor = async (req, res) => {
  try {
    req.investor.tokenVersion += 1;
    await req.investor.save();

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
    });
  }
};

module.exports = {
  registerInvestor,
  loginInvestor,
  logoutInvestor,
};