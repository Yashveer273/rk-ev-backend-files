
const mongoose = require('mongoose');
const Portfolio = require('../models/PortfolioAsset');

// --------------------------------------------------
// Common Helpers
// --------------------------------------------------

const ALLOWED_GRAPH_MONTHS = [6, 12];

const getInvestorId = (req) => {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.investorId ||
    req.query?.investorId ||
    req.body?.investorId ||
    null
  );
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ''));
};

const toObjectId = (id) => {
  return new mongoose.Types.ObjectId(String(id));
};

const numberValue = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const addMonths = (date, months = 8) => {
  const result = new Date(date);
  const day = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(day, lastDay));

  return result;
};

const getMonthKey = (date) => {
  const d = new Date(date);

  return `${d.getUTCFullYear()}-${String(
    d.getUTCMonth() + 1
  ).padStart(2, '0')}`;
};

const getMonthLabel = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
};

const getGraphMonths = (req) => {
  const months = Number(req.query.months || 6);

  return ALLOWED_GRAPH_MONTHS.includes(months) ? months : null;
};

const getPagination = (req) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(req.query.limit || 10))
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const sendError = (res, error, message = 'Something went wrong') => {
  console.error(message, error);

  return res.status(500).json({
    success: false,
    message,
    error: error.message,
  });
};

const findAsset = (portfolio, assetId) => {
  return portfolio.assets.find(
    (asset) => String(asset.assetId) === String(assetId)
  );
};

const getAssetInvestedAmount = (asset) => {
  const history = asset.investmentHistory || [];

  if (history.length > 0) {
    return history.reduce((sum, item) => {
      return item.status === 'Disbursed'
        ? sum + numberValue(item.amount)
        : sum;
    }, 0);
  }

  return (asset.investmentFlow || []).reduce((sum, item) => {
    const disbursed =
      item.isInvestmentDisbursed === true ||
      String(item.investmentStatus || '').toLowerCase() ===
        'disbursed';

    return disbursed
      ? sum + numberValue(item.investedAmount)
      : sum;
  }, 0);
};

const getAssetReturnedAmount = (asset) => {
  return (asset.returnSettlements || []).reduce((sum, item) => {
    const status = String(item.status || '').toLowerCase();

    return ['settled', 'credited'].includes(status)
      ? sum + numberValue(item.amount)
      : sum;
  }, 0);
};

const getAssetLastReturnDate = (asset) => {
  const completed = (asset.returnSettlements || [])
    .filter((item) =>
      ['settled', 'credited'].includes(
        String(item.status || '').toLowerCase()
      )
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return completed.length ? completed[0].date : null;
};

const syncAssetSummary = (asset) => {
  asset.assetSummary = asset.assetSummary || {};

  asset.assetSummary.investedAmount =
    getAssetInvestedAmount(asset);

  asset.assetSummary.totalReturnedAmount =
    getAssetReturnedAmount(asset);

  asset.assetSummary.lastReturnDate =
    getAssetLastReturnDate(asset);

  if (asset.nextReinvestment) {
    asset.assetSummary.nextReturnDate =
      asset.nextReinvestment.date || null;

    asset.assetSummary.nextReturnAmount =
      numberValue(asset.nextReinvestment.amount);
  }

  return asset;
};

const recalculatePortfolio = (portfolio) => {
  let totalInvested = 0;
  let totalReturned = 0;
  let activeAssets = 0;

  for (const asset of portfolio.assets) {
    syncAssetSummary(asset);

    totalInvested += getAssetInvestedAmount(asset);
    totalReturned += getAssetReturnedAmount(asset);

    if (asset.status === 'Active') {
      activeAssets++;
    }
  }

  portfolio.deployedCapital = {
    totalInvested,
    totalReturned,
    totalAssets: portfolio.assets.length,
    activeAssets,
  };
};

const buildGraph = (assets, months) => {
  const now = new Date();

  const currentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const monthlyData = new Map();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(currentMonth);
    date.setUTCMonth(date.getUTCMonth() - i);

    const key = getMonthKey(date);

    monthlyData.set(key, {
      date,
      month: key,
      shortMonthLabel: getMonthLabel(date),
      investedAmount: 0,
      monthlyReturn: 0,
    });
  }

  for (const asset of assets) {
    const investmentHistory = asset.investmentHistory || [];

    const investmentRecords =
      investmentHistory.length > 0
        ? investmentHistory
            .filter((item) => item.status === 'Disbursed')
            .map((item) => ({
              date: item.date,
              amount: item.amount,
            }))
        : (asset.investmentFlow || [])
            .filter((item) => {
              return (
                item.isInvestmentDisbursed === true ||
                String(item.investmentStatus || '').toLowerCase() ===
                  'disbursed'
              );
            })
            .map((item) => ({
              date:
                item.disbursedAt ||
                item.investmentDate ||
                item.createdAt,
              amount: item.investedAmount,
            }));

    for (const item of investmentRecords) {
      if (!item.date) continue;

      const key = getMonthKey(item.date);
      const month = monthlyData.get(key);

      if (month) {
        month.investedAmount += numberValue(item.amount);
      }
    }

    for (const settlement of asset.returnSettlements || []) {
      const status = String(
        settlement.status || ''
      ).toLowerCase();

      if (!['settled', 'credited'].includes(status)) {
        continue;
      }

      if (!settlement.date) continue;

      const key = getMonthKey(settlement.date);
      const month = monthlyData.get(key);

      if (month) {
        month.monthlyReturn += numberValue(settlement.amount);
      }
    }
  }

  return Array.from(monthlyData.values()).map((item) => ({
    ...item,
    date: item.date.toISOString(),
  }));
};

