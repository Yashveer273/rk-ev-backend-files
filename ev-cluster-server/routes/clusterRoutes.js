const express = require('express');
const router = express.Router();
const {
  getClusters,
  getClusterById,
  createCluster,
  updateCluster,
  deleteCluster
} = require('../controllers/clusterController');

router.route('/').get(getClusters).post(createCluster);
router.route('/:id').get(getClusterById).put(updateCluster).delete(deleteCluster);

module.exports = router;
