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
 // VehicleCluster Schema ke andar kyc sub-schema mein 'documentUrl' add karein:
kyc: {
kycId: { 
    type: String, 
    default: () => "KYC-" + Math.floor(100000 + Math.random() * 900000) 
  },
  pan: { type: String, required: true },
  documentUrl: { type: String, required: true },
  kycStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  rejectionReason: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now }
},
  loginHistory: [
    {
      loginTime: { type: Date, default: Date.now },
      ipAddress: { type: String }
    }
  ],
  AllEV_vehicleoperator: [
    {
      vehicleId: { type: String, index: true },
      investorId: { type: String },
      operatorId: { type: String },
      startDate: { type: String },
      endDate: { type: String },
      service: {
        startDate: { type: String },
        endDate: { type: String },
        status: { type: String, enum: ['Active', 'Pending', 'Completed', 'Expired'], default: 'Pending' },
        operatorPaymentAmount: { type: Number },
        investorPaymentAmount: { type: Number }
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('VehicleCluster', vehicleClusterSchema);