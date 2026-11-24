const Investor = require('../models/Investor');
const PrivacyFeedback = require('../models/PrivacyFeedback');

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;

const normalizePhone = (raw = '') => {
  let clean = String(raw).replace(/\s+/g, '').trim();
  if (clean.startsWith('+91')) {
    clean = clean.slice(3);
  } else if (clean.startsWith('91') && clean.length > 10) {
    clean = clean.slice(2);
  }
  return clean;
};

const buildKycFileUrl = (req, file) => {
  if (!file || !file.filename) return '';
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/kyc/${file.filename}`;
};

const buildKycPayload = (investor) => {
  const kycObj = investor.kyc
    ? (typeof investor.kyc.toObject === 'function'
        ? investor.kyc.toObject()
        : investor.kyc)
    : {};

  return {
    investorId: investor.investorId,
    kycStatus: investor.kycStatus || 'Pending',
    fullNameAsPerPan: String(kycObj.fullNameAsPerPan || '').trim(),
    panNumber: String(kycObj.panNumber || '').trim().toUpperCase(),
    aadhaarNumber: String(kycObj.aadhaarNumber || '').trim(),
    panImageUrl: String(kycObj.panImageUrl || '').trim(),
    aadhaarImageUrl: String(kycObj.aadhaarImageUrl || '').trim(),
    dob: String(kycObj.dob || '').trim(),
    address: String(kycObj.address || '').trim(),
    remarks: String(kycObj.remarks || '').trim(),
    updatedAt: String(kycObj.updatedAt || '').trim(),
  };
};

// GET /api/profile
const getProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    profile: req.investor.toSafeJSON(),
  });
};

// PUT /api/profile
const updateProfile = async (req, res) => {
  try {
    const fullName =
      req.body.fullName !== undefined
        ? String(req.body.fullName).trim()
        : req.investor.fullName;
    const email =
      req.body.email !== undefined
        ? String(req.body.email).trim().toLowerCase()
        : req.investor.email;
    const phone =
      req.body.phone !== undefined
        ? normalizePhone(req.body.phone)
        : req.investor.phone;
    const city =
      req.body.city !== undefined
        ? String(req.body.city).trim()
        : req.investor.city;

    if (!fullName || !email || !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Valid fullName, 10-digit phone, and email are required',
      });
    }

    const conflict = await Investor.findOne({
      _id: { $ne: req.investor._id },
      $or: [{ phone }, { email }],
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Phone or email is already in use by another investor',
      });
    }

    req.investor.fullName = fullName;
    req.investor.email = email;
    req.investor.phone = phone;
    req.investor.city = city;
    await req.investor.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: req.investor.toSafeJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

// PUT /api/profile/bank-details
const updateBankDetails = async (req, res) => {
  try {
    const accountHolderName = String(req.body.accountHolderName || '').trim();
    const accountNumber = String(req.body.accountNumber || '').trim();
    const ifscCode = String(req.body.ifscCode || '').trim().toUpperCase();
    const bankName = String(req.body.bankName || '').trim();
    const upiId = String(req.body.upiId || '').trim();

    if (!accountHolderName) {
      return res.status(400).json({
        success: false,
        message: 'Account holder name is required',
      });
    }

    if (!accountNumber && !upiId) {
      return res.status(400).json({
        success: false,
        message: 'Provide bank account number or UPI ID',
      });
    }

    if (accountNumber && (!ifscCode || !bankName)) {
      return res.status(400).json({
        success: false,
        message: 'Bank name and IFSC code are required with account number',
      });
    }

    req.investor.bankDetails = {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    await req.investor.save();

    return res.status(200).json({
      success: true,
      message: 'Bank & payout details updated successfully',
      profile: req.investor.toSafeJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update bank details',
    });
  }
};

// GET /api/profile/kyc/status
const getKycStatus = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: buildKycPayload(req.investor),
      profile: req.investor.toSafeJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load KYC status',
    });
  }
};

// POST /api/profile/kyc/submit
const submitKyc = async (req, res) => {
  try {
    const existingKyc = req.investor.kyc
      ? (typeof req.investor.kyc.toObject === 'function'
          ? req.investor.kyc.toObject()
          : req.investor.kyc)
      : {};

    const fullNameAsPerPan = String(
      req.body.fullNameAsPerPan || req.body.fullName || ''
    ).trim();
    const panNumber = String(req.body.panNumber || req.body.pan || '')
      .trim()
      .toUpperCase();
    const aadhaarNumber = String(
      req.body.aadhaarNumber || req.body.aadhaar || ''
    )
      .replace(/\s+/g, '')
      .trim();
    const dob = String(req.body.dob || '').trim();
    const address = String(req.body.address || '').trim();

    const uploadedPan = req.files?.panImage?.[0];
    const uploadedAadhaar = req.files?.aadhaarImage?.[0];

    const panImageUrl = uploadedPan
      ? buildKycFileUrl(req, uploadedPan)
      : String(existingKyc.panImageUrl || '').trim();
    const aadhaarImageUrl = uploadedAadhaar
      ? buildKycFileUrl(req, uploadedAadhaar)
      : String(existingKyc.aadhaarImageUrl || '').trim();

    if (fullNameAsPerPan.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please enter full name as per PAN',
      });
    }

    if (!PAN_REGEX.test(panNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-character PAN',
      });
    }

    if (!AADHAAR_REGEX.test(aadhaarNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 12-digit Aadhaar number',
      });
    }

    if (!panImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'PAN card photo is required',
      });
    }

    if (!aadhaarImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar card photo is required',
      });
    }

    if (!dob) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth is required',
      });
    }

    if (address.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Please enter complete residential address',
      });
    }

    const updatedAt = new Date().toISOString().slice(0, 10);

    req.investor.kyc = {
      fullNameAsPerPan,
      panNumber,
      aadhaarNumber,
      panImageUrl,
      aadhaarImageUrl,
      dob,
      address,
      remarks: '',
      updatedAt,
    };
    req.investor.kycStatus = 'Pending';

    await req.investor.save();

    return res.status(200).json({
      success: true,
      message: 'KYC details and document photos submitted successfully',
      data: buildKycPayload(req.investor),
    
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to submit KYC details',
    });
  }
};

// POST /api/profile/privacy-feedback
const submitFeedback = async (req, res) => {
  try {
    const topic = String(req.body.topic || '').trim();
    const message = String(req.body.message || '').trim();

    if (!topic || !message) {
      return res.status(400).json({
        success: false,
        message: 'topic and message are required',
      });
    }

    const doc = await PrivacyFeedback.create({
      investorId: req.investor.investorId,
      topic,
      message,
      submittedDate: String(
        req.body.submittedDate || new Date().toISOString().slice(0, 10)
      ).trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Privacy feedback submitted',
      feedback: doc,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to submit privacy feedback',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateBankDetails,
  getKycStatus,
  submitKyc,
  submitFeedback,
};