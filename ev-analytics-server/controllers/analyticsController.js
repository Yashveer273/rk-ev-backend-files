const VehicleAnalytics = require('../models/VehicleAnalytics');

// Get all analytics records
exports.getAnalytics = async (req, res) => {
  try {
    const analytics = await VehicleAnalytics.find();
    res.status(200).json({ success: true, count: analytics.length, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single analytics record by ID
exports.getAnalyticsById = async (req, res) => {
  try {
    const analytic = await VehicleAnalytics.findOne({ vehicleAnalyticsId: req.params.id });
    if (!analytic) return res.status(404).json({ success: false, error: 'Analytics record not found' });
    res.status(200).json({ success: true, data: analytic });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new analytics record
exports.createAnalytics = async (req, res) => {
  try {
    const newAnalytic = await VehicleAnalytics.create(req.body);
    res.status(201).json({ success: true, data: newAnalytic });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update analytics record
exports.updateAnalytics = async (req, res) => {
  try {
    const updatedAnalytic = await VehicleAnalytics.findOneAndUpdate(
      { vehicleAnalyticsId: req.params.id }, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!updatedAnalytic) return res.status(404).json({ success: false, error: 'Analytics record not found' });
    res.status(200).json({ success: true, data: updatedAnalytic });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete analytics record
exports.deleteAnalytics = async (req, res) => {
  try {
    const deletedAnalytic = await VehicleAnalytics.findOneAndDelete({ vehicleAnalyticsId: req.params.id });
    if (!deletedAnalytic) return res.status(404).json({ success: false, error: 'Analytics record not found' });
    res.status(200).json({ success: true, message: 'Analytics record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
