const express = require('express');
const router = express.Router();

const {
  createVehicle,
  searchVehicles,
  AppsearchVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getVehicleImages,
  addOrUpdateVehicleImage,
  deleteVehicleImage,
  updateModelName,
  updateYearModel,
  updateStatus,AppsearchVehicleById
} = require('../controllers/vehicleController');

const {
  verifyEncryptionAuth
} = require('../middleware/authMiddleware');

// ==========================================
// 1. CREATE VEHICLE
// POST /api/vehicles
// Encryption Required
// ==========================================

router.post(
  '/',
  verifyEncryptionAuth,
  createVehicle
);

// ==========================================
// 2. GET / SEARCH VEHICLES
// GET /api/vehicles
// Public API - No Encryption
// ==========================================
router.get(
  '/AppsearchVehicles',
  AppsearchVehicles
);
router.get(
  '/AppsearchVehicleById/:id',
  AppsearchVehicleById
);
router.get(
  '/',
  searchVehicles
);

// ==========================================
// 3. GET VEHICLE BY ID
// GET /api/vehicles/:id
// Public API - No Encryption
// ==========================================

router.get(
  '/:id',
  getVehicleById
);

// ==========================================
// 4. UPDATE VEHICLE
// PUT /api/vehicles/:id
// Encryption Required
// ==========================================

router.put(
  '/:id',
  verifyEncryptionAuth,
  updateVehicle
);

// ==========================================
// 5. PATCH VEHICLE
// PATCH /api/vehicles/:id
// Encryption Required
// ==========================================

router.patch(
  '/:id',
  verifyEncryptionAuth,
  updateVehicle
);

// ==========================================
// 6. DELETE VEHICLE
// DELETE /api/vehicles/:id
// Encryption Required
// ==========================================

router.delete(
  '/:id',
  verifyEncryptionAuth,
  deleteVehicle
);

// ==========================================
// 7. GET VEHICLE IMAGES
// GET /api/vehicles/:id/images
// Public API - No Encryption
// ==========================================

router.get(
  '/:id/images',
  getVehicleImages
);

// ==========================================
// 8. ADD / UPDATE VEHICLE IMAGE
// POST /api/vehicles/:id/images
// Encryption Required
// ==========================================

router.post(
  '/:id/images',
  verifyEncryptionAuth,
  addOrUpdateVehicleImage
);

// ==========================================
// 9. UPDATE VEHICLE IMAGE
// PUT /api/vehicles/:id/images
// Encryption Required
// ==========================================

router.put(
  '/:id/images',
  verifyEncryptionAuth,
  addOrUpdateVehicleImage
);

// ==========================================
// 10. DELETE VEHICLE IMAGE
// DELETE /api/vehicles/:id/images/:imageId
// Encryption Required
// ==========================================

router.delete(
  '/:id/images/:imageId',
  verifyEncryptionAuth,
  deleteVehicleImage
);

// ==========================================
// 11. UPDATE VEHICLE MODEL NAME
// PATCH /api/vehicles/:id/model-name
// Encryption Required
// ==========================================

router.patch(
  '/:id/model-name',
  verifyEncryptionAuth,
  updateModelName
);

// ==========================================
// 12. UPDATE VEHICLE YEAR MODEL
// PATCH /api/vehicles/:id/year-model
// Encryption Required
// ==========================================

router.patch(
  '/:id/year-model',
  verifyEncryptionAuth,
  updateYearModel
);

// ==========================================
// 13. UPDATE VEHICLE STATUS
// PATCH /api/vehicles/:id/status
// Encryption Required
// ==========================================

router.patch(
  '/:id/status',
  verifyEncryptionAuth,
  updateStatus
);

module.exports = router;