const getAssetResponse = (asset) => {
  syncAssetSummary(asset);

  return {
    ...asset.toObject(),
    calculated: {
      investedAmount: getAssetInvestedAmount(asset),
      totalReturnedAmount: getAssetReturnedAmount(asset),
      lastReturnDate: getAssetLastReturnDate(asset),
    },
  };
};

const getInvestorPortfolio = async (investorId) => {
  return Portfolio.findOne({
    investorId: toObjectId(investorId),
  });
};

const getAdminPortfolioQuery = (req) => {
  const query = {};

  if (req.query.investorId) {
    if (!isValidObjectId(req.query.investorId)) {
      return null;
    }

    query.investorId = toObjectId(req.query.investorId);
  }

  return query;
};

// --------------------------------------------------
// Investor: Portfolio Overview
// GET /portfolio/overview
// --------------------------------------------------

exports.getPortfolioOverview = async (req, res) => {
  try {
    const investorId = getInvestorId(req);

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    const { page, limit, skip } = getPagination(req);

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(200).json({
        success: true,
        message: 'Portfolio not found',
        deployedCapital: {
          totalInvested: 0,
          totalReturned: 0,
          totalAssets: 0,
          activeAssets: 0,
        },
        assets: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
        },
      });
    }

    recalculatePortfolio(portfolio);
    await portfolio.save();

    const allAssets = portfolio.assets || [];

    const assets = allAssets
      .slice(skip, skip + limit)
      .map(getAssetResponse);

    return res.status(200).json({
      success: true,
      deployedCapital: portfolio.deployedCapital,
      assets,
      pagination: {
        page,
        limit,
        total: allAssets.length,
        totalPages: Math.ceil(allAssets.length / limit),
        hasNextPage: skip + limit < allAssets.length,
      },
    });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch portfolio overview');
  }
};

// --------------------------------------------------
// Investor: Overall Portfolio Graph
// GET /portfolio/graph?months=6
// GET /portfolio/graph?months=12
// --------------------------------------------------

