/* ==========================================================
   EV Cluster Assigning & History Routes
   File Path: routes/evClusterAssigningRoutes.js
   ========================================================== */

const express = require('express');
const router = express.Router();
const clusterController = require('../controllers/evClusterAssigningController');
const { verifyEncryptionAuth } = require('../middleware/authMiddleware');
// 1. Assign or Update Vehicle Active Cluster (POST & PUT)
router.post('/assign',verifyEncryptionAuth, clusterController.assignVehicleCluster);
router.put('/assign',verifyEncryptionAuth, clusterController.assignVehicleCluster);

// 2. Link Cluster Association History Reference ID (POST, PUT, DELETE)
router.post('/history-link',verifyEncryptionAuth, clusterController.linkClusterHistoryIdPost);
router.put('/history-link',verifyEncryptionAuth, clusterController.linkClusterHistoryIdPut);
router.delete('/history-link/:vehicleId',verifyEncryptionAuth, clusterController.linkClusterHistoryIdDelete);

// 3. Get Vehicle Cluster & History Info (GET)
router.get('/:vehicleId',verifyEncryptionAuth, clusterController.getVehicleClusterDetails);

module.exports = router;