const EVVehicle = require('../models/EVVehicle');
const crypto = require('crypto');

// ==========================================
// 1. CORE CRUD & PAGINATED SEARCH APIs
// ==========================================

// Create a new EV Vehicle
exports.createVehicle = async (req, res) => {
  try {
    const newVehicle = await EVVehicle.create(req.body);
    res.status(201).json({ success: true, data: newVehicle });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Advanced Search & Paginated List
exports.searchVehicles = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      vehicleId,
      vehicleType, 
      vehicleNoPlate,
      companyName, 
      sellerName,
      purchaseLocation,
      acquisitionType,
      status, 
      vehicleModelName,
      vehicleYearModel,
      vehicleMotorPowerKw,
      batteryCapacityKwh,
      rangeKm,
      topSpeedKmph,
      search 
    } = req.query;
    
    let query = {};

    // Specific Exact/Regex Filters
    if (vehicleId) query.vehicleId = new RegExp(vehicleId, 'i');
    if (vehicleType) query.vehicleType = new RegExp(vehicleType, 'i');
    if (vehicleNoPlate) query.vehicleNoPlate = new RegExp(vehicleNoPlate, 'i');
    if (status) query.status = status;
    if (vehicleModelName) query.vehicleModelName = new RegExp(vehicleModelName, 'i');
    
    // Nested Object Filters
    if (companyName) query['companyData.companyName'] = new RegExp(companyName, 'i');
    if (sellerName) query['companyData.sellerName'] = new RegExp(sellerName, 'i');
    if (purchaseLocation) query['companyData.purchaseLocation'] = new RegExp(purchaseLocation, 'i');
    if (acquisitionType) query['pricing.acquisitionType'] = acquisitionType;

    // Numerical Filters
    if (vehicleYearModel) query.vehicleYearModel = Number(vehicleYearModel);
    if (vehicleMotorPowerKw) query.vehicleMotorPowerKw = Number(vehicleMotorPowerKw);
    if (batteryCapacityKwh) query.batteryCapacityKwh = Number(batteryCapacityKwh);
    if (rangeKm) query.rangeKm = { $gte: Number(rangeKm) }; 
    if (topSpeedKmph) query.topSpeedKmph = { $gte: Number(topSpeedKmph) }; 

    // Global Keyword Fallback Search
    if (search) {
      query.$or = [
        { vehicleNoPlate: new RegExp(search, 'i') },
        { vehicleModelName: new RegExp(search, 'i') },
        { 'companyData.companyName': new RegExp(search, 'i') },
        { 'companyData.purchaseLocation': new RegExp(search, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const vehicles = await EVVehicle.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await EVVehicle.countDocuments(query);

    res.status(200).json({
      success: true,
      count: vehicles.length,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      data: vehicles
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single EV vehicle by vehicleId
exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id });
    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Full / Partial Vehicle Update (Dynamic Put/Patch)
exports.updateVehicle = async (req, res) => {
  try {
    const updatedVehicle = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id }, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!updatedVehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updatedVehicle });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete entire EV vehicle record
exports.deleteVehicle = async (req, res) => {
  try {
    const deletedVehicle = await EVVehicle.findOneAndDelete({ vehicleId: req.params.id });
    if (!deletedVehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 2. VEHICLE IMAGE SPECIFIC APIs
// ==========================================

// Get All Images for a Vehicle
exports.getVehicleImages = async (req, res) => {
  try {
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id }).select('vehicleImage');
    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: vehicle.vehicleImage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add / Update Image in vehicleImage Array
exports.addOrUpdateVehicleImage = async (req, res) => {
  try {
    const { angle, imgurl, fuel, imageId } = req.body;
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id });

    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });

    if (imageId) {
      // Existing image update karo
      const imgIndex = vehicle.vehicleImage.findIndex(img => img.imageId === imageId);
      if (imgIndex > -1) {
        if (angle) vehicle.vehicleImage[imgIndex].angle = angle;
        if (imgurl) vehicle.vehicleImage[imgIndex].imgurl = imgurl;
        if (fuel) vehicle.vehicleImage[imgIndex].fuel = fuel;
      } else {
        return res.status(404).json({ success: false, error: 'Image ID not found' });
      }
    } else {
      // New image push karo with auto-generated imageId
      const newImgId = 'IMG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      vehicle.vehicleImage.push({ imageId: newImgId, angle, imgurl, fuel });
    }

    await vehicle.save();
    res.status(200).json({ success: true, data: vehicle.vehicleImage });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete a specific Image by imageId
exports.deleteVehicleImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id });

    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });

    vehicle.vehicleImage = vehicle.vehicleImage.filter(img => img.imageId !== imageId);
    await vehicle.save();

    res.status(200).json({ success: true, message: 'Image deleted successfully', data: vehicle.vehicleImage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 3. FIELD-SPECIFIC UPDATES (Individual Modifiers)
// ==========================================

// Update Model Name specifically
exports.updateModelName = async (req, res) => {
  try {
    const { vehicleModelName } = req.body;
    const updated = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id },
      { $set: { vehicleModelName } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update Year Model specifically
exports.updateYearModel = async (req, res) => {
  try {
    const { vehicleYearModel } = req.body;
    const updated = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id },
      { $set: { vehicleYearModel: Number(vehicleYearModel) } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update Vehicle Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};