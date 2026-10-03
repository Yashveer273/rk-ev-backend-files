const mongoose = require('mongoose');

const vehicleAnalyticsSchema = new mongoose.Schema({
  vehicleAnalyticsId: { type: String, required: true, unique: true },
  vehicleId: { type: String, required: true },
  investorId: { type: String, required: true },
  operatorId: { type: String, required: true },
  noOfInvestor: { type: Number, required: true },
  noOfOperator: { type: Number, required: true },
  noOfVehicle: { type: Number, required: true },
  totalInvestment: { type: Number, required: true },
  totalTimeInvestment: { type: Number, required: true },
  status: { type: String, enum: ['Active', 'Pending', 'Rejected'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('VehicleAnalytics', vehicleAnalyticsSchema);
