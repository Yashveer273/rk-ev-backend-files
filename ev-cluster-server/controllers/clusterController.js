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
    const clusters = await VehicleCluster.find(filter).select('-kyc.aadhaar').sort({ createdAt: -1 });

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
    const cluster = await VehicleCluster.findOne(filter).select('-kyc.aadhaar');

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
    const cluster = await VehicleCluster.findOne(filter).select('-kyc.aadhaar');

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
        .select('-kyc.aadhaar')
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

// 1. Super Admin: नया क्लस्टर क्रिएट करना
exports.createCluster = async (req, res) => {
  try {
    const { vehicleClusterLocation, vehicleCapacity, vehicleClusterOwnerName, vehicleClusterDetails } = req.body;

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
        status: 'Pending' // हमेशा शुरुआत में Pending रहेगा, सुपर एडमिन अप्रूव करेगा
      },
      kyc: {
        id: kycId,
        aadhaar: null,
        kycStatus: 'Pending'
      },
      AllEV_vehicleoperator: []
    });

    await newCluster.save();
    res.status(201).json({ success: true, message: "Vehicle cluster created successfully", data: newCluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Super Admin: क्लस्टर की कैपेसिटी बदलना
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

// 3. Super Admin: क्लस्टर की लोकेशन या डिटेल्स अपडेट करना
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

// 4. Super Admin / Owner Details Update
exports.updateOwnerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerName, pan, email, image, status } = req.body;
    const userRole = req.headers['x-user-role'];

    const cluster = await VehicleCluster.findOne({ vehicleClusterOwnerId: id });
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    if (ownerName) cluster.vehicleClusterDetails.ownerName = ownerName;
    if (pan) cluster.vehicleClusterDetails.pan = pan;
    if (email) cluster.vehicleClusterDetails.email = email;
    if (image) cluster.vehicleClusterDetails.image = image;

    // स्टेटस केवल सुपर एडमिन बदल सकता है
    if (status && userRole === 'super-admin') {
      cluster.vehicleClusterDetails.status = status;
    }

    await cluster.save();
    res.status(200).json({ success: true, message: "Owner details updated successfully", data: cluster });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 5. Cluster Owner: केवल अपना आधार (Aadhaar) सबमिट करना (स्टेटस पास/फेल सुपर एडमिन करेगा)
exports.submitKycDetails = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { aadhaar } = req.body; // ओनर अपना आधार नंबर दर्ज करेगा

    const cluster = await VehicleCluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    cluster.kyc.aadhaar = aadhaar;
    cluster.kyc.kycStatus = 'Pending'; // सबमिट होने के बाद वेरिफिकेशन के लिए पेंडिंग रहेगी
    await cluster.save();

    res.status(200).json({ success: true, message: "KYC details submitted successfully, pending review.", data: { kycId: cluster.kyc.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 6. Super Admin: KYC स्टेटस पास या फेल (Verified/Rejected) करना
exports.verifyKycStatus = async (req, res) => {
  try {
    const clusterId = req.params.kycId || req.params.clusterId;
    const { kycStatus } = req.body; // 'Verified' या 'Rejected'

    if (!['Verified', 'Rejected'].includes(kycStatus)) {
      return res.status(400).json({
        success: false,
        message: 'kycStatus must be either Verified or Rejected'
      });
    }

    const lookup = [
      { 'kyc.id': clusterId },
      { vehicleClusterOwnerId: clusterId }
    ];
    if (mongoose.Types.ObjectId.isValid(clusterId)) lookup.push({ _id: clusterId });
    const cluster = await VehicleCluster.findOne({ $or: lookup });
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    cluster.kyc.kycStatus = kycStatus;
    await cluster.save();

    res.status(200).json({
      success: true,
      message: `KYC status updated to ${kycStatus}`,
      data: {
        kyc: {
          id: cluster.kyc.id,
          status: cluster.kyc.kycStatus
        },
        personDetails: {
          ownerId: cluster.vehicleClusterOwnerId,
          ownerName: cluster.vehicleClusterOwnerName,
          profile: {
            ownerName: cluster.vehicleClusterDetails.ownerName,
            pan: cluster.vehicleClusterDetails.pan,
            email: cluster.vehicleClusterDetails.email,
            image: cluster.vehicleClusterDetails.image
          }
        },
        clusterDetails: {
          id: cluster._id,
          location: cluster.vehicleClusterLocation,
          vehicleCapacity: cluster.vehicleCapacity,
          status: cluster.vehicleClusterDetails.status
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 7. Cluster Owner / Manager: अपने क्लस्टर में नया व्हीकल ऑपरेटर जोड़ना
exports.addVehicleOperator = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const operatorData = req.body;

    const cluster = await VehicleCluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    // 10 डिजिट की ऑटो-जनरेटेड व्हीकल आईडी यदि न दी गई हो
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

// 8. Cluster Owner / Manager: क्लस्टर के व्हीकल ऑपरेटर्स की सूची देखना (Get)
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

// 9. Cluster Owner / Manager: क्लस्टर से व्हीकल ऑपरेटर हटाना (Delete)
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