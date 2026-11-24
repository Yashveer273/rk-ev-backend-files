
const express = require('express');
const router = express.Router();
const clusterController = require('../controllers/evClusterAssigningController');
const { verifyEncryptionAuth } = require('../middleware/authMiddleware');
// 1. Assign or Update Vehicle Active Cluster 
router.post('/bulk-assign-with-history', clusterController.bulkAssignVehiclesWithHistory);
router.delete('/:vehicleId', clusterController.unassignVehicleFromCluster);

// 2. Link Cluster Association History Reference ID 

router.put('/history-link',verifyEncryptionAuth, clusterController.linkClusterHistoryIdPut);
router.delete('/history-link/:vehicleId',verifyEncryptionAuth, clusterController.linkClusterHistoryIdDelete);

// 3. Get Vehicle Cluster & History Info 
router.get('/:vehicleId',verifyEncryptionAuth, clusterController.getVehicleClusterDetails);

module.exports = router;