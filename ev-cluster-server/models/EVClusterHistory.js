const mongoose = require('mongoose');

const evClusterHistorySchema = new mongoose.Schema({
  vehicleId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  associations: [
    {
      clusterId: { type: String, required: true },
      assignedAt: { type: Date, default: Date.now },
      unassignedAt: { type: Date, default: null }, // जब दूसरे क्लस्टर में भेजा जाएगा
      status: { 
        type: String, 
        enum: ['Active', 'Transferred', 'Unassigned'], 
        default: 'Active' 
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('EVClusterHistory', evClusterHistorySchema);