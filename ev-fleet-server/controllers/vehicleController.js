const EVVehicle = require('../models/EVVehicle');

// Get all EV vehicles
exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await EVVehicle.find();
    res.status(200).json({ success: true, count: vehicles.length, data: vehicles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single EV vehicle by ID
exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id });
    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new EV vehicle
exports.createVehicle = async (req, res) => {
  try {
    const newVehicle = await EVVehicle.create(req.body);
    res.status(201).json({ success: true, data: newVehicle });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update EV vehicle
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

// Delete EV vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const deletedVehicle = await EVVehicle.findOneAndDelete({ vehicleId: req.params.id });
    if (!deletedVehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
