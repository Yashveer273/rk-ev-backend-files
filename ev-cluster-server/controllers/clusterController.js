const VehicleCluster = require('../models/VehicleCluster');

// Get all clusters
exports.getClusters = async (req, res) => {
  try {
    const clusters = await VehicleCluster.find();
    res.status(200).json({ success: true, count: clusters.length, data: clusters });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single cluster by Owner ID
exports.getClusterById = async (req, res) => {
  try {
    const cluster = await VehicleCluster.findOne({ vehicleClusterOwnerId: req.params.id });
    if (!cluster) return res.status(404).json({ success: false, error: 'Cluster not found' });
    res.status(200).json({ success: true, data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new cluster
exports.createCluster = async (req, res) => {
  try {
    const newCluster = await VehicleCluster.create(req.body);
    res.status(201).json({ success: true, data: newCluster });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update cluster
exports.updateCluster = async (req, res) => {
  try {
    const updatedCluster = await VehicleCluster.findOneAndUpdate(
      { vehicleClusterOwnerId: req.params.id }, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!updatedCluster) return res.status(404).json({ success: false, error: 'Cluster not found' });
    res.status(200).json({ success: true, data: updatedCluster });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete cluster
exports.deleteCluster = async (req, res) => {
  try {
    const deletedCluster = await VehicleCluster.findOneAndDelete({ vehicleClusterOwnerId: req.params.id });
    if (!deletedCluster) return res.status(404).json({ success: false, error: 'Cluster not found' });
    res.status(200).json({ success: true, message: 'Cluster deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
