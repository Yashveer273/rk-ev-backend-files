const mongoose = require('mongoose');
const crypto = require('crypto');

const evVehicleSchema = new mongoose.Schema({
  vehicleId: { 
    type: String, 
    unique: true, 
    index: true 
  },
  vehicleType: { type: String, required: true, index: true },
  vehicleNoPlate: { type: String, required: true, index: true },
  
  companyData: {
    companyName: { type: String, required: true, index: true },
    sellerName: { type: String, default: 'Company Direct', index: true },
    headquarterLocation: { type: String, default: '' },
    purchaseLocation: { type: String, required: true, index: true }
  },

  // Independent Financial & Pricing Structure
  pricing: {
    purchasePrice: { type: Number, required: true, default: 70000 },
    investmentAmount: { type: Number, default: 0, index: true },
    investorReturnRate: { type: Number, default: 0, index: true },      
    outboundRentalRate: { type: Number, default: 0, index: true }
  },

  vehicleImage: [{
    imageId: { type: String },
    angle: String,
    imgurl: String,
    fuel: String
  }],

  status: { 
    type: String, 
    enum: ['Active', 'In-service', 'Non-active', 'Rejected', 'In Parking'], 
    default: 'Active', 
    index: true 
  },
  // Current Active Cluster Association
  associateCluster: {
    clusterId: { type: String, default: null },
    assignedAt: { type: Date, default: null }
  },

  // Reference ID to EVClusterHistory Collection
  clusterAssociationHistory: {
    type: String,
    ref: 'EVClusterHistory',
    default: null
  },
  vehicleModelName: { type: String, required: true, index: true },
  vehicleYearModel: { type: Number, required: true, index: true },
  vehicleMotorPowerKw: { type: Number, default: null, index: true },
  vehicleServiceNo: { type: Number, required: true },
  batteryCapacityKwh: { type: Number, required: true, index: true },
  rangeKm: { type: Number, required: true, index: true },
  topSpeedKmph: { type: Number, required: true, index: true }
}, { timestamps: true });

evVehicleSchema.pre('save', function (next) {
  if (!this.vehicleId) {
    this.vehicleId = 'EV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  if (this.vehicleImage && this.vehicleImage.length > 0) {
    this.vehicleImage.forEach((img) => {
      if (!img.imageId) {
        img.imageId = 'IMG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      }
    });
  }
  next();
});

evVehicleSchema.index({ 
  vehicleNoPlate: 'text', 
  vehicleModelName: 'text', 
  'companyData.companyName': 'text',
  'companyData.sellerName': 'text',
  'companyData.purchaseLocation': 'text'
});

module.exports = mongoose.model('EVVehicle', evVehicleSchema);