/* ==========================================================
   EV Cluster Assigning & Management Controller
   File Path: controllers/evClusterAssigningController.js
   ========================================================== */

const EVVehicle = require('../models/EVVehicle');


exports.bulkAssignVehiclesWithHistory = async (req, res) => {
  try {
    const { clusterId, vehicles } = req.body; // 👈 यहाँ vehicles (एरे ऑफ ऑब्जेक्ट्स) रिसीव करें

    if (!clusterId || !Array.isArray(vehicles) || vehicles.length === 0) {
      return res.status(400).json({ success: false, error: 'Cluster ID and vehicles array are required' });
    }

    const currentDate = new Date();
    const updatedVehicles = [];

    for (const item of vehicles) {
      const { vehicleId, historyReferenceId } = item; // 👈 vehicleId और historyReferenceId दोनों निकालें

      const vehicle = await EVVehicle.findOne({ vehicleId });
      if (!vehicle) continue;

      // 1. Update Active Cluster
      vehicle.associateCluster = {
        clusterId: clusterId.toString(),
        assignedAt: currentDate
      };

      // 2. 👈 Update History Reference ID in EVVehicle model
      if (historyReferenceId) {
        vehicle.clusterAssociationHistory = String(historyReferenceId);
      }
      
      await vehicle.save();
      updatedVehicles.push(vehicleId);
    }

    return res.status(200).json({
      success: true,
      message: 'Fleet server successfully updated vehicle cluster associations and history references',
      data: updatedVehicles
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
exports.unassignVehicleFromCluster = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    if (!vehicleId) {
      return res.status(400).json({ success: false, error: 'Vehicle ID is required' });
    }

    const vehicle = await EVVehicle.findOne({ vehicleId });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found in fleet database' });
    }

    // रूट-लेवल associateCluster को null कर दें ताकि गाड़ी फिर से 'Free/Available' हो जाए
    vehicle.associateCluster = {
      clusterId: null,
      assignedAt: null
    };

    // (नोट: जैसा कि आपने कहा, clusterAssociationHistory को हटाने या छेड़ने की जरूरत नहीं है, वह पुरानी हिस्ट्री के लिए सुरक्षित रहेगी)

    await vehicle.save();

    return res.status(200).json({
      success: true,
      message: 'Vehicle successfully unassigned from fleet database and returned to inventory',
      data: { vehicleId: vehicle.vehicleId, associateCluster: vehicle.associateCluster }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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