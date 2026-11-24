const EvProductInvestor = require('../models/evProduct_investor.model');

const KNOWN_CATEGORIES = [
  'electric-scooty',
  'electric-bike',
  'three-wheeler',
  'electric-car',
];

const VALID_CATEGORIES = ['all', ...KNOWN_CATEGORIES, 'other'];

function escapeRegex(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePaginationParams(query = {}, defaultLimit = 10, maxLimit = 100) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}

function buildCategoryCondition(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    return null;
  }

  if (normalized === 'other') {
    return {
      $or: [
        { category: 'other' },
        { category: { $nin: KNOWN_CATEGORIES } },
      ],
    };
  }

  return { category: normalized };
}

function buildSearchCondition(searchTerm) {
  const trimmed = String(searchTerm || '').trim();
  if (!trimmed) return null;

  const regex = new RegExp(escapeRegex(trimmed), 'i');
  const orConditions = [
    { id: regex },
    { brand: regex },
    { modelName: regex },
    { type: regex },
    { category: regex },
  ];

  // Match modelYear if user types digits (e.g. "2025" or "2026")
  if (/^\d{1,4}$/.test(trimmed)) {
    const yearNum = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(yearNum)) {
      orConditions.push({ modelYear: yearNum });
    }
  }

  return { $or: orConditions };
}

function normalizeStringArray(input, separator = '|') {
  if (Array.isArray(input)) {
    return input.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    const splitChar = input.includes(separator) ? separator : '\n';
    return input
      .split(splitChar)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeGalleryArray(input) {
  if (Array.isArray(input)) {
    return input.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/[\n,|]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveCoverAndGallery(coverImageInput, galleryInput) {
  const rawCover = coverImageInput ? String(coverImageInput).trim() : '';
  const parsedGallery = normalizeGalleryArray(galleryInput);

  const gallery =
    parsedGallery.length > 0
      ? parsedGallery
      : rawCover
        ? [rawCover]
        : [];

  const coverImage = rawCover || gallery[0] || '';

  return { coverImage, gallery };
}

function formatVehicleAge(val) {
  const str = String(val ?? '').trim();
  if (!str) return 'Brand New';
  if (/^\d+$/.test(str)) {
    const yrs = Number(str);
    if (yrs === 0) return 'Brand New';
    return yrs === 1 ? '1 Year Old' : `${yrs} Years Old`;
  }
  return str;
}

function formatRange(val) {
  const str = String(val ?? '').trim();
  if (!str) return '';
  if (/^\d+(\.\d+)?$/.test(str)) {
    return `${str} km / charge`;
  }
  return str;
}

function formatBattery(val) {
  const str = String(val ?? '').trim();
  if (!str) return '';
  if (/^\d+(\.\d+)?$/.test(str)) {
    return `${str} kWh Lithium-Ion`;
  }
  return str;
}

function formatChargingTime(val) {
  const str = String(val ?? '').trim();
  if (!str) return '';
  if (/^\d+(\.\d+)?$/.test(str)) {
    const hrs = Number(str);
    return `${hrs} ${hrs === 1 ? 'Hr' : 'Hrs'}`;
  }
  return str;
}

function normalizeSpecs(specsInput = {}, fallbackModelName = '') {
  return {
    brandModel:
      (specsInput.brandModel && String(specsInput.brandModel).trim()) ||
      fallbackModelName,
    vehicleAge: formatVehicleAge(specsInput.vehicleAge),
    range: formatRange(specsInput.range),
    battery: formatBattery(specsInput.battery),
    chargingTime: formatChargingTime(specsInput.chargingTime),
  };
}

// ADMIN: Create EV Investor Product (8-char alphanumeric ID generated via model)
exports.createProductAdmin = async (req, res) => {
  try {
    const payload = req.body;
    const resolvedModelName =
      (payload.modelName && String(payload.modelName).trim()) ||
      (payload.specs &&
        payload.specs.brandModel &&
        String(payload.specs.brandModel).trim());

    const { coverImage, gallery } = resolveCoverAndGallery(
      payload.coverImage,
      payload.gallery
    );

    if (
      !resolvedModelName ||
      !payload.brand ||
      !payload.unitPrice ||
      !payload.specs ||
      !coverImage
    ) {
      return res.status(400).json({
        success: false,
        message:
          'brand, modelName, unitPrice, specs, and at least one image are required',
      });
    }

    const currentYear = new Date().getFullYear();
    const yearNum = Number(payload.modelYear ?? currentYear);
    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > currentYear) {
      return res.status(400).json({
        success: false,
        message: `modelYear must be a valid year between 2000 and ${currentYear}`,
      });
    }

    const rate = Number(payload.monthlyReturnRate ?? 0);
    const autoId = EvProductInvestor.generateAutoId();

    const product = await EvProductInvestor.create({
      id: autoId,
      type: payload.type,
      category: payload.category,
      brand: String(payload.brand).trim(),
      modelName: resolvedModelName,
      modelYear: yearNum,
      infoTags: normalizeStringArray(payload.infoTags, ','),
      summary: payload.summary,
      unitPrice: Number(payload.unitPrice),
      monthlyReturnRate: rate,
      specs: normalizeSpecs(payload.specs, resolvedModelName),
      coverImage,
      gallery,
      highlights: normalizeStringArray(payload.highlights, '|'),
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    });

    return res.status(201).json({
      success: true,
      message: 'EV investor product created successfully',
      data: product,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create EV investor product',
    });
  }
};

// ADMIN: Edit / Update EV Investor Product
exports.updateProductAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.id;
    delete updates.name;
    delete updates.deploymentZone;
    delete updates.expectedReturn;

    if (updates.modelYear !== undefined) {
      const currentYear = new Date().getFullYear();
      const yearNum = Number(updates.modelYear);
      if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > currentYear) {
        return res.status(400).json({
          success: false,
          message: `modelYear must be a valid year between 2000 and ${currentYear}`,
        });
      }
      updates.modelYear = yearNum;
    }

    if (updates.coverImage !== undefined || updates.gallery !== undefined) {
      const existing = await EvProductInvestor.findOne({ id });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'EV investor product not found',
        });
      }

      const nextCoverInput =
        updates.coverImage !== undefined ? updates.coverImage : existing.coverImage;
      const nextGalleryInput =
        updates.gallery !== undefined ? updates.gallery : existing.gallery;

      const resolved = resolveCoverAndGallery(nextCoverInput, nextGalleryInput);
      updates.coverImage = resolved.coverImage;
      updates.gallery = resolved.gallery;
    }

    if (updates.specs !== undefined) {
      updates.specs = normalizeSpecs(updates.specs, updates.modelName || '');
    }

    if (updates.highlights !== undefined) {
      updates.highlights = normalizeStringArray(updates.highlights, '|');
    }
    if (updates.infoTags !== undefined) {
      updates.infoTags = normalizeStringArray(updates.infoTags, ',');
    }

    const updated = await EvProductInvestor.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'EV investor product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'EV investor product updated successfully',
      data: updated,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to update EV investor product',
    });
  }
};

