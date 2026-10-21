const express = require('express');
const router = express.Router();

const {
  createVehicle,
  searchVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getVehicleImages,
  addOrUpdateVehicleImage,
  deleteVehicleImage,
  updateModelName,
  updateYearModel,
  updateStatus
} = require('../controllers/vehicleController');

// Encryption Authorization Middleware import karein
const { verifyEncryptionAuth } = require('../middleware/authMiddleware');

// Sabhi routes par security middleware apply kiya gaya hai
router.use(verifyEncryptionAuth);

// ==========================================
// 1. PRIMARY & SEARCH ROUTES
// ==========================================

// Create EV Vehicle OR Search with Pagination & Filters
router.route('/')
  .post(createVehicle)
  .get(searchVehicles);

// Full Vehicle operations by vehicleId
router.route('/:id')
  .get(getVehicleById)
  .put(updateVehicle)
  .patch(updateVehicle)
  .delete(deleteVehicle);

// ==========================================
// 2. IMAGE MANAGEMENT ROUTES
// ==========================================

// Get all images or Add/Update Image for a Vehicle
router.route('/:id/images')
  .get(getVehicleImages)
  .post(addOrUpdateVehicleImage)
  .put(addOrUpdateVehicleImage);

// Delete specific image by imageId
router.route('/:id/images/:imageId')
  .delete(deleteVehicleImage);

// ==========================================
// 3. INDIVIDUAL FIELD MODIFIERS
// ==========================================

router.patch('/:id/model-name', updateModelName);
router.patch('/:id/year-model', updateYearModel);
router.patch('/:id/status', updateStatus);

module.exports = router;