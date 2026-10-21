const mongoose = require('mongoose');
const crypto = require('crypto'); // Built-in Node.js module unique ID/hash generate karne ke liye

const evVehicleSchema = new mongoose.Schema({
  vehicleId: { 
    type: String, 
    unique: true, 
    index: true 
  },
  vehicleType: { type: String, required: true, index: true },
  vehicleNoPlate: { type: String, required: true, index: true },
  
  // Company & Purchase/Seller Details
  companyData: {
    companyName: { type: String, required: true, index: true },
    sellerName: { type: String, default: 'Company Direct', index: true },
    headquarterLocation: { type: String, default: '' },
    purchaseLocation: { type: String, required: true, index: true }
  },

  // Pricing Structure (Default Buy Cost set to 70000)
  pricing: {
    acquisitionType: { 
      type: String, 
      enum: ['Buy', 'Rent'], 
      default: 'Buy', 
      index: true 
    },
    purchasePrice: { type: Number, required: true, default: 70000 },
    vendorRentalCost: { type: Number, default: 0 },      
    outboundRentalRate: { type: Number, default: 0 }     
  },

  // Vehicle Images with Auto-Generated imageId
  vehicleImage: [{
    imageId: { 
      type: String 
    },
    angle: String,
    imgurl: String,
    fuel: String // Future-proofing ke liye
  }],

  status: { 
    type: String, 
    enum: ['Active', 'In-service', 'Non-active', 'Rejected', 'In Parking'], 
    default: 'Active', 
    index: true 
  },
  
  vehicleModelName: { type: String, required: true, index: true },
  vehicleYearModel: { type: Number, required: true, index: true },
  vehicleMotorPowerKw: { type: Number, default: null, index: true },
  vehicleServiceNo: { type: Number, required: true },
  batteryCapacityKwh: { type: Number, required: true, index: true },
  rangeKm: { type: Number, required: true, index: true },
  topSpeedKmph: { type: Number, required: true, index: true }
}, { timestamps: true });

// Pre-save middleware to automatically generate vehicleId and imageIds if not provided
evVehicleSchema.pre('save', function (next) {
  // Agar vehicleId pehle se nahi hai toh auto-generate karein (e.g., EV-XXXXXXXX)
  if (!this.vehicleId) {
    this.vehicleId = 'EV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Agar vehicle images hain toh har image ke liye auto-generate imageId
  if (this.vehicleImage && this.vehicleImage.length > 0) {
    this.vehicleImage.forEach((img) => {
      if (!img.imageId) {
        img.imageId = 'IMG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      }
    });
  }

  next();
});

// Text & Compound Indexing for fast searching
evVehicleSchema.index({ 
  vehicleNoPlate: 'text', 
  vehicleModelName: 'text', 
  'companyData.companyName': 'text',
  'companyData.sellerName': 'text',
  'companyData.purchaseLocation': 'text'
});

module.exports = mongoose.model('EVVehicle', evVehicleSchema);