// ADMIN: Delete EV Investor Product
exports.deleteProductAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await EvProductInvestor.findOneAndDelete({ id });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'EV investor product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'EV investor product deleted successfully',
      data: { id: deleted.id },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete EV investor product',
    });
  }
};

// ADMIN: Get EV Investor Products with Search, Category, Status & Pagination
exports.getProductsAdmin = async (req, res) => {
  try {
    const { category, search, status } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query, 10, 100);

    const conditions = [];

    const normalizedCat = String(category || '').trim().toLowerCase();
    if (normalizedCat && normalizedCat !== 'all') {
      if (!VALID_CATEGORIES.includes(normalizedCat)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category filter',
        });
      }
      const catCond = buildCategoryCondition(normalizedCat);
      if (catCond) conditions.push(catCond);
    }

    if (status === 'active') {
      conditions.push({ isActive: true });
    } else if (status === 'inactive') {
      conditions.push({ isActive: false });
    }

    const searchCond = buildSearchCondition(search);
    if (searchCond) {
      conditions.push(searchCond);
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const [products, totalItems] = await Promise.all([
      EvProductInvestor.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EvProductInvestor.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
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
      message: err.message || 'Failed to fetch admin EV products',
    });
  }
};

// INVESTOR APP: Get Active EV Products with Search, Category & Pagination
exports.getProductsInvestor = async (req, res) => {
  try {
    const { category, search } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query, 10, 100);

    const conditions = [{ isActive: true }];

    const normalizedCat = String(category || '').trim().toLowerCase();
    if (normalizedCat && normalizedCat !== 'all') {
      if (!VALID_CATEGORIES.includes(normalizedCat)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category filter',
        });
      }
      const catCond = buildCategoryCondition(normalizedCat);
      if (catCond) conditions.push(catCond);
    }

    const searchCond = buildSearchCondition(search);
    if (searchCond) {
      conditions.push(searchCond);
    }

    const filter = { $and: conditions };

    const [products, totalItems] = await Promise.all([
      EvProductInvestor.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      EvProductInvestor.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
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
      message: err.message || 'Failed to fetch investor EV products',
    });
  }
};

// INVESTOR APP: Get Single EV Product by ID
exports.getProductByIdInvestor = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await EvProductInvestor.findOne({ id, isActive: true });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'EV investor product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch EV investor product details',
    });
  }
};