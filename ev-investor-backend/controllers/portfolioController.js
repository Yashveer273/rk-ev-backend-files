const crypto = require('crypto');
const PortfolioAsset = require('../models/PortfolioAsset');

const toNum = (val, fallback = 0) => {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

const todayYMD = () => new Date().toISOString().slice(0, 10);

const buildDefaultGraphPoints = (investedAmount, monthlyReturn, dateStr) => {
  const baseDate = dateStr || todayYMD();
  const returnFactors = [0.88, 1.06, 0.94, 1.12, 0.91, 1.15, 0.96, 1.10, 0.92, 1.08, 0.97, 1.0];
  const investFactors = [0.90, 1.0, 0.95, 1.08, 0.94, 1.12, 0.98, 1.06, 0.93, 1.05, 0.97, 1.0];
  const months = [
    '2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05',
    '2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05',
    '2026-08-05', '2026-09-05', '2026-10-05', baseDate,
  ];

  return months.map((dt, idx) => ({
    id: `pt_${dt.replace(/-/g, '')}_${idx}`,
    date: dt,
    investedAmount: Math.round(investedAmount * investFactors[idx]),
    monthlyReturn: Math.round(monthlyReturn * returnFactors[idx]),
  }));
};

// GET /api/portfolio/overview
const getPortfolioOverview = async (req, res) => {
  try {
    const investorId = req.investor.investorId;
    const assets = await PortfolioAsset.find({ investorId }).sort({ createdAt: 1 });

    const activeAssets = assets.filter((a) => a.status !== 'Closed');
    const totalInvested = activeAssets.reduce((sum, a) => sum + toNum(a.investedAmount), 0);
    const totalMonthlyReturn = activeAssets.reduce((sum, a) => sum + toNum(a.monthlyReturn), 0);

    const currentMonthPrefix = todayYMD().slice(0, 7);
    const thisMonthAssets = activeAssets.filter((a) =>
      String(a.purchaseDate || '').startsWith(currentMonthPrefix)
    );
    const thisMonthInvested = thisMonthAssets.reduce(
      (sum, a) => sum + toNum(a.investedAmount),
      0
    );
    const thisMonthReturn = thisMonthAssets.reduce(
      (sum, a) => sum + toNum(a.monthlyReturn),
      0
    );

    const overallPointsMap = new Map();
    for (const asset of activeAssets) {
      const pts = asset.assetGraph?.points || [];
      for (const pt of pts) {
        const key = pt.date;
        if (!overallPointsMap.has(key)) {
          overallPointsMap.set(key, {
            id: `ov_${key.replace(/-/g, '')}`,
            date: key,
            investedAmount: 0,
            monthlyReturn: 0,
          });
        }
        const agg = overallPointsMap.get(key);
        agg.investedAmount += toNum(pt.investedAmount);
        agg.monthlyReturn += toNum(pt.monthlyReturn);
      }
    }

    const overallPoints = Array.from(overallPointsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return res.status(200).json({
      success: true,
      deployedCapital: {
        totalInvested,
        thisMonthInvested,
        totalMonthlyReturn,
        thisMonthReturn,
        activeAssetsCount: activeAssets.length,
      },
      overallGraph: {
        points: overallPoints,
      },
      portfolioAssets: assets.map((a) => a.toItemJSON()),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio overview',
    });
  }
};

// POST /api/portfolio/buy
const buyPortfolioProduct = async (req, res) => {
  try {
    const investorId = req.investor.investorId;
    const body = req.body || {};

    const vehicleId = String(body.vehicleId || '').trim();
    const storeId = String(body.storeId || body.clusterId || '').trim();
    const vehicleNoPlate = String(body.vehicleNoPlate || '').trim();
    const vehicleModelName = String(body.vehicleModelName || '').trim();

    if (!vehicleId || !storeId || !vehicleNoPlate || !vehicleModelName) {
      return res.status(400).json({
        success: false,
        message: 'vehicleId, storeId, vehicleNoPlate, and vehicleModelName are required',
      });
    }

    const units = Math.max(1, toNum(body.units, 1));
    const investedAmount = Math.max(0, toNum(body.investedAmount ?? body.investmentAmount, 0));
    const monthlyReturn = Math.max(0, toNum(body.monthlyReturn ?? body.investorReturnRate, 0));
    const purchaseDate = String(body.purchaseDate || todayYMD()).trim();
    const nextReturnDate = String(body.nextReturnDate || '2026-12-05').trim();
    const tenureMonths = Math.max(1, toNum(body.tenureMonths, 36));
    const completedMonths = Math.max(0, toNum(body.completedMonths, 0));
    const remainingMonths = Math.max(0, tenureMonths - completedMonths);

    const rawImages = Array.isArray(body.vehicleImage) ? body.vehicleImage : [];
    const vehicleImage = rawImages.map((u) => String(u).trim()).filter(Boolean);

    const assetId = String(body.assetId || body.id || crypto.randomInt(10000000, 99999999));

    const asset = await PortfolioAsset.create({
      assetId,
      investorId,
      vehicleId,
      storeId,
      vehicleNoPlate,
      vehicleModelName,
      vehicleYearModel: toNum(body.vehicleYearModel, 2026),
      companyName: String(body.companyName || 'EV').trim(),
      vehicleImage,
      clusterCity: String(body.clusterCity || 'Aligarh').trim(),
      clusterState: String(body.clusterState || 'Uttar Pradesh').trim(),
      units,
      investedAmount,
      monthlyReturn,
      status: String(body.status || 'Active').trim(),
      isRenewable: body.isRenewable !== false,
      purchaseDate,
      assetSummary: {
        investedAmount,
        purchaseDate,
        monthlyReturn,
        nextReturnAmount: toNum(body.nextReturnAmount, monthlyReturn),
        nextReturnDate,
      },
      renewal: {
        tenureMonths,
        completedMonths,
        remainingMonths,
        isRenewable: body.isRenewable !== false,
        renewalBonusPercent: toNum(body.renewalBonusPercent, 2),
        renewedDate: null,
      },
      assetGraph: {
        points: buildDefaultGraphPoints(investedAmount, monthlyReturn, purchaseDate),
      },
      productSpecs: body.productSpecs && typeof body.productSpecs === 'object'
        ? body.productSpecs
        : {
            id: assetId,
            vehicleType: '2-Wheeler',
            vehicleNoPlate,
            companyName: String(body.companyName || 'EV').trim(),
            purchaseLocation: String(body.clusterCity || 'Aligarh').trim(),
            sellerName: 'Company Direct',
            purchasePrice: toNum(body.purchasePrice, investedAmount + 20000),
            investmentAmount: investedAmount,
            investorReturnRate: monthlyReturn,
            outboundRentalRate: toNum(body.outboundRentalRate, monthlyReturn + 1500),
            status: 'Active',
            vehicleModelName,
            vehicleYearModel: toNum(body.vehicleYearModel, 2026),
            vehicleImage,
            vehicleId,
            clusterCity: String(body.clusterCity || 'Aligarh').trim(),
            clusterState: String(body.clusterState || 'Uttar Pradesh').trim(),
          },
    });

    return res.status(201).json({
      success: true,
      message: 'Portfolio product purchased and added',
      asset: asset.toItemJSON(),
      detail: asset.toDetailJSON(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Portfolio asset with this ID already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create portfolio asset',
    });
  }
};

// GET /api/portfolio/assets/:assetId
const getAssetDetail = async (req, res) => {
  try {
    const asset = await PortfolioAsset.findOne({
      assetId: req.params.assetId,
      investorId: req.investor.investorId,
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio asset not found',
      });
    }

    return res.status(200).json({
      success: true,
      detail: asset.toDetailJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch asset detail',
    });
  }
};

// POST /api/portfolio/assets/:assetId/renew
const renewAsset = async (req, res) => {
  try {
    const asset = await PortfolioAsset.findOne({
      assetId: req.params.assetId,
      investorId: req.investor.investorId,
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio asset not found',
      });
    }

    const extraMonths = Math.max(1, toNum(req.body.extraMonths, 12));
    const reinvestAmount = Math.max(0, toNum(req.body.reinvestAmount, 0));

    const newTenure = asset.renewal.tenureMonths + extraMonths;
    const newRemaining = Math.max(0, newTenure - asset.renewal.completedMonths);
    const newInvestedAmount = asset.assetSummary.investedAmount + reinvestAmount;

    const bonus = Math.round(
      (asset.assetSummary.monthlyReturn * (asset.renewal.renewalBonusPercent || 2)) / 100
    );
    const extraReturn = reinvestAmount > 0 ? Math.round((reinvestAmount * 5) / 100) : 0;
    const newMonthlyReturn = asset.assetSummary.monthlyReturn + bonus + extraReturn;
    const renewedDate = todayYMD();

    asset.investedAmount = newInvestedAmount;
    asset.monthlyReturn = newMonthlyReturn;
    asset.status = 'Active';
    asset.isRenewable = true;

    asset.assetSummary = {
      investedAmount: newInvestedAmount,
      purchaseDate: asset.assetSummary.purchaseDate,
      monthlyReturn: newMonthlyReturn,
      nextReturnAmount: newMonthlyReturn,
      nextReturnDate: asset.assetSummary.nextReturnDate,
    };

    asset.renewal = {
      tenureMonths: newTenure,
      completedMonths: asset.renewal.completedMonths,
      remainingMonths: newRemaining,
      isRenewable: true,
      renewalBonusPercent: asset.renewal.renewalBonusPercent || 2,
      renewedDate,
    };

    asset.assetGraph.points.push({
      id: `rn_${renewedDate.replace(/-/g, '')}_${asset.assetGraph.points.length}`,
      date: renewedDate,
      investedAmount: newInvestedAmount,
      monthlyReturn: newMonthlyReturn,
    });

    await asset.save();

    return res.status(200).json({
      success: true,
      message: 'Portfolio asset renewed successfully',
      asset: asset.toItemJSON(),
      detail: asset.toDetailJSON(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to renew portfolio asset',
    });
  }
};

module.exports = {
  getPortfolioOverview,
  buyPortfolioProduct,
  getAssetDetail,
  renewAsset,
};