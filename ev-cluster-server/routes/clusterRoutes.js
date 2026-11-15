const express = require('express');
const router = express.Router();
const {
  verifySuperAdmin,
  verifyClusterOwner
} = require('../middlewares/authMiddleware');

const {
  getOwnedCluster,
  getClustersByKycStatus,
  getClusters,
  getCluster,
  deleteCluster,
  createCluster,
  updateCapacity,
  updateLocation,
  updateOwnerDetails,
  submitKyc,
  verifyKycStatus,
  addVehicleOperator,
  getVehicleOperators,
  deleteVehicleOperator,
  verifyOwnerLogin,
  getKycStatus,
  getAllKycRequests,assignVehiclesBulk,updateAssignedVehicle,removeVehicleFromCluster,getClusterVehicles
} = require('../controllers/clusterController');

// --- SUPER ADMIN & CRM ROUTES ---
router.get('/kyc-status', verifySuperAdmin, getClustersByKycStatus); // Used by cluster-queries-api.js
router.get('/mine', verifyClusterOwner, getOwnedCluster); // Used by cluster-owner-api.js
router.get('/admin/kyc-requests', verifySuperAdmin, getAllKycRequests); // Admin CRM list

// Admin KYC Verification (Exact match for super-admin-api.js: `PUT /:targetId/kyc-verify/:targetId`)
router.put('/admin/kyc-verify/:id/status', verifySuperAdmin, verifyKycStatus);
// --- GENERAL CLUSTER ROUTES ---
router.get('/', verifySuperAdmin, getClusters);
router.post('/create', verifySuperAdmin, createCluster);
router.post('/verify-login', verifyOwnerLogin);

// --- SPECIFIC CLUSTER ID ROUTES ---
router.get('/:id', verifySuperAdmin, getCluster);
router.delete('/:id', verifySuperAdmin, deleteCluster);
router.put('/:id/capacity', verifySuperAdmin, updateCapacity);
router.put('/:id/location', verifySuperAdmin, updateLocation);
router.put('/:id/owner-details', verifySuperAdmin, updateOwnerDetails);

// --- CLUSTER OWNER KYC ROUTES (Exact match for cluster-owner-api.js) ---
router.put('/:id/submit-kyc', verifyClusterOwner, submitKyc); //[cite: 7] Matches cluster-owner-api.js PUT method
router.get('/:id/kyc', verifyClusterOwner, getKycStatus);

// --- VEHICLE OPERATOR ROUTES ---
router.post('/:clusterId/operators', verifyClusterOwner, addVehicleOperator);
router.get('/:clusterId/operators', verifyClusterOwner, getVehicleOperators);
router.delete('/:clusterId/operators/:operatorRecordId', verifyClusterOwner, deleteVehicleOperator);
// --- BULK VEHICLE ASSIGNMENT & MANAGEMENT ROUTES ---
router.get('/:clusterId/vehicles', verifyClusterOwner, getClusterVehicles);
router.post('/:clusterId/vehicles/bulk-assign', verifyClusterOwner, assignVehiclesBulk); // POST API (Bulk Assign)
router.put('/:clusterId/vehicles/:vehicleId', verifyClusterOwner, updateAssignedVehicle);       // PUT API (Update Details)
router.delete('/:clusterId/vehicles/:vehicleId', verifyClusterOwner, removeVehicleFromCluster); // DELETE API (Remove/Unassign)
module.exports = router;