exports.getPortfolioGraph = async (req, res) => {
  try {
    const investorId = getInvestorId(req);
    const months = getGraphMonths(req);

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    if (!months) {
      return res.status(400).json({
        success: false,
        message: 'months must be either 6 or 12',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    const graph = buildGraph(
      portfolio?.assets || [],
      months
    );

    return res.status(200).json({
      success: true,
      scope: 'portfolio',
      months,
      graph,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch portfolio graph');
  }
};

// --------------------------------------------------
// Investor: Buy Portfolio Product
// POST /portfolio/buy
// --------------------------------------------------

exports.buyPortfolioProduct = async (req, res) => {
  try {
    const investorId = getInvestorId(req);

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    const body = req.body || {};

    const product =
      body.productJson ||
      body.product ||
      {};

    const productId =
      body.productId ||
      product._id ||
      product.productId ||
      null;

    const amount = numberValue(
      body.investmentAmount ??
        body.investedAmount ??
        body.amount ??
        body.purchaseAmount
    );

    const units = Math.max(1, numberValue(body.units, 1));

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid investment amount is required',
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid productId',
      });
    }

    const purchaseDate = body.purchaseDate
      ? new Date(body.purchaseDate)
      : new Date();

    if (Number.isNaN(purchaseDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchaseDate',
      });
    }

    const nextReinvestmentDate = body.nextReinvestmentDate
      ? new Date(body.nextReinvestmentDate)
      : addMonths(purchaseDate, 8);

    const assetId =
      body.assetId ||
      new mongoose.Types.ObjectId().toString();

    const asset = {
      assetId,
      productId: productId || null,
      product,
      productName:
        body.productName ||
        product.name ||
        product.productName ||
        '',
      productImage:
        body.productImage ||
        product.image ||
        product.productImage ||
        '',
      category: body.category || product.category || '',
      busNumber: body.busNumber || '',
      units,

      investmentHistory: [
        {
          date: purchaseDate,
          amount,
          status: 'Disbursed',
          referenceId: body.referenceId || '',
          note: body.note || 'Initial investment',
        },
      ],

      investmentFlow: [],
      returnSettlements: [],
      monthlyReturnHistory: [],

      nextReinvestment: {
        date: nextReinvestmentDate,
        amount: numberValue(
          body.nextReinvestmentAmount ??
            body.monthlyReturn ??
            body.amount
        ),
        status: 'Planned',
        note: 'Default reinvestment plan',
        updatedAt: new Date(),
      },

      assetSummary: {
        investedAmount: amount,
        purchaseDate,
        monthlyReturn: numberValue(body.monthlyReturn),
        totalReturnedAmount: 0,
        lastReturnDate: null,
        nextReturnAmount: numberValue(
          body.nextReinvestmentAmount ??
            body.monthlyReturn ??
            body.amount
        ),
        nextReturnDate: nextReinvestmentDate,
      },

      renewal: [],
      assetGraph: { points: [] },
      status: 'Active',
      notes: body.notes || '',
    };

    let portfolio = await Portfolio.findOne({
      investorId: toObjectId(investorId),
    });

    if (!portfolio) {
      portfolio = new Portfolio({
        investorId: toObjectId(investorId),
        investorName: body.investorName || '',
        investorEmail: body.investorEmail || '',
        assets: [],
      });
    }

    portfolio.assets.push(asset);

    recalculatePortfolio(portfolio);
    await portfolio.save();

    const createdAsset = findAsset(portfolio, assetId);

    return res.status(201).json({
      success: true,
      message: 'Investment added successfully',
      asset: createdAsset,
      deployedCapital: portfolio.deployedCapital,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to buy portfolio product');
  }
};

// --------------------------------------------------
// Investor: Particular Asset Detail
// GET /portfolio/assets/:assetId
// --------------------------------------------------

exports.getAssetDetail = async (req, res) => {
  try {
    const investorId = getInvestorId(req);
    const { assetId } = req.params;

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found',
      });
    }

    const asset = findAsset(portfolio, assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    return res.status(200).json({
      success: true,
      asset: getAssetResponse(asset),
    });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch asset detail');
  }
};

// --------------------------------------------------
// Investor: Particular Asset Graph
// GET /portfolio/assets/:assetId/graph?months=6
// GET /portfolio/assets/:assetId/graph?months=12
// --------------------------------------------------

exports.getAssetGraph = async (req, res) => {
  try {
    const investorId = getInvestorId(req);
    const { assetId } = req.params;
    const months = getGraphMonths(req);

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    if (!months) {
      return res.status(400).json({
        success: false,
        message: 'months must be either 6 or 12',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found',
      });
    }

    const asset = findAsset(portfolio, assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    const graph = buildGraph([asset], months);

    return res.status(200).json({
      success: true,
      scope: 'asset',
      assetId,
      months,
      graph,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch asset graph');
  }
};

// --------------------------------------------------
// Investor: Renew / Reinvest Asset
// POST /portfolio/assets/:assetId/renew
// --------------------------------------------------

exports.renewAsset = async (req, res) => {
  try {
    const investorId = getInvestorId(req);
    const { assetId } = req.params;

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found',
      });
    }

    const asset = findAsset(portfolio, assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    const reinvestAmount = numberValue(
      req.body.reinvestAmount ??
        req.body.amount
    );

    const reinvestDate = req.body.reinvestmentDate
      ? new Date(req.body.reinvestmentDate)
      : new Date();

    if (Number.isNaN(reinvestDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reinvestmentDate',
      });
    }

    if (reinvestAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid reinvestAmount is required',
      });
    }

    const referenceId = req.body.referenceId || '';

    asset.investmentHistory.push({
      date: reinvestDate,
      amount: reinvestAmount,
      status: 'Disbursed',
      referenceId,
      note: req.body.note || 'Asset reinvestment',
    });

    asset.renewal.push({
      date: reinvestDate,
      amount: reinvestAmount,
      referenceId,
      note: req.body.note || 'Asset renewed',
    });

    asset.nextReinvestment = {
      date: req.body.nextReinvestmentDate
        ? new Date(req.body.nextReinvestmentDate)
        : addMonths(reinvestDate, 8),

      amount: numberValue(
        req.body.nextReinvestmentAmount ??
          asset.nextReinvestment?.amount
      ),

      status: 'Planned',
      note: 'Next reinvestment after renewal',
      updatedAt: new Date(),
    };

    syncAssetSummary(asset);
    recalculatePortfolio(portfolio);

    await portfolio.save();

    return res.status(200).json({
      success: true,
      message: 'Asset reinvested successfully',
      asset: getAssetResponse(asset),
      deployedCapital: portfolio.deployedCapital,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to renew asset');
  }
};

// --------------------------------------------------
// Investor: Upcoming Reinvestments
// GET /portfolio/next-payment
// --------------------------------------------------

exports.getInvestorNextPayments = async (req, res) => {
  try {
    const investorId = getInvestorId(req);

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(200).json({
        success: true,
        nextReinvestments: [],
        total: 0,
      });
    }

    const today = new Date();
    const nextReinvestments = [];

    for (const asset of portfolio.assets) {
      const next = asset.nextReinvestment;

      if (
        !next ||
        !next.date ||
        ['Completed', 'Cancelled'].includes(next.status)
      ) {
        continue;
      }

      if (
        next.status === 'Planned' &&
        new Date(next.date) < today
      ) {
        next.status = 'Overdue';
      }

      nextReinvestments.push({
        assetId: asset.assetId,
        productName: asset.productName,
        productImage: asset.productImage,
        nextReinvestment: next,
      });
    }

    nextReinvestments.sort(
      (a, b) =>
        new Date(a.nextReinvestment.date) -
        new Date(b.nextReinvestment.date)
    );

    await portfolio.save();

    return res.status(200).json({
      success: true,
      total: nextReinvestments.length,
      nextReinvestments,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to fetch next reinvestments'
    );
  }
};

// --------------------------------------------------
// Investor: Return History
// GET /portfolio/return-history
// --------------------------------------------------

exports.getInvestorReturnHistory = async (req, res) => {
  try {
    const investorId = getInvestorId(req);

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(200).json({
        success: true,
        total: 0,
        returnHistory: [],
      });
    }

    const returnHistory = [];

    for (const asset of portfolio.assets) {
      for (const settlement of asset.returnSettlements || []) {
        returnHistory.push({
          assetId: asset.assetId,
          productName: asset.productName,
          productImage: asset.productImage,
          ...settlement.toObject(),
        });
      }
    }

    returnHistory.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const { page, limit, skip } = getPagination(req);

    return res.status(200).json({
      success: true,
      total: returnHistory.length,
      returnHistory: returnHistory.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total: returnHistory.length,
        totalPages: Math.ceil(returnHistory.length / limit),
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to fetch return history'
    );
  }
};

// --------------------------------------------------
// Investor: Combined Investment & Return History
// GET /portfolio/history?months=6
// GET /portfolio/history?months=12
// --------------------------------------------------

exports.getInvestorPortfolioHistory = async (req, res) => {
  try {
    const investorId = getInvestorId(req);
    const months = getGraphMonths(req);

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    if (!months) {
      return res.status(400).json({
        success: false,
        message: 'months must be either 6 or 12',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(200).json({
        success: true,
        months,
        investmentHistory: [],
        returnHistory: [],
        summary: {
          totalInvestments: 0,
          totalInvestmentAmount: 0,
          totalReturns: 0,
          totalReturnAmount: 0,
        },
      });
    }

    const now = new Date();

    const startDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - months + 1,
        1
      )
    );

    const endDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        1
      )
    );

    const isWithinRange = (date) => {
      if (!date) return false;

      const value = new Date(date);

      return (
        !Number.isNaN(value.getTime()) &&
        value >= startDate &&
        value < endDate
      );
    };

    const investmentHistory = [];
    const returnHistory = [];

    let totalInvestmentAmount = 0;
    let totalReturnAmount = 0;

    for (const asset of portfolio.assets || []) {
      // ------------------------------------------
      // Investment History
      // ------------------------------------------

      const history = asset.investmentHistory || [];

      const investmentRecords =
        history.length > 0
          ? history
          : (asset.investmentFlow || []).map((item) => ({
              date:
                item.disbursedAt ||
                item.investmentDate ||
                item.createdAt,
              amount: item.investedAmount,
              status: item.investmentStatus || 'Disbursed',
              referenceId: item.referenceId || '',
              note: 'Legacy investment record',
            }));

      for (const investment of investmentRecords) {
        if (!isWithinRange(investment.date)) continue;

        const amount = numberValue(investment.amount);
        const status = investment.status || 'Disbursed';

        investmentHistory.push({
          assetId: asset.assetId,
          productId: asset.productId,
          productName: asset.productName,
          productImage: asset.productImage,

          investmentId: investment.investmentId || null,
          date: investment.date,
          amount,
          status,
          referenceId: investment.referenceId || '',
          note: investment.note || '',
        });

        if (status === 'Disbursed') {
          totalInvestmentAmount += amount;
        }
      }

      // ------------------------------------------
      // Monthly Return Obligations
      // ------------------------------------------

      for (const monthlyReturn of asset.monthlyReturnHistory || []) {
        if (!isWithinRange(monthlyReturn.dueDate)) continue;

        const expectedAmount = numberValue(
          monthlyReturn.expectedAmount
        );

        const paidAmount = numberValue(
          monthlyReturn.paidAmount
        );

        returnHistory.push({
          type: 'MonthlyReturn',
          assetId: asset.assetId,
          productId: asset.productId,
          productName: asset.productName,
          productImage: asset.productImage,

          monthKey: monthlyReturn.monthKey,
          dueDate: monthlyReturn.dueDate,

          expectedAmount,
          paidAmount,
          pendingAmount: Math.max(
            0,
            expectedAmount - paidAmount
          ),

          status: monthlyReturn.status || 'Upcoming',
          paidAt: monthlyReturn.paidAt || null,
          transactionId: monthlyReturn.transactionId || '',
          referenceId: monthlyReturn.referenceId || '',
          note: monthlyReturn.note || '',
        });
      }

      // ------------------------------------------
      // Actual Return Settlements
      // ------------------------------------------

      for (const settlement of asset.returnSettlements || []) {
        if (!isWithinRange(settlement.date)) continue;

        const amount = numberValue(settlement.amount);
        const status = settlement.status || 'Pending';

        returnHistory.push({
          type: 'Settlement',
          assetId: asset.assetId,
          productId: asset.productId,
          productName: asset.productName,
          productImage: asset.productImage,

          settlementId: settlement.settlementId || null,
          date: settlement.date,
          amount,
          status,
          referenceId: settlement.referenceId || '',
          note: settlement.note || '',
        });

        if (['Settled', 'Credited'].includes(status)) {
          totalReturnAmount += amount;
        }
      }
    }

    investmentHistory.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    returnHistory.sort((a, b) => {
      const dateA = a.dueDate || a.date;
      const dateB = b.dueDate || b.date;

      return new Date(dateB) - new Date(dateA);
    });

    return res.status(200).json({
      success: true,
      months,

      dateRange: {
        from: startDate.toISOString(),
        to: new Date(endDate.getTime() - 1).toISOString(),
      },

      investmentHistory,
      returnHistory,

      summary: {
        totalInvestments: investmentHistory.length,
        totalInvestmentAmount,
        totalReturns: returnHistory.length,
        totalReturnAmount,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to fetch combined portfolio history'
    );
  }
};

// --------------------------------------------------
// Admin: Overall Portfolio Overview
// GET /portfolio/admin/overview
// --------------------------------------------------

exports.getAdminPortfolioOverview = async (req, res) => {
  try {
    const query = getAdminPortfolioQuery(req);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investorId',
      });
    }

    const portfolios = await Portfolio.find(query);

    let totalInvested = 0;
    let totalReturned = 0;
    let totalAssets = 0;
    let activeAssets = 0;

    for (const portfolio of portfolios) {
      for (const asset of portfolio.assets) {
        totalInvested += getAssetInvestedAmount(asset);
        totalReturned += getAssetReturnedAmount(asset);
        totalAssets++;

        if (asset.status === 'Active') {
          activeAssets++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      summary: {
        totalInvested,
        totalReturned,
        totalAssets,
        activeAssets,
        totalInvestors: portfolios.length,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to fetch admin portfolio overview'
    );
  }
};

// --------------------------------------------------
// Admin: Portfolio Records
// GET /portfolio/admin/records
// --------------------------------------------------

exports.getAdminPortfolioRecords = async (req, res) => {
  try {
    const query = getAdminPortfolioQuery(req);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investorId',
      });
    }

    const { page, limit, skip } = getPagination(req);

    const portfolios = await Portfolio.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    const allRecords = [];

    for (const portfolio of portfolios) {
      for (const asset of portfolio.assets || []) {
        allRecords.push({
          investorId: portfolio.investorId,
          investorName: portfolio.investorName,
          investorEmail: portfolio.investorEmail,
          asset,
        });
      }
    }

    allRecords.sort(
      (a, b) =>
        new Date(b.asset.createdAt || 0) -
        new Date(a.asset.createdAt || 0)
    );

    return res.status(200).json({
      success: true,
      total: allRecords.length,
      records: allRecords.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total: allRecords.length,
        totalPages: Math.ceil(allRecords.length / limit),
        hasNextPage: skip + limit < allRecords.length,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to fetch admin portfolio records'
    );
  }
};

