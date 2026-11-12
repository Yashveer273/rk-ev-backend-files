/* ==========================================================
   EV Cluster Assigning & Management Controller
   File Path: controllers/evClusterAssigningController.js
   ========================================================== */

const EVVehicle = require('../models/EVVehicle');

/**
 * 1. Assign New Cluster to Vehicle (POST / PUT)
 */
exports.assignVehicleCluster = async (req, res) => {
  try {
    const { vehicleId, clusterId } = req.body;

    if (!vehicleId || !clusterId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vehicle ID and Cluster ID are required' 
      });
    }

    const vehicle = await EVVehicle.findOne({ vehicleId });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found in fleet database' });
    }

    const currentDate = new Date();

    // Current active cluster update karein
    vehicle.associateCluster = {
      clusterId: clusterId,
      assignedAt: currentDate
    };

    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Vehicle successfully assigned to the cluster',
      data: {
        vehicleId: vehicle.vehicleId,
        associateCluster: vehicle.associateCluster
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * 2. Link Cluster Association History Reference ID (POST / PUT / DELETE / GET)
 */

// POST: Pehli baar history reference ID link karne ke liye (Agar pehle se hai toh dobara post allow nahi hoga)
exports.linkClusterHistoryIdPost = async (req, res) => {
  try {
    const { vehicleId, historyReferenceId } = req.body;

    if (!vehicleId || !historyReferenceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vehicle ID and History Reference ID are required' 
      });
    }

    const vehicle = await EVVehicle.findOne({ vehicleId });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found in fleet database' });
    }

    // Validation: Agar pehle se history ID set hai, toh POST ke through dobara nahi karne denge
    if (vehicle.clusterAssociationHistory) {
      return res.status(409).json({
        success: false,
        error: 'Cluster association history already exists for this vehicle. Use PUT method to update.'
      });
    }

    vehicle.clusterAssociationHistory = String(historyReferenceId);
    await vehicle.save();

    res.status(201).json({
      success: true,
      message: 'Cluster association history reference linked successfully',
      data: {
        vehicleId: vehicle.vehicleId,
        clusterAssociationHistory: vehicle.clusterAssociationHistory
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// PUT: Existing history reference ID ko update/edit karne ke liye
exports.linkClusterHistoryIdPut = async (req, res) => {
  try {
    const { vehicleId, historyReferenceId } = req.body;

    if (!vehicleId || !historyReferenceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vehicle ID and History Reference ID are required' 
      });
    }

    const vehicle = await EVVehicle.findOne({ vehicleId });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found in fleet database' });
    }

    vehicle.clusterAssociationHistory = String(historyReferenceId);
    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Cluster association history reference updated successfully',
      data: {
        vehicleId: vehicle.vehicleId,
        clusterAssociationHistory: vehicle.clusterAssociationHistory
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// DELETE: History reference ID ko remove/reset karne ke liye (Null karne ke liye)
exports.linkClusterHistoryIdDelete = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    if (!vehicleId) {
      return res.status(400).json({ success: false, error: 'Vehicle ID is required' });
    }

    const vehicle = await EVVehicle.findOne({ vehicleId });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found in fleet database' });
    }

    vehicle.clusterAssociationHistory = null;
    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Cluster association history reference deleted successfully',
      data: {
        vehicleId: vehicle.vehicleId,
        clusterAssociationHistory: null
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// GET: Vehicle ki cluster association aur history details fetch karne ke liye
exports.getVehicleClusterDetails = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await EVVehicle.findOne({ vehicleId });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found in fleet database' });
    }

    res.status(200).json({
      success: true,
      data: {
        vehicleId: vehicle.vehicleId,
        associateCluster: vehicle.associateCluster,
        clusterAssociationHistory: vehicle.clusterAssociationHistory
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};