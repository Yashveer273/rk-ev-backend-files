const mongoose = require('mongoose');

const vehicleClusterSchema = new mongoose.Schema({
  vehicleLocation: {
    lat: { type: Number, required: true },
    long: { type: Number, required: true },
    zipCode: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    streetAddress: { type: String, required: true }
  },
  vehicleCapacity: { type: Number, required: true },
  vehicleClusterOwnerName: { type: String, required: true },
  vehicleClusterOwnerId: { type: String, required: true, unique: true },
  vehicleClusterDetails: {
    ownerName: String,
    pan: String,
    email: String,
    image: String,
    status: { type: String, enum: ['Verified', 'Pending', 'Rejected'] }
  },
  kyc: {
    id: String,
    aadhaar: String 
  },
  vehicleLot: [{
    vehicleId: String,
    investorId: String,
    operatorId: String,
    startDate: String,
    endDate: String
  }],
  service: {
    startDate: String,
    endDate: String,
    status: String
  },
  operatorPaymentAmount: Number,
  investorPaymentAmount: Number
}, { timestamps: true });

module.exports = mongoose.model('VehicleCluster', vehicleClusterSchema);
