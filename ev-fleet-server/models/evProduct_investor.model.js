const mongoose = require('mongoose');
const crypto = require('crypto');

const evInvestorSpecsSchema = new mongoose.Schema(
  {
    brandModel: { type: String, required: true, trim: true },
    vehicleAge: { type: String, required: true, trim: true },
    range: { type: String, required: true, trim: true },
    battery: { type: String, required: true, trim: true },
    chargingTime: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// Generates an 8-character uppercase alphanumeric ID (e.g. "9F3AE78E")
function generateInvestorEvId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

const evProductInvestorSchema = new mongoose.Schema(
  {
    // Auto-generated 8-char alphanumeric ID in backend
    id: {
      type: String,
      unique: true,
      trim: true,
      default: generateInvestorEvId,
    },
    type: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      trim: true,
     enum: [
  'electric-scooty',
  'electric-bike',
  'three-wheeler',
  'electric-car',
  'other',
]
    },
    brand: { type: String, required: true, trim: true },
    modelName: { type: String, required: true, trim: true },
    modelYear: { type: Number, default: () => new Date().getFullYear() },
    infoTags: { type: [String], default: [] },
    summary: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 1 },
    monthlyReturnRate: { type: Number, required: true, min: 0 },
    specs: { type: evInvestorSpecsSchema, required: true },
    coverImage: { type: String, required: true, trim: true },
    gallery: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

evProductInvestorSchema.virtual('monthlyReturnAmount').get(function () {
  return Math.round((this.unitPrice || 0) * ((this.monthlyReturnRate || 0) / 100));
});

evProductInvestorSchema.virtual('expectedReturn').get(function () {
  return `${Number(this.monthlyReturnRate || 0)}% Monthly`;
});

evProductInvestorSchema.pre('save', async function (next) {
  if (!this.id) {
    let candidate = generateInvestorEvId();
    while (await this.constructor.exists({ id: candidate })) {
      candidate = generateInvestorEvId();
    }
    this.id = candidate;
  }

  const cleanGallery = Array.isArray(this.gallery)
    ? this.gallery.map((u) => String(u).trim()).filter(Boolean)
    : [];

  const cleanCover = this.coverImage ? String(this.coverImage).trim() : '';

  if (cleanGallery.length > 0) {
    this.gallery = cleanGallery;
    if (!cleanCover) {
      this.coverImage = cleanGallery[0];
    }
  } else if (cleanCover) {
    this.coverImage = cleanCover;
    this.gallery = [cleanCover];
  }

  next();
});

evProductInvestorSchema.statics.generateAutoId = generateInvestorEvId;

module.exports = mongoose.model('EvProductInvestor', evProductInvestorSchema);