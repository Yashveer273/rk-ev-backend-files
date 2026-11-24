const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const normalizePhone = (raw = '') => {
  let clean = String(raw).replace(/\s+/g, '').trim();
  if (clean.startsWith('+91')) {
    clean = clean.slice(3);
  } else if (clean.startsWith('91') && clean.length > 10) {
    clean = clean.slice(2);
  }
  return clean;
};

const bankPayoutDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, uppercase: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    upiId: { type: String, trim: true, default: '' },
    updatedAt: { type: String, default: '' },
  },
  { _id: false }
);

const kycDetailsSchema = new mongoose.Schema(
  {
    fullNameAsPerPan: { type: String, trim: true, default: '' },
    panNumber: { type: String, trim: true, uppercase: true, default: '' },
    aadhaarNumber: { type: String, trim: true, default: '' },
    panImageUrl: { type: String, trim: true, default: '' },
    aadhaarImageUrl: { type: String, trim: true, default: '' },
    dob: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    updatedAt: { type: String, default: '' },
  },
  { _id: false }
);

const investorSchema = new mongoose.Schema(
  {
    investorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      set: normalizePhone,
      validate: {
        validator: (v) => /^[0-9]{10}$/.test(v),
        message: 'Phone number must be a valid 10-digit number',
      },
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    city: {
      type: String,
      trim: true,
      default: 'Aligarh, Uttar Pradesh',
    },
    kycStatus: {
      type: String,
      enum: ['Verified', 'Pending', 'Rejected'],
      default: 'Pending',
    },
    kyc: {
      type: kycDetailsSchema,
      default: () => ({}),
    },
    bankDetails: {
      type: bankPayoutDetailsSchema,
      default: () => ({}),
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

investorSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

investorSchema.methods.matchPassword = function matchPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

investorSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    investorId: this.investorId,
    fullName: this.fullName,
    phone: this.phone,
    email: this.email,
    city: this.city,
    kycStatus: this.kycStatus,
    kyc: this.kyc || {
      fullNameAsPerPan: '',
      panNumber: '',
      aadhaarNumber: '',
      panImageUrl: '',
      aadhaarImageUrl: '',
      dob: '',
      address: '',
      remarks: '',
      updatedAt: '',
    },
    bankDetails: this.bankDetails || {
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      upiId: '',
      updatedAt: '',
    },
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Investor', investorSchema);