// --------------------------------------------------
// Admin: Portfolio Graph
// GET /portfolio/admin/graph?months=6
// GET /portfolio/admin/graph?months=12
// --------------------------------------------------

exports.getAdminPortfolioGraph = async (req, res) => {
  try {
    const months = getGraphMonths(req);

    if (!months) {
      return res.status(400).json({
        success: false,
        message: 'months must be either 6 or 12',
      });
    }

    const query = getAdminPortfolioQuery(req);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investorId',
      });
    }

    const portfolios = await Portfolio.find(query);

    let assets = portfolios.flatMap((portfolio) => portfolio.assets);

    if (req.query.assetId) {
      assets = assets.filter(
        (asset) =>
          String(asset.assetId) === String(req.query.assetId)
      );
    }

    return res.status(200).json({
      success: true,
      scope: req.query.assetId
        ? 'asset'
        : req.query.investorId
        ? 'investor'
        : 'all-portfolios',
      months,
      graph: buildGraph(assets, months),
    });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch admin graph');
  }
};

// --------------------------------------------------
// Admin: Investment History
// GET /portfolio/admin/investments
// --------------------------------------------------

exports.getAdminInvestmentHistory = async (req, res) => {
  try {
    const query = getAdminPortfolioQuery(req);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investorId',
      });
    }

    const portfolios = await Portfolio.find(query).lean();

    const records = [];

    for (const portfolio of portfolios) {
      for (const asset of portfolio.assets || []) {
        const history = asset.investmentHistory || [];

        const source =
          history.length > 0
            ? history
            : (asset.investmentFlow || []).map((item) => ({
                date:
                  item.disbursedAt ||
                  item.investmentDate ||
                  item.createdAt,
                amount: item.investedAmount,
                status: item.investmentStatus || 'Disbursed',
                referenceId: item.referenceId || '',
              }));

        for (const investment of source) {
          records.push({
            investorId: portfolio.investorId,
            investorName: portfolio.investorName,
            assetId: asset.assetId,
            productName: asset.productName,
            ...investment,
          });
        }
      }
    }

    records.sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );

    const { page, limit, skip } = getPagination(req);

    return res.status(200).json({
      success: true,
      total: records.length,
      investments: records.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total: records.length,
        totalPages: Math.ceil(records.length / limit),
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to fetch investment history'
    );
  }
};

