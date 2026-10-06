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
    image: { type: String },
    status: { type: String, enum: ['Verified', 'Pending', 'Rejected'], default: 'Pending', index: true }
  },
  kyc: {
    id: { type: String },
    aadhaar: { type: String }, // Redacted/Secure handling
    kycStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending', index: true }
  },
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