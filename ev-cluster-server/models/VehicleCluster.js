const mongoose = require('mongoose');

const vehicleClusterSchema = new mongoose.Schema({
  vehicleClusterLocation: {
    lat: { type: Number, required: true },
    long: { type: Number, required: true },
    zipCode: { type: String, required: true, index: true },
    state: { type: String, required: true },
    city: { type: String, required: true, index: true },
    streetAddress: { type: String, required: true }
  },
  vehicleCapacity: { type: Number, required: true, default: 0 },
  vehicleClusterOwnerName: { type: String, required: true },
  vehicleClusterOwnerId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  vehicleClusterDetails: {
    ownerName: { type: String },
    pan: { type: String },
    email: { type: String, index: true },
    password: { type: String, required: true },
    image: { type: String },
    status: { type: String, enum: ['Active', 'Verified', 'Pending', 'Rejected', 'Restricted'], default: 'Pending', index: true }
  },
kyc: {
    kycId: {
      type: String,
    },
    pan: { type: String },
    documentUrl: { type: String },
    kycStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    rejectionReason: { type: String, default: '' },
    submittedAt: { type: Date },
  },
  loginHistory: [
    {
      loginTime: { type: Date, default: Date.now },
      ipAddress: { type: String }
    }
  ],
  vehicles: [
    {
      vehicleId: { type: String, unique: true, sparse: true, index: true },
      investorId: { type: String, unique: true, sparse: true, index: true },
      assignVehicleAt: { type: String },
      removeVehicleAt: { type: String },
      operatorInfo: { 
        operatorId: { type: String, unique: true, sparse: true, index: true },
        startDate: { type: String },
        endDate: { type: String },
        status: { type: String, enum: ['Active', 'Pending', 'Expired'], default: 'Pending' }
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('VehicleCluster', vehicleClusterSchema);