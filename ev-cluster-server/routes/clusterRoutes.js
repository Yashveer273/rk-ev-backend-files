const express = require('express');
const router = express.Router();
const {
  verifySuperAdmin,
  verifyClusterOwner
} = require('../middlewares/authMiddleware');

const {
  createCluster,
  updateCapacity,
  updateLocation,
  updateOwnerDetails,
  submitKycDetails,
  verifyKycStatus,
  addVehicleOperator,
  getVehicleOperators,
  deleteVehicleOperator
} = require('../controllers/clusterController');

// --- SUPER ADMIN ROUTES ---
router.post('/create', verifySuperAdmin, createCluster);
router.put('/:id/capacity', verifySuperAdmin, updateCapacity);
router.put('/:id/location', verifySuperAdmin, updateLocation);
router.put('/:id/kyc-verify/:clusterId', verifySuperAdmin, verifyKycStatus);

// --- SHARED / OWNER DETAILS ROUTE ---
router.put('/:id/owner-details', updateOwnerDetails);

// --- CLUSTER OWNER / MANAGER ROUTES ---
// ओनर केवल अपनी केवाईसी (आधार) सबमिट कर सकता है (स्टेटस पास/फेल एडमिन करेगा)
router.put('/:clusterId/submit-kyc', verifyClusterOwner, submitKycDetails);

// व्हीकल ऑपरेटर ऑपरेशंस (Add, Get, Delete) क्लस्टर ओनर द्वारा क्लस्टर आईडी के माध्यम से
router.post('/:clusterId/operators', verifyClusterOwner, addVehicleOperator);
router.get('/:clusterId/operators', verifyClusterOwner, getVehicleOperators);
router.delete('/:clusterId/operators/:operatorRecordId', verifyClusterOwner, deleteVehicleOperator);

module.exports = router;