// --------------------------------------------------
// Admin: Add Investment
// POST /portfolio/admin/investments
// --------------------------------------------------

exports.addAdminInvestment = async (req, res) => {
  try {
    const {
      investorId,
      assetId,
      amount,
      date,
      referenceId,
      note,
      status,
    } = req.body || {};

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'assetId is required',
      });
    }

    const investmentAmount = numberValue(amount);

    if (investmentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found',
      });
    }

    const asset = findAsset(portfolio, assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    const investmentDate = date ? new Date(date) : new Date();

    if (Number.isNaN(investmentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investment date',
      });
    }

    const investmentStatus = status || 'Disbursed';

    if (
      !['Disbursed', 'Pending', 'Failed'].includes(
        investmentStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investment status',
      });
    }

    asset.investmentHistory.push({
      date: investmentDate,
      amount: investmentAmount,
      status: investmentStatus,
      referenceId: referenceId || '',
      note: note || 'Admin added investment',
      createdBy: req.user?._id || null,
    });

    if (investmentStatus === 'Disbursed') {
      asset.nextReinvestment = {
        date: addMonths(investmentDate, 8),
        amount: numberValue(asset.nextReinvestment?.amount),
        status: 'Planned',
        note: 'Next reinvestment after admin investment',
        updatedBy: req.user?._id || null,
        updatedAt: new Date(),
      };
    }

    recalculatePortfolio(portfolio);
    await portfolio.save();

    return res.status(201).json({
      success: true,
      message: 'Investment added successfully',
      asset: getAssetResponse(asset),
      deployedCapital: portfolio.deployedCapital,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to add admin investment');
  }
};

