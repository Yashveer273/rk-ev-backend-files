const EvCouponInvestor = require('../models/evCoupon_investor.model');

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function hasWhitespace(val) {
  return /\s/.test(String(val ?? ''));
}

function normalizePhoneNoCountryCode(raw) {
  if (!raw) return '';
  let digits = String(raw).trim().replace(/\D+/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  return digits;
}

function normalizeDateOnly(input) {
  if (!input) return '';
  const raw = String(input).trim();
  if (DATE_ONLY_REGEX.test(raw)) {
    return raw;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isDateExpired(expiryDateStr) {
  const normalized = normalizeDateOnly(expiryDateStr);
  if (!normalized) return false;
  const [y, m, d] = normalized.split('-').map(Number);
  const expiryEndOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
  return Date.now() > expiryEndOfDay.getTime();
}

function parsePagination(query = {}, defaultLimit = 10, maxLimit = 100) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

// ADMIN: Create Coupon (Phone without country code, no spaces)
exports.generateCouponForUser = async (req, res) => {
  try {
    const payload = req.body || {};
    const rawCode = String(payload.code ?? '');
    if (hasWhitespace(rawCode)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code cannot contain spaces',
      });
    }

    const code = rawCode.trim().toUpperCase();
    const rawPhoneInput = String(payload.phone ?? '');
    if (hasWhitespace(rawPhoneInput)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number cannot contain spaces',
      });
    }

    const phone = normalizePhoneNoCountryCode(rawPhoneInput);
    if (rawPhoneInput.trim() !== '' && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid 10-digit phone number without country code and spaces',
      });
    }

    const expiryDate = normalizeDateOnly(payload.expiryDate);
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required',
      });
    }
    if (!expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid expiry date (YYYY-MM-DD) is required',
      });
    }

    const existing = await EvCouponInvestor.findOne({ code });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Coupon code "${code}" already exists`,
      });
    }

    const discountType =
      payload.discountType === 'fixed' ? 'fixed' : 'percentage';
    const discountValue = Number(
      payload.discountValue ?? payload.discountAmount ?? payload.discount ?? 0
    );

    if (Number.isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid discountValue is required',
      });
    }

    const discountAmount =
      discountType === 'fixed' ? Math.round(discountValue) : 0;
    const assignedPhone = phone || null;

    const coupon = await EvCouponInvestor.create({
      code,
      phone: assignedPhone,
      discountType,
      discountValue,
      discountAmount,
      description: String(payload.description || '').trim(),
      expiryDate,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
      isUsed: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: {
        _id: coupon._id,
        code: coupon.code,
        phone: coupon.phone,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: coupon.discountAmount,
        description: coupon.description,
        expiryDate: normalizeDateOnly(coupon.expiryDate),
        isActive: coupon.isActive,
        isUsed: coupon.isUsed,
        createdAt: coupon.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate coupon',
    });
  }
};

// ADMIN: Get Coupons
exports.getCouponsAdmin = async (req, res) => {
  try {
    const { search, status } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 10, 100);

    const conditions = [];

    if (status === 'active') {
      conditions.push({ isActive: true, isUsed: false });
    } else if (status === 'inactive') {
      conditions.push({ isActive: false });
    } else if (status === 'used') {
      conditions.push({ isUsed: true });
    }

    if (search && String(search).trim() !== '') {
      const safe = String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      conditions.push({
        $or: [
          { code: regex },
          { phone: regex },
          { description: regex },
        ],
      });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const [coupons, totalItems] = await Promise.all([
      EvCouponInvestor.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EvCouponInvestor.countDocuments(filter),
    ]);

    const normalizedList = coupons.map((item) => {
      const obj = item.toObject ? item.toObject() : item;
      const cleanExpiry = normalizeDateOnly(obj.expiryDate);
      const resolvedPhone = normalizePhoneNoCountryCode(obj.phone || '');

      return {
        ...obj,
        phone: resolvedPhone || null,
        expiryDate: cleanExpiry,
        isExpired: isDateExpired(cleanExpiry),
      };
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      success: true,
      count: normalizedList.length,
      data: normalizedList,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch coupons',
    });
  }
};

// ADMIN: Delete Coupon
exports.deleteCouponAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Coupon identifier is required',
      });
    }

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(id));
    const query = isObjectId
      ? { $or: [{ _id: id }, { code: String(id).toUpperCase() }] }
      : { code: String(id).toUpperCase() };

    const deleted = await EvCouponInvestor.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Coupon "${deleted.code}" deleted successfully`,
      data: { _id: deleted._id, code: deleted.code },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete coupon',
    });
  }
};

// INVESTOR / CHECKOUT: 2-Step Coupon Validation (Existence/Status/Expiry -> Phone Match)
exports.validateCouponTwoStep = async (req, res) => {
  try {
    const rawCode = String(req.body?.code ?? '');
    if (hasWhitespace(rawCode)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Coupon code cannot contain spaces',
      });
    }

    const code = rawCode.trim().toUpperCase();
    const rawIncomingPhone = String(req.body?.phone ?? '');
    if (hasWhitespace(rawIncomingPhone)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Phone number cannot contain spaces',
      });
    }

    const incomingPhone = normalizePhoneNoCountryCode(rawIncomingPhone);

    if (!code) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Coupon code is required',
      });
    }

    const coupon = await EvCouponInvestor.findOne({ code });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        valid: false,
        step: 1,
        message: 'Invalid coupon code',
      });
    }

    if (coupon.isActive === false) {
      return res.status(400).json({
        success: false,
        valid: false,
        step: 1,
        message: 'Coupon is inactive',
      });
    }

    if (coupon.isUsed) {
      return res.status(400).json({
        success: false,
        valid: false,
        step: 1,
        message: 'Coupon has already been used',
      });
    }

    const cleanExpiry = normalizeDateOnly(coupon.expiryDate);
    if (isDateExpired(cleanExpiry)) {
      return res.status(400).json({
        success: false,
        valid: false,
        step: 1,
        message: `Coupon expired on ${cleanExpiry}`,
      });
    }

    const assignedPhone = normalizePhoneNoCountryCode(coupon.phone || '');

    if (assignedPhone !== '') {
      if (!incomingPhone || incomingPhone !== assignedPhone) {
        return res.status(403).json({
          success: false,
          valid: false,
          step: 2,
          message: 'This coupon is not assigned to this phone number',
        });
      }
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: 'Coupon is valid',
      data: {
        code: coupon.code,
        phone: assignedPhone || null,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: coupon.discountAmount,
        expiryDate: cleanExpiry,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      valid: false,
      message: err.message || 'Failed to validate coupon',
    });
  }
};