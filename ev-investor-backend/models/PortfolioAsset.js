const mongoose = require('mongoose');

const graphPointSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true }, // YYYY-MM-DD
    investedAmount: { type: Number, required: true, default: 0 },
    monthlyReturn: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const assetSummarySchema = new mongoose.Schema(
  {
    investedAmount: { type: Number, required: true, default: 0 },
    purchaseDate: { type: String, required: true, trim: true },
    monthlyReturn: { type: Number, required: true, default: 0 },
    nextReturnAmount: { type: Number, required: true, default: 0 },
    nextReturnDate: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const assetRenewalSchema = new mongoose.Schema(
  {
    tenureMonths: { type: Number, required: true, default: 36 },
    completedMonths: { type: Number, required: true, default: 0 },
    remainingMonths: { type: Number, required: true, default: 36 },
    isRenewable: { type: Boolean, default: true },
    renewalBonusPercent: { type: Number, default: 2 },
    renewedDate: { type: String, default: null },
  },
  { _id: false }
);

const productSpecsSchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    vehicleType: { type: String, default: '2-Wheeler' },
    vehicleNoPlate: { type: String, default: '' },
    companyName: { type: String, default: 'EV' },
    purchaseLocation: { type: String, default: '' },
    sellerName: { type: String, default: 'Company Direct' },
    headquarterLocation: { type: String, default: '' },
    purchasePrice: { type: Number, default: 0 },
    investmentAmount: { type: Number, default: 0 },
    investorReturnRate: { type: Number, default: 0 },
    outboundRentalRate: { type: Number, default: 0 },
    status: { type: String, default: 'Active' },
    vehicleModelName: { type: String, default: '' },
    vehicleYearModel: { type: Number, default: 2026 },
    vehicleMotorPowerKw: { type: Number, default: 0 },
    vehicleServiceNo: { type: Number, default: 1 },
    batteryCapacityKwh: { type: Number, default: 0 },
    rangeKm: { type: Number, default: 0 },
    topSpeedKmph: { type: Number, default: 0 },
    vehicleImage: { type: [String], default: [] },
    vehicleId: { type: String, default: '' },
    clusterCity: { type: String, default: 'Aligarh' },
    clusterState: { type: String, default: 'Uttar Pradesh' },
  },
  { _id: false }
);

const portfolioAssetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    investorId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    vehicleId: {
      type: String,
      required: true,
      trim: true,
    },
    storeId: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleNoPlate: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleModelName: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleYearModel: {
      type: Number,
      default: 2026,
    },
    companyName: {
      type: String,
      default: 'EV',
      trim: true,
    },
    vehicleImage: {
      type: [String],
      default: [],
    },
    clusterCity: {
      type: String,
      default: 'Aligarh',
      trim: true,
    },
    clusterState: {
      type: String,
      default: 'Uttar Pradesh',
      trim: true,
    },
    units: {
      type: Number,
      default: 1,
      min: 1,
    },
    investedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyReturn: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Expiring Soon', 'Renewed', 'Closed'],
      default: 'Active',
    },
    isRenewable: {
      type: Boolean,
      default: true,
    },
    purchaseDate: {
      type: String,
      required: true,
      trim: true,
    },
    assetSummary: {
      type: assetSummarySchema,
      required: true,
    },
    renewal: {
      type: assetRenewalSchema,
      required: true,
    },
    assetGraph: {
      points: {
        type: [graphPointSchema],
        default: [],
      },
    },
    productSpecs: {
      type: productSpecsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

portfolioAssetSchema.methods.toItemJSON = function toItemJSON() {
  return {
    id: this.assetId,
    investorId: this.investorId,
    vehicleId: this.vehicleId,
    storeId: this.storeId,
    vehicleNoPlate: this.vehicleNoPlate,
    vehicleModelName: this.vehicleModelName,
    vehicleYearModel: this.vehicleYearModel,
    companyName: this.companyName,
    vehicleImage: this.vehicleImage,
    clusterCity: this.clusterCity,
    clusterState: this.clusterState,
    units: this.units,
    investedAmount: this.investedAmount,
    monthlyReturn: this.monthlyReturn,
    status: this.status,
    isRenewable: this.isRenewable,
    purchaseDate: this.purchaseDate,
  };
};

portfolioAssetSchema.methods.toDetailJSON = function toDetailJSON() {
  return {
    id: this.assetId,
    investorId: this.investorId,
    vehicleId: this.vehicleId,
    storeId: this.storeId,
    status: this.status,
    units: this.units,
    assetSummary: this.assetSummary,
    renewal: this.renewal,
    assetGraph: this.assetGraph,
    productSpecs: this.productSpecs,
  };
};

module.exports = mongoose.model('PortfolioAsset', portfolioAssetSchema);