// --------------------------------------------------
// Admin: Return Settlements
// GET /portfolio/admin/settlements
// --------------------------------------------------

exports.getAdminReturnSettlements = async (req, res) => {
  try {
    const query = getAdminPortfolioQuery(req);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investorId',
      });
    }

    const portfolios = await Portfolio.find(query).lean();

    const settlements = [];

    for (const portfolio of portfolios) {
      for (const asset of portfolio.assets || []) {
        for (const settlement of asset.returnSettlements || []) {
          settlements.push({
            investorId: portfolio.investorId,
            investorName: portfolio.investorName,
            assetId: asset.assetId,
            productName: asset.productName,
            ...settlement,
          });
        }
      }
    }

    settlements.sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );

    const { page, limit, skip } = getPagination(req);

    return res.status(200).json({
      success: true,
      total: settlements.length,
      settlements: settlements.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total: settlements.length,
        totalPages: Math.ceil(settlements.length / limit),
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to fetch return settlements'
    );
  }
};

// --------------------------------------------------
// Admin: Add Return Settlement
// POST /portfolio/admin/settlements
// --------------------------------------------------

exports.settleAdminReturnProfit = async (req, res) => {
  try {
    const {
      investorId,
      assetId,
      amount,
      date,
      status,
      referenceId,
      note,
      nextReinvestmentDate,
      nextReinvestmentAmount,
    } = req.body || {};

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'assetId is required',
      });
    }

    const settlementAmount = numberValue(amount);

    if (settlementAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid settlement amount is required',
      });
    }

    const settlementStatus = status || 'Settled';

    if (
      !['Settled', 'Credited', 'Pending'].includes(
        settlementStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settlement status',
      });
    }

    const settlementDate = date ? new Date(date) : new Date();

    if (Number.isNaN(settlementDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settlement date',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found',
      });
    }

    const asset = findAsset(portfolio, assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    asset.returnSettlements.push({
      date: settlementDate,
      amount: settlementAmount,
      status: settlementStatus,
      referenceId: referenceId || '',
      note: note || 'Admin return settlement',
      settledBy: req.user?._id || null,
    });

    if (['Settled', 'Credited'].includes(settlementStatus)) {
      const nextDate = nextReinvestmentDate
        ? new Date(nextReinvestmentDate)
        : addMonths(settlementDate, 8);

      if (Number.isNaN(nextDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid nextReinvestmentDate',
        });
      }

      asset.nextReinvestment = {
        date: nextDate,
        amount:
          nextReinvestmentAmount !== undefined
            ? numberValue(nextReinvestmentAmount)
            : numberValue(asset.nextReinvestment?.amount),
        status: 'Planned',
        note: 'Next reinvestment after return settlement',
        updatedBy: req.user?._id || null,
        updatedAt: new Date(),
      };
    }

    recalculatePortfolio(portfolio);
    await portfolio.save();

    return res.status(201).json({
      success: true,
      message: 'Return settlement added successfully',
      asset: getAssetResponse(asset),
      deployedCapital: portfolio.deployedCapital,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to add return settlement'
    );
  }
};

