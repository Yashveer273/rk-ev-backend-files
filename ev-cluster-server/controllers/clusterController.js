const mongoose = require('mongoose');
const VehicleCluster = require('../models/VehicleCluster');

const splitValues = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getClusters = async (req, res) => {
  try {
    const conditions = [];
    const { id, ownerId, ownerName, city, state, zipCode, lat, long, status, kycStatus, from, to } = req.query;

    if (id) {
      const ids = splitValues(id);
      const objectIds = ids.filter((value) => mongoose.Types.ObjectId.isValid(value));
      const ownerIds = ids.filter((value) => !objectIds.includes(value));
      const idConditions = [];

      if (objectIds.length) idConditions.push({ _id: { $in: objectIds } });
      if (ownerIds.length) idConditions.push({ vehicleClusterOwnerId: { $in: ownerIds } });
      if (idConditions.length) conditions.push({ $or: idConditions });
    }

    if (ownerId) {
      conditions.push({ vehicleClusterOwnerId: { $in: splitValues(ownerId) } });
    }
    if (ownerName) {
      const ownerNameRegex = new RegExp(escapeRegex(ownerName.trim()), 'i');
      conditions.push({
        $or: [
          { vehicleClusterOwnerName: ownerNameRegex },
          { 'vehicleClusterDetails.ownerName': ownerNameRegex }
        ]
      });
    }
    if (city) conditions.push({ 'vehicleClusterLocation.city': new RegExp(`^${escapeRegex(city.trim())}$`, 'i') });
    if (state) conditions.push({ 'vehicleClusterLocation.state': new RegExp(`^${escapeRegex(state.trim())}$`, 'i') });
    if (zipCode) conditions.push({ 'vehicleClusterLocation.zipCode': { $in: splitValues(zipCode) } });

    for (const [coordinate, value] of [['lat', lat], ['long', long]]) {
      if (value !== undefined) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          return res.status(400).json({ success: false, message: `${coordinate} must be a valid number` });
        }
        conditions.push({ [`vehicleClusterLocation.${coordinate}`]: number });
      }
    }

    if (status) {
      conditions.push({ 'vehicleClusterDetails.status': { $in: splitValues(status) } });
    }
    if (kycStatus) conditions.push({ 'kyc.kycStatus': { $in: splitValues(kycStatus) } });

    const createdAt = {};
    if (from) {
      createdAt.$gte = new Date(from);
      if (Number.isNaN(createdAt.$gte.getTime())) {
        return res.status(400).json({ success: false, message: 'from must be a valid date' });
      }
    }
    if (to) {
      createdAt.$lte = new Date(to);
      if (Number.isNaN(createdAt.$lte.getTime())) {
        return res.status(400).json({ success: false, message: 'to must be a valid date' });
      }
    }
    if (Object.keys(createdAt).length) conditions.push({ createdAt });

    const filter = conditions.length > 1 ? { $and: conditions } : (conditions[0] || {});
    const clusters = await VehicleCluster.find(filter).select('-kyc.pan').sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: clusters.length, data: clusters });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCluster = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { vehicleClusterOwnerId: id };
    const cluster = await VehicleCluster.findOne(filter).select('-kyc.pan');

    if (!cluster) {
      return res.status(404).json({ success: false, message: 'Cluster not found' });
    }

    res.status(200).json({ success: true, data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getOwnedCluster = async (req, res) => {
  try {
    const ownerId = req.clusterOwnerId;
    if (!ownerId) {
      return res.status(400).json({ success: false, message: 'x-owner-id header is required' });
    }

    const filter = mongoose.Types.ObjectId.isValid(ownerId)
      ? { _id: ownerId }
      : { vehicleClusterOwnerId: ownerId };
    const cluster = await VehicleCluster.findOne(filter).select('-kyc.pan');

    if (!cluster) {
      return res.status(404).json({ success: false, message: 'Cluster not found' });
    }

    res.status(200).json({ success: true, data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getClustersByKycStatus = async (req, res) => {
  try {
    const statuses = ['Verified', 'Rejected', 'Pending'];
    const results = await Promise.all(statuses.map((kycStatus) =>
      VehicleCluster.find({ 'kyc.kycStatus': kycStatus })
        .select('-kyc.pan')
        .sort({ createdAt: -1 })
    ));
    const [verified, rejected, pending] = results;

    res.status(200).json({
      success: true,
      counts: {
        verified: verified.length,
        rejected: rejected.length,
        pending: pending.length
      },
      data: { verified, rejected, pending }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteCluster = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { vehicleClusterOwnerId: id };
    const cluster = await VehicleCluster.findOneAndDelete(filter);

    if (!cluster) {
      return res.status(404).json({ success: false, message: 'Cluster not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Cluster and associated owner record deleted successfully',
      data: { id: cluster._id, vehicleClusterOwnerId: cluster.vehicleClusterOwnerId }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createCluster = async (req, res) => {
  try {
    const { vehicleClusterLocation, vehicleCapacity, vehicleClusterOwnerName, vehicleClusterDetails } = req.body;

    if (!vehicleClusterDetails || !vehicleClusterDetails.email || !vehicleClusterDetails.password) {
      return res.status(400).json({ success: false, message: "Owner email and access password are required." });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const vehicleClusterOwnerId = `VCO-${randomNum}`;
    const kycId = `KYC-${randomNum}`;

    const newCluster = new VehicleCluster({
      vehicleClusterLocation,
      vehicleCapacity,
      vehicleClusterOwnerName,
      vehicleClusterOwnerId,
      vehicleClusterDetails: {
        ...vehicleClusterDetails,
        status: 'Pending'
      },
      kyc: {
        id: kycId,
        pan: null,
        kycStatus: 'Pending'
      },
      loginHistory: [],
      AllEV_vehicleoperator: []
    });

    await newCluster.save();
    res.status(201).json({ success: true, message: "Vehicle cluster created successfully", data: newCluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateCapacity = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicleCapacity } = req.body;

    const cluster = await VehicleCluster.findOneAndUpdate(
      { vehicleClusterOwnerId: id },
      { vehicleCapacity },
      { new: true }
    );

    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    res.status(200).json({ success: true, message: "Vehicle capacity updated successfully", data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicleClusterLocation } = req.body;

    const cluster = await VehicleCluster.findOneAndUpdate(
      { vehicleClusterOwnerId: id },
      { vehicleClusterLocation },
      { new: true }
    );

    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    res.status(200).json({ success: true, message: "Cluster location updated successfully", data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateOwnerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerName, pan, email, password, image, status } = req.body;
    const userRole = req.headers['x-user-role'];

    const cluster = await VehicleCluster.findOne({ 
      $or: [{ vehicleClusterOwnerId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] 
    });
    
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    if (ownerName) {
      cluster.vehicleClusterOwnerName = ownerName;
      cluster.vehicleClusterDetails.ownerName = ownerName;
    }
    if (pan !== undefined) cluster.vehicleClusterDetails.pan = pan;
    if (email) cluster.vehicleClusterDetails.email = email;
    if (password && password.trim() !== "") {
      cluster.vehicleClusterDetails.password = password;
    }
    if (image !== undefined) cluster.vehicleClusterDetails.image = image;

    if (status && userRole === 'super-admin') {
      cluster.vehicleClusterDetails.status = status;
    }

    await cluster.save();
    res.status(200).json({ success: true, message: "Cluster details & status updated successfully", data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.verifyOwnerLogin = async (req, res) => {
  try {
    const { clusterId, email, password } = req.body;

    const query = clusterId 
      ? { $or: [{ _id: mongoose.Types.ObjectId.isValid(clusterId) ? clusterId : null }, { vehicleClusterOwnerId: clusterId }], 'vehicleClusterDetails.email': email }
      : { 'vehicleClusterDetails.email': email };

    const cluster = await VehicleCluster.findOne(query);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Invalid Cluster ID or Owner Email." });
    }

    if (cluster.vehicleClusterDetails.password !== password) {
      return res.status(401).json({ success: false, message: "Incorrect password. Credentials mismatch." });
    }

    const currentStatus = cluster.vehicleClusterDetails.status;
    if (currentStatus === 'Restricted' || currentStatus === 'Rejected') {
      return res.status(403).json({ 
        success: false, 
        message: `You are restricted to login. Your account status is currently ${currentStatus}. Please contact the Super Admin.` 
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'Unknown IP';
    cluster.loginHistory.push({
      loginTime: new Date(),
      ipAddress: clientIp
    });
    await cluster.save();

    res.status(200).json({
      success: true,
      message: "Owner login verified successfully",
      data: {
        clusterId: cluster._id,
        ownerId: cluster.vehicleClusterOwnerId,
        ownerName: cluster.vehicleClusterDetails.ownerName || cluster.vehicleClusterOwnerName,
        email: cluster.vehicleClusterDetails.email,
        status: currentStatus,
        loginHistoryCount: cluster.loginHistory.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.submitKyc = async (req, res) => {
  try {
    const clusterId = req.params.id;
    const { pan, documentUrl } = req.body;

    if (!pan || !documentUrl) {
      return res.status(400).json({
        success: false,
        message: "Government ID number and Document URL are required."
      });
    }

    const cluster = await VehicleCluster.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(clusterId) ? [{ _id: clusterId }] : []),
        { vehicleClusterOwnerId: clusterId },
        { "kyc.kycId": clusterId }
      ]
    });

    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster record not found." });
    }

    const existingKycId = cluster.kyc?.kycId || ("KYC-" + Math.floor(100000 + Math.random() * 900000));

    // Update KYC details and reset status to Pending for re-submission
    cluster.kyc = {
      kycId: existingKycId,
      pan: pan,
      documentUrl: documentUrl,
      kycStatus: "Pending",
      rejectionReason: "",
      submittedAt: new Date()
    };

    await cluster.save();

    res.status(200).json({
      success: true,
      message: "KYC submitted successfully. Status is now Pending.",
      data: cluster.kyc
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. GET KYC STATUS & DETAILS (Check current status & ID)
exports.getKycStatus = async (req, res) => {
  try {
    const clusterId = req.params.id;

    const cluster = await VehicleCluster.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(clusterId) ? [{ _id: clusterId }] : []),
        { vehicleClusterOwnerId: clusterId },
        { "kyc.kycId": clusterId }
      ]
    });

    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster record not found." });
    }

    res.status(200).json({
      success: true,
      data: {
        clusterId: cluster._id,
        ownerId: cluster.vehicleClusterOwnerId,
        kyc: cluster.kyc
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. ADMIN: VERIFY OR REJECT KYC STATUS
exports.verifyKycStatus = async (req, res) => {
  try {
    const clusterId = req.params.id;
    const { kycStatus, rejectionReason } = req.body;

    if (!['Verified', 'Rejected'].includes(kycStatus)) {
      return res.status(400).json({
        success: false,
        message: "kycStatus must be either 'Verified' or 'Rejected'."
      });
    }

    const cluster = await VehicleCluster.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(clusterId) ? [{ _id: clusterId }] : []),
        { vehicleClusterOwnerId: clusterId },
        { "kyc.kycId": clusterId }
      ]
    });

    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster record not found." });
    }

    cluster.kyc.kycStatus = kycStatus;
    if (kycStatus === 'Verified') {
      cluster.kyc.rejectionReason = "";
      if (cluster.vehicleClusterDetails) {
        cluster.vehicleClusterDetails.status = 'Active';
      }
    } else if (kycStatus === 'Rejected') {
      cluster.kyc.rejectionReason = rejectionReason || "Documents did not meet the requirements.";
    }

    await cluster.save();

    res.status(200).json({
      success: true,
      message: `KYC status updated to ${kycStatus}`,
      data: cluster.kyc
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 4. ADMIN: GET ALL KYC REQUESTS (Categorized: Pending, Rejected, Verified)
// Example Controller Function for Backend
exports.getAllKycRequests = async (req, res) => {
  try {
    const { status = 'Pending', page = 1, limit = 5 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 5;
    const skip = (pageNum - 1) * limitNum;

    // Strict query matching the exact kycStatus in database
    const query = {
      "kyc.kycStatus": status,
      "kyc.pan": { $exists: true, $ne: "" }
    };

    const totalRequests = await VehicleCluster.countDocuments(query);
    const clusters = await VehicleCluster.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ "kyc.submittedAt": -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: clusters,
      currentPage: pageNum,
      totalPages: Math.ceil(totalRequests / limitNum) || 1,
      totalItems: totalRequests
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.addVehicleOperator = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const operatorData = req.body;

    const cluster = await VehicleCluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    if (!operatorData.vehicleId) {
      const randomVehNum = Math.floor(1000000000 + Math.random() * 9000000000);
      operatorData.vehicleId = `EV-${randomVehNum}`;
    }

    cluster.AllEV_vehicleoperator.push(operatorData);
    await cluster.save();

    res.status(201).json({ success: true, message: "Vehicle added to cluster successfully", data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getVehicleOperators = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const cluster = await VehicleCluster.findById(clusterId).select('AllEV_vehicleoperator vehicleClusterOwnerName vehicleCapacity');
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }
    res.status(200).json({ success: true, data: cluster.AllEV_vehicleoperator });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteVehicleOperator = async (req, res) => {
  try {
    const { clusterId, operatorRecordId } = req.params;
    const cluster = await VehicleCluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }
    cluster.AllEV_vehicleoperator = cluster.AllEV_vehicleoperator.filter(
      (op) => op._id.toString() !== operatorRecordId
    );
    await cluster.save();
    res.status(200).json({ success: true, message: "Vehicle operator record removed successfully", data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.verifyOwnerLogin = async (req, res) => {
  try {
    const { clusterId, email, password } = req.body;

    if (!clusterId || !password) {
      return res.status(400).json({
        success: false,
        message: "Cluster ID / Owner ID and Password are required."
      });
    }

    // Lookup cluster by MongoDB _id OR vehicleClusterOwnerId
    const queryConditions = [];

    if (mongoose.Types.ObjectId.isValid(clusterId)) {
      queryConditions.push({ _id: clusterId });
    }
    queryConditions.push({ vehicleClusterOwnerId: clusterId });

    const cluster = await VehicleCluster.findOne({ $or: queryConditions });

    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: "Invalid Cluster ID or Owner ID. Record not found."
      });
    }

    // Email validation check (if provided in request)
    if (email && cluster.vehicleClusterDetails?.email) {
      if (cluster.vehicleClusterDetails.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(401).json({
          success: false,
          message: "Email ID does not match with this cluster record."
        });
      }
    }

    // Password validation check
    const storedPassword = cluster.vehicleClusterDetails?.password;
    if (storedPassword !== password) {
      return res.status(401).json({
        success: false,
        message: "Incorrect access password. Please try again."
      });
    }

    // Status / Account Access Guard Check
    const currentStatus = cluster.vehicleClusterDetails?.status || "Pending";
    if (currentStatus === "Restricted" || currentStatus === "Rejected") {
      return res.status(403).json({
        success: false,
        message: `Login Access Denied. Your account status is currently set to '${currentStatus}'. Please contact Super Admin.`
      });
    }

    // Record login timestamp & IP in loginHistory array
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    if (!cluster.loginHistory) cluster.loginHistory = [];
    cluster.loginHistory.push({
      loginTime: new Date(),
      ipAddress: clientIp
    });

    await cluster.save();

    res.status(200).json({
      success: true,
      message: "Authentication successful",
      data: {
        clusterId: cluster._id,
        ownerId: cluster.vehicleClusterOwnerId,
        ownerName: cluster.vehicleClusterDetails?.ownerName || cluster.vehicleClusterOwnerName,
        email: cluster.vehicleClusterDetails?.email,
        status: currentStatus,
        kycStatus: cluster.kyc?.kycStatus || "Pending"
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error during verification.",
      error: error.message
    });
  }
};