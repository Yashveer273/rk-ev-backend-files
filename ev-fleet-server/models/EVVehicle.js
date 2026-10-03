const mongoose = require('mongoose');

const evVehicleSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true, unique: true },
  vehicleType: { type: String, required: true },
  companyName: { type: String, required: true },
  vehicleImage: [{
    angle: String,
    imgurl: String,
    fuel: String
  }],
  vehicleNoPlate: { type: String, required: true },
  status: { type: String, enum: ['Active', 'In-service', 'Non-active', 'Rejected'], default: 'Active' },
  vehicleModelName: { type: String, required: true },
  vehicleYearModel: { type: Number, required: true },
  vehicleMotorPowerKw: { type: Number, default: null },
  vehicleServiceNo: { type: Number, required: true },
  batteryCapacityKwh: { type: Number, required: true },
  rangeKm: { type: Number, required: true },
  topSpeedKmph: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('EVVehicle', evVehicleSchema);