// --------------------------------------------------
// Admin: Update Next Reinvestment
// PUT /portfolio/admin/next-payment
// --------------------------------------------------

exports.updateAdminNextPayment = async (req, res) => {
  try {
    const {
      investorId,
      assetId,
      date,
      amount,
      status,
      note,
    } = req.body || {};

    if (!investorId || !isValidObjectId(investorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid investorId is required',
      });
    }

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'assetId is required',
      });
    }

    const portfolio = await getInvestorPortfolio(investorId);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found',
      });
    }

    const asset = findAsset(portfolio, assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    const allowedStatuses = [
      'Planned',
      'Overdue',
      'Completed',
      'Cancelled',
    ];

    const nextStatus = status || 'Planned';

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid next reinvestment status',
      });
    }

    let nextDate = asset.nextReinvestment?.date || null;

    if (date !== undefined) {
      nextDate = date ? new Date(date) : null;

      if (nextDate && Number.isNaN(nextDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reinvestment date',
        });
      }
    }

    const nextAmount =
      amount !== undefined
        ? numberValue(amount)
        : numberValue(asset.nextReinvestment?.amount);

    if (nextAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount cannot be negative',
      });
    }

    asset.nextReinvestment = {
      date: nextDate,
      amount: nextAmount,
      status: nextStatus,
      note: note || '',
      updatedBy: req.user?._id || null,
      updatedAt: new Date(),
    };

    syncAssetSummary(asset);
    recalculatePortfolio(portfolio);

    await portfolio.save();

    return res.status(200).json({
      success: true,
      message: 'Next reinvestment updated successfully',
      asset: getAssetResponse(asset),
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Failed to update next reinvestment'
    );
  }
};
