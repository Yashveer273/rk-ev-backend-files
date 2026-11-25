
const mongoose = require('mongoose');

const { Schema } = mongoose;

// --------------------------------------------------
// Investment History
// --------------------------------------------------

const investmentHistorySchema = new Schema(
  {
    investmentId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    date: {
      type: Date,
      default: Date.now,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ['Disbursed', 'Pending', 'Failed'],
      default: 'Disbursed',
    },

    referenceId: {
      type: String,
      default: '',
    },

    note: {
      type: String,
      default: '',
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// --------------------------------------------------
// Legacy Investment Flow
// --------------------------------------------------

const investmentFlowSchema = new Schema(
  {
    referenceId: {
      type: String,
      default: '',
    },

    investmentDate: {
      type: Date,
      default: null,
    },

    disbursedAt: {
      type: Date,
      default: null,
    },

    investedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    investmentStatus: {
      type: String,
      default: 'Disbursed',
    },

    isInvestmentDisbursed: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// --------------------------------------------------
// Return Settlement History
// --------------------------------------------------

const returnSettlementSchema = new Schema(
  {
    settlementId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    date: {
      type: Date,
      default: Date.now,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ['Settled', 'Credited', 'Pending'],
      default: 'Pending',
    },

    referenceId: {
      type: String,
      default: '',
    },

    note: {
      type: String,
      default: '',
    },

    settledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// --------------------------------------------------
// Monthly Return History
// Maximum 3 calendar months per asset.
// --------------------------------------------------

const monthlyReturnHistorySchema = new Schema(
  {
    monthKey: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    expectedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        'Upcoming',
        'Pending',
        'Overdue',
        'Partial',
        'Paid',
        'Failed',
      ],
      default: 'Upcoming',
    },

    paidAt: {
      type: Date,
      default: null,
    },

    transactionId: {
      type: String,
      default: '',
    },

    referenceId: {
      type: String,
      default: '',
    },

    note: {
      type: String,
      default: '',
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// --------------------------------------------------
// Next Reinvestment
// No fixed investment duration or installment plan.
// --------------------------------------------------

const nextReinvestmentSchema = new Schema(
  {
    date: {
      type: Date,
      default: null,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        'Planned',
        'Overdue',
        'Completed',
        'Cancelled',
      ],
      default: 'Planned',
    },

    note: {
      type: String,
      default: '',
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// --------------------------------------------------
// Asset Summary
// --------------------------------------------------

const assetSummarySchema = new Schema(
  {
    investedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    purchaseDate: {
      type: Date,
      default: null,
    },

    monthlyReturn: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalReturnedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastReturnDate: {
      type: Date,
      default: null,
    },

    // Legacy compatibility fields.
    // These mirror nextReinvestment.
    nextReturnAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    nextReturnDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// --------------------------------------------------
// Renewal History
// --------------------------------------------------

const renewalSchema = new Schema(
  {
    renewalId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    date: {
      type: Date,
      default: Date.now,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    note: {
      type: String,
      default: '',
    },

    referenceId: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// --------------------------------------------------
// Graph Point
// Legacy optional data only.
// --------------------------------------------------

const graphPointSchema = new Schema(
  {
    date: {
      type: Date,
      default: null,
    },

    investedAmount: {
      type: Number,
      default: 0,
    },

    monthlyReturn: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

// --------------------------------------------------
// Portfolio Asset
// --------------------------------------------------

const portfolioAssetSchema = new Schema(
  {
    assetId: {
      type: String,
      required: true,
    },

    productId: {
      type: String,
      ref: 'EVProduct',
      default: null,
    },

    product: {
      type: Schema.Types.Mixed,
      default: {},
    },

    productName: {
      type: String,
      default: '',
    },

    productImage: {
      type: String,
      default: '',
    },

    category: {
      type: String,
      default: '',
    },

    busNumber: {
      type: String,
      default: '',
    },

    units: {
      type: Number,
      default: 1,
      min: 1,
    },

    investmentHistory: {
      type: [investmentHistorySchema],
      default: [],
    },

    // Old records compatibility.
    investmentFlow: {
      type: [investmentFlowSchema],
      default: [],
    },

    returnSettlements: {
      type: [returnSettlementSchema],
      default: [],
    },

    // Monthly expected and received return records.
    monthlyReturnHistory: {
      type: [monthlyReturnHistorySchema],
      default: [],
    },

    nextReinvestment: {
      type: nextReinvestmentSchema,
      default: () => ({}),
    },

    assetSummary: {
      type: assetSummarySchema,
      default: () => ({}),
    },

    renewal: {
      type: [renewalSchema],
      default: [],
    },

    assetGraph: {
      points: {
        type: [graphPointSchema],
        default: [],
      },
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Completed'],
      default: 'Active',
    },

    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// --------------------------------------------------
// Main Portfolio Schema
// One portfolio document per investor.
// --------------------------------------------------

const portfolioSchema = new Schema(
  {
    investorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    investorName: {
      type: String,
      default: '',
    },

    investorEmail: {
      type: String,
      default: '',
    },

    assets: {
      type: [portfolioAssetSchema],
      default: [],
    },

    deployedCapital: {
      totalInvested: {
        type: Number,
        default: 0,
      },

      totalReturned: {
        type: Number,
        default: 0,
      },

      totalAssets: {
        type: Number,
        default: 0,
      },

      activeAssets: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

// --------------------------------------------------
// Recalculate portfolio totals before saving.
// --------------------------------------------------

portfolioSchema.pre('save', function (next) {
  let totalInvested = 0;
  let totalReturned = 0;
  let activeAssets = 0;

  const now = new Date();

  const currentMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const threeMonthStart = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 2,
    1
  );

  for (const asset of this.assets) {
    // Keep only current month and previous two months.
    asset.monthlyReturnHistory = (
      asset.monthlyReturnHistory || []
    )
      .filter((item) => {
        if (!item.dueDate) return false;

        const dueDate = new Date(item.dueDate);

        return dueDate >= threeMonthStart;
      })
      .sort((a, b) => {
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

    const history = asset.investmentHistory || [];

    // New history is the source of truth.
    // Legacy flow is used only when new history is empty.
    if (history.length > 0) {
      totalInvested += history.reduce((sum, item) => {
        return item.status === 'Disbursed'
          ? sum + Number(item.amount || 0)
          : sum;
      }, 0);
    } else {
      totalInvested += (asset.investmentFlow || []).reduce(
        (sum, item) => {
          const isDisbursed =
            item.isInvestmentDisbursed === true ||
            String(item.investmentStatus || '').toLowerCase() ===
              'disbursed';

          return isDisbursed
            ? sum + Number(item.investedAmount || 0)
            : sum;
        },
        0
      );
    }

    const settlements = asset.returnSettlements || [];

    const actualReturned = settlements.reduce((sum, item) => {
      const status = String(item.status || '').toLowerCase();

      return ['settled', 'credited'].includes(status)
        ? sum + Number(item.amount || 0)
        : sum;
    }, 0);

    totalReturned += actualReturned;

    asset.assetSummary = asset.assetSummary || {};

    asset.assetSummary.investedAmount = totalInvestedForAsset(
      asset
    );

    asset.assetSummary.totalReturnedAmount = actualReturned;

    const completedSettlements = settlements
      .filter((item) =>
        ['settled', 'credited'].includes(
          String(item.status || '').toLowerCase()
        )
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    asset.assetSummary.lastReturnDate =
      completedSettlements.length > 0
        ? completedSettlements[0].date
        : null;

    if (asset.nextReinvestment) {
      asset.assetSummary.nextReturnDate =
        asset.nextReinvestment.date || null;

      asset.assetSummary.nextReturnAmount =
        Number(asset.nextReinvestment.amount || 0);
    }

    if (asset.status === 'Active') {
      activeAssets++;
    }
  }

  this.deployedCapital = {
    totalInvested,
    totalReturned,
    totalAssets: this.assets.length,
    activeAssets,
  };

  next();
});

// --------------------------------------------------
// Helper: Calculate invested amount for one asset.
// --------------------------------------------------

function totalInvestedForAsset(asset) {
  const history = asset.investmentHistory || [];

  if (history.length > 0) {
    return history.reduce((sum, item) => {
      return item.status === 'Disbursed'
        ? sum + Number(item.amount || 0)
        : sum;
    }, 0);
  }

  return (asset.investmentFlow || []).reduce((sum, item) => {
    const isDisbursed =
      item.isInvestmentDisbursed === true ||
      String(item.investmentStatus || '').toLowerCase() ===
        'disbursed';

    return isDisbursed
      ? sum + Number(item.investedAmount || 0)
      : sum;
  }, 0);
}

module.exports = mongoose.model('Portfolio', portfolioSchema);
