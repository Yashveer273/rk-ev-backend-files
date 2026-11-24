const mongoose = require('mongoose');
const VehicleCluster = require('../models/VehicleCluster');

const splitValues = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


const EVClusterHistory = require('../models/EVClusterHistory');
const fleetServerUrl = `http://${process.env.HOST}:5003`;
const STORE_PROJECTION = {
  _id: 1,
  vehicleClusterOwnerId: 1,
  vehicleCapacity: 1,
  'vehicleClusterLocation.lat': 1,
  'vehicleClusterLocation.long': 1,
  'vehicleClusterLocation.zipCode': 1,
  'vehicleClusterLocation.state': 1,
  'vehicleClusterLocation.city': 1,
  'vehicleClusterLocation.streetAddress': 1,
};





function getDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toStoreModelJson(doc) {
  const loc = doc.vehicleClusterLocation || {};
  return {
    _id: String(doc._id),
    vehicleClusterOwnerId: doc.vehicleClusterOwnerId || '',
    vehicleCapacity: Number(doc.vehicleCapacity) || 0,
    vehicleClusterLocation: {
      lat: Number(loc.lat) || 0,
      long: Number(loc.long) || 0,
      zipCode: loc.zipCode || '',
      state: loc.state || '',
      city: loc.city || '',
      streetAddress: loc.streetAddress || '',
    },
  };
}

async function getRandomStores(size = 5) {
  const docs = await VehicleCluster.aggregate([
    { $sample: { size } },
    { $project: STORE_PROJECTION },
  ]);
  return docs.map(toStoreModelJson);
}

function buildNearestFromPool(pool, { userLat, userLong, zipCode, city, state, streetAddress, q }) {
  const zipSet = new Set(zipCode ? splitValues(zipCode).map((z) => z.toLowerCase()) : []);
  const cityLower = city ? city.trim().toLowerCase() : '';
  const stateLower = state ? state.trim().toLowerCase() : '';
  const streetLower = streetAddress ? streetAddress.trim().toLowerCase() : '';
  const qLower = q ? String(q).trim().toLowerCase() : '';

  const scored = [];

  for (const doc of pool) {
    const loc = doc.vehicleClusterLocation || {};
    const dZip = String(loc.zipCode || '').toLowerCase();
    const dCity = String(loc.city || '').toLowerCase();
    const dState = String(loc.state || '').toLowerCase();
    const dStreet = String(loc.streetAddress || '').toLowerCase();

    let matchScore = 0;
    let isMatched = false;

    if (zipSet.size && zipSet.has(dZip)) {
      matchScore += 100;
      isMatched = true;
    }
    if (cityLower && dCity === cityLower) {
      matchScore += 60;
      isMatched = true;
    }
    if (streetLower && dStreet.includes(streetLower)) {
      matchScore += 50;
      isMatched = true;
    }
    if (stateLower && dState === stateLower) {
      matchScore += 30;
      isMatched = true;
    }
    if (
      qLower &&
      (dZip.includes(qLower) ||
        dCity.includes(qLower) ||
        dState.includes(qLower) ||
        dStreet.includes(qLower))
    ) {
      matchScore += 40;
      isMatched = true;
    }

    const hasCoords =
      userLat !== null &&
      userLong !== null &&
      typeof loc.lat === 'number' &&
      typeof loc.long === 'number';

    const distKm = hasCoords
      ? getDistanceKm(userLat, userLong, loc.lat, loc.long)
      : Number.POSITIVE_INFINITY;

    if (hasCoords) isMatched = true;

    scored.push({ doc, isMatched, matchScore, distKm });
  }

  const matchedOnly = scored.filter((item) => item.isMatched);
  if (!matchedOnly.length) return null;

  matchedOnly.sort((a, b) =>
    b.matchScore !== a.matchScore ? b.matchScore - a.matchScore : a.distKm - b.distKm
  );

  const targetCount = Math.min(15, Math.max(10, matchedOnly.length));
  const pickedIds = new Set();
  const selected = [];

  for (const item of matchedOnly.slice(0, targetCount)) {
    const id = String(item.doc._id);
    if (!pickedIds.has(id)) {
      pickedIds.add(id);
      selected.push(toStoreModelJson(item.doc));
    }
  }

  if (selected.length < 10 && pool.length >= 10) {
    const byDistance = [...scored].sort((a, b) => a.distKm - b.distKm);
    for (const item of byDistance) {
      if (selected.length >= 10) break;
      const id = String(item.doc._id);
      if (!pickedIds.has(id)) {
        pickedIds.add(id);
        selected.push(toStoreModelJson(item.doc));
      }
    }
  }

  return selected;
}

exports.getStoresForApp = async (req, res) => {
  try {
    const {
      id,
      ownerId,
      ownerName,
      q,
      zipCode,
      state,
      city,
      streetAddress,
      lat,
      long,
      status,
      kycStatus,
      from,
      to,
    } = req.query;

    let userLat = null;
    let userLong = null;

    if (lat !== undefined && lat !== '') {
      userLat = Number(lat);
      if (!Number.isFinite(userLat)) {
        return res.status(400).json({ success: false, message: 'lat must be a valid number' });
      }
    }
    if (long !== undefined && long !== '') {
      userLong = Number(long);
      if (!Number.isFinite(userLong)) {
        return res.status(400).json({ success: false, message: 'long must be a valid number' });
      }
    }

    const conditions = [];

    if (id) {
      const ids = splitValues(id);
      const objectIds = ids.filter((v) => mongoose.Types.ObjectId.isValid(v));
      const ownerIds = ids.filter((v) => !objectIds.includes(v));
      const idOr = [];
      if (objectIds.length) idOr.push({ _id: { $in: objectIds } });
      if (ownerIds.length) idOr.push({ vehicleClusterOwnerId: { $in: ownerIds } });
      if (idOr.length) conditions.push({ $or: idOr });
    }

    if (ownerId) {
      conditions.push({ vehicleClusterOwnerId: { $in: splitValues(ownerId) } });
    }

    if (ownerName) {
      const rx = new RegExp(escapeRegex(ownerName.trim()), 'i');
      conditions.push({
        $or: [{ vehicleClusterOwnerName: rx }, { 'vehicleClusterDetails.ownerName': rx }],
      });
    }

    if (zipCode) {
      conditions.push({ 'vehicleClusterLocation.zipCode': { $in: splitValues(zipCode) } });
    }
    if (state) {
      conditions.push({
        'vehicleClusterLocation.state': new RegExp(`^${escapeRegex(state.trim())}$`, 'i'),
      });
    }
    if (city) {
      conditions.push({
        'vehicleClusterLocation.city': new RegExp(`^${escapeRegex(city.trim())}$`, 'i'),
      });
    }
    if (streetAddress) {
      conditions.push({
        'vehicleClusterLocation.streetAddress': new RegExp(escapeRegex(streetAddress.trim()), 'i'),
      });
    }

    if (q && String(q).trim()) {
      const qRx = new RegExp(escapeRegex(String(q).trim()), 'i');
      conditions.push({
        $or: [
          { vehicleClusterOwnerId: qRx },
          { 'vehicleClusterLocation.zipCode': qRx },
          { 'vehicleClusterLocation.state': qRx },
          { 'vehicleClusterLocation.city': qRx },
          { 'vehicleClusterLocation.streetAddress': qRx },
        ],
      });
    }

    if (status) {
      conditions.push({ 'vehicleClusterDetails.status': { $in: splitValues(status) } });
    }
    if (kycStatus) {
      conditions.push({ 'kyc.kycStatus': { $in: splitValues(kycStatus) } });
    }

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

    const hasSearchFilter = conditions.length > 0;
    const searchFilter = conditions.length > 1 ? { $and: conditions } : conditions[0] || {};
    const hasLocationInput =
      (userLat !== null && userLong !== null) ||
      Boolean(zipCode || city || state || streetAddress || (q && String(q).trim()));

    const randomCount = Math.floor(Math.random() * 2) + 4; // 4 or 5

    // Fast path: No search filter -> single query powers both arrays
    if (!hasSearchFilter) {
      const allDocs = await VehicleCluster.find({}, STORE_PROJECTION).lean();
      const searchStores = allDocs.map(toStoreModelJson);

      let nearestStores = [];
      if (hasLocationInput && allDocs.length) {
        nearestStores =
          buildNearestFromPool(allDocs, {
            userLat,
            userLong,
            zipCode,
            city,
            state,
            streetAddress,
            q,
          }) || (await getRandomStores(randomCount));
      } else if (allDocs.length) {
        nearestStores = searchStores.slice(0, Math.min(searchStores.length, randomCount));
      }

      return res.status(200).json({ nearestStores, searchStores });
    }

    // Filtered search path
    const matchedDocs = await VehicleCluster.find(searchFilter, STORE_PROJECTION).lean();
    const searchStores = matchedDocs.map(toStoreModelJson);

    let nearestStores = [];
    if (hasLocationInput) {
      const pool =
        matchedDocs.length >= 10
          ? matchedDocs
          : await VehicleCluster.find({}, STORE_PROJECTION).lean();

      nearestStores =
        buildNearestFromPool(pool, {
          userLat,
          userLong,
          zipCode,
          city,
          state,
          streetAddress,
          q,
        }) || (await getRandomStores(randomCount));
    } else {
      nearestStores = await getRandomStores(randomCount);
    }

    return res.status(200).json({ nearestStores, searchStores });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


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

    // Generate unique Owner ID
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const vehicleClusterOwnerId = `VCO-${randomNum}`;

    const newCluster = new VehicleCluster({
      vehicleClusterLocation,
      vehicleCapacity,
      vehicleClusterOwnerName,
      vehicleClusterOwnerId,
      vehicleClusterDetails: {
        ...vehicleClusterDetails,
        status: 'Pending'
      },
      // KYC को यहाँ से पूरी तरह हटा दिया गया है, क्योंकि यह क्रिएशन टाइम पर जरूरी नहीं है 
      // (इसे यूजर बाद में KYC सबमिट फॉर्म के जरिए अपडेट करेगा)
      loginHistory: [],
      vehicles: [] // या आपका पुराना नाम 'AllEV_vehicleoperator: []' जो भी आपके मॉडल में हो
    });

    await newCluster.save();
    
    res.status(201).json({ 
      success: true, 
      message: "Vehicle cluster created successfully", 
      data: newCluster 
    });
    
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
        message: "Cluster ID / Owner ID and Password are required.",
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
        message: "Invalid Cluster ID or Owner ID. Record not found.",
      });
    }

    // Email validation check (if provided in request)
    if (email && cluster.vehicleClusterDetails?.email) {
      if (
        cluster.vehicleClusterDetails.email.toLowerCase() !==
        String(email).toLowerCase()
      ) {
        return res.status(401).json({
          success: false,
          message: "Email ID does not match with this cluster record.",
        });
      }
    }

    // Password validation check
    const storedPassword = cluster.vehicleClusterDetails?.password;
    if (storedPassword !== password) {
      return res.status(401).json({
        success: false,
        message: "Incorrect access password. Please try again.",
      });
    }

    // Status / Account Access Guard Check
    const currentStatus = cluster.vehicleClusterDetails?.status || "Pending";
    if (currentStatus === "Restricted" || currentStatus === "Rejected") {
      return res.status(403).json({
        success: false,
        message: `Login Access Denied. Your account status is currently set to '${currentStatus}'. Please contact Super Admin.`,
      });
    }

    // Normalize empty/legacy kycStatus before saving
    const validKycStatuses = ["Pending", "Verified", "Rejected"];
    if (!cluster.kyc) {
      cluster.kyc = {};
    }
    if (!validKycStatuses.includes(cluster.kyc.kycStatus)) {
      cluster.kyc.kycStatus = "Pending";
    }

    // Record login timestamp & IP in loginHistory array
    const clientIp =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    if (!cluster.loginHistory) cluster.loginHistory = [];
    cluster.loginHistory.push({
      loginTime: new Date(),
      ipAddress: clientIp,
    });

    await cluster.save();

    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      data: {
        clusterId: cluster._id,
        ownerId: cluster.vehicleClusterOwnerId,
        ownerName:
          cluster.vehicleClusterDetails?.ownerName ||
          cluster.vehicleClusterOwnerName,
        email: cluster.vehicleClusterDetails?.email,
        status: currentStatus,
        kycStatus: cluster.kyc?.kycStatus || "Pending",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during verification.",
      error: error.message,
    });
  }
};



exports.assignVehiclesBulk = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { vehicles } = req.body; 

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return res.status(400).json({ success: false, message: "Vehicles array is required and cannot be empty." });
    }

    const cluster = await VehicleCluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found." });
    }

    const existingVehicleIds = new Set(cluster.vehicles.map(v => v.vehicleId));
    const vehiclePayloadForFleet = []; // 👈 यहाँ हम vehicleId और historyId दोनों भेजेंगे

    for (let incomingVehicle of vehicles) {
      const { vehicleId } = incomingVehicle;

      if (!vehicleId) {
        return res.status(400).json({ success: false, message: "Each vehicle object must contain a vehicleId." });
      }

      if (existingVehicleIds.has(vehicleId)) {
        return res.status(400).json({ success: false, message: `Vehicle ID ${vehicleId} already exists in this cluster.` });
      }

      const newVehicleEntry = {
        vehicleId: vehicleId,
        investorId: null,
        assignVehicleAt: new Date().toISOString(),
        removeVehicleAt: null,
        operatorInfo: {
          operatorId: null,
          startDate: null,
          endDate: null,
          status: 'Pending'
        }
      };

      cluster.vehicles.push(newVehicleEntry);
      existingVehicleIds.add(vehicleId);

      // History Management (EVClusterHistory)
      let historyRecord = await EVClusterHistory.findOne({ vehicleId });
      if (!historyRecord) {
        historyRecord = new EVClusterHistory({
          vehicleId,
          associations: [
            {
              clusterId: cluster._id.toString(),
              assignedAt: new Date(),
              unassignedAt: null,
              status: 'Active'
            }
          ]
        });
      } else {
        historyRecord.associations.forEach(assoc => {
          if (assoc.status === 'Active') {
            assoc.status = 'Transferred';
            assoc.unassignedAt = new Date();
          }
        });

        historyRecord.associations.push({
          clusterId: cluster._id.toString(),
          assignedAt: new Date(),
          unassignedAt: null,
          status: 'Active'
        });
      }
      await historyRecord.save();

      // 👈 इस वाहन की History ID को पेलोड में जोड़ें
      vehiclePayloadForFleet.push({
        vehicleId: vehicleId,
        historyReferenceId: historyRecord._id.toString()
      });
    }

    await cluster.save();

    // ==========================================
    // Server-to-Server Call to EV Fleet Server
    // ==========================================
    try {
      
      
      const syncResponse = await fetch(`${fleetServerUrl}/api/vehicle-assign-closter-info/bulk-assign-with-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: cluster._id.toString(),
          vehicles: vehiclePayloadForFleet // 👈 यहाँ हम एरे भेज रहे हैं जिसमें vehicleId और historyReferenceId दोनों हैं
        })
      });

      const syncResult = await syncResponse.json();
      if (!syncResult.success) {
        console.error('Failed to sync assignment with EV Fleet Server:', syncResult.message);
      } else {
        console.log('Successfully synced assignment and history reference with EV Fleet Server.');
      }
    } catch (syncError) {
      console.error('Failed to sync assignment with EV Fleet Server:', syncError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Vehicles assigned successfully in bulk and synced with fleet server.",
      data: cluster
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// PUT API: क्लस्टर के अंदर असाइन किए गए व्हीकल का डेटा (Investor ID या Operator Info) अपडेट करने के लिए
exports.updateAssignedVehicle = async (req, res) => {
  try {
    const { clusterId, vehicleId } = req.params;
    const { investorId, operatorInfo } = req.body;

    const cluster = await VehicleCluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found." });
    }

    // क्लस्टर के vehicles एरे में से उस विशिष्ट वाहन को ढूंढें
    const vehicleItem = cluster.vehicles.find(v => v.vehicleId === vehicleId);
    if (!vehicleItem) {
      return res.status(404).json({ success: false, message: "Vehicle not found in this cluster." });
    }

    // 1. Investor ID अपडेट करें यदि भेजा गया हो
    if (investorId !== undefined) {
      vehicleItem.investorId = investorId;
    }

    // 2. Operator Info अपडेट करें यदि भेजा गया हो
    if (operatorInfo) {
      if (operatorInfo.operatorId !== undefined) vehicleItem.operatorInfo.operatorId = operatorInfo.operatorId;
      if (operatorInfo.startDate !== undefined) vehicleItem.operatorInfo.startDate = operatorInfo.startDate;
      if (operatorInfo.endDate !== undefined) vehicleItem.operatorInfo.endDate = operatorInfo.endDate;
      if (operatorInfo.status !== undefined) vehicleItem.operatorInfo.status = operatorInfo.status;
    }

    await cluster.save();

    return res.status(200).json({
      success: true,
      message: "Vehicle details updated successfully in cluster.",
      data: vehicleItem
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 3. DELETE API: क्लस्टर से व्हीकल को हटाने (Unassign/Remove) के लिए
exports.removeVehicleFromCluster = async (req, res) => {
  try {
    const { clusterId, vehicleId } = req.params;

    const cluster = await VehicleCluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found." });
    }

    const vehicleItem = cluster.vehicles.find(v => v.vehicleId === vehicleId);
    if (!vehicleItem) {
      return res.status(404).json({ success: false, message: "Vehicle not found in this cluster." });
    }

    // रिमूवल टाइम सेट करें
    vehicleItem.removeVehicleAt = new Date().toISOString();

    // एरे से फिल्टर करके हटा रहे हैं
    cluster.vehicles = cluster.vehicles.filter(v => v.vehicleId !== vehicleId);
    await cluster.save();

    // हिस्ट्री अपडेट करें (Unassigned status करें)
    const historyRecord = await EVClusterHistory.findOne({ vehicleId });
    if (historyRecord) {
      historyRecord.associations.forEach(assoc => {
        if (assoc.clusterId === clusterId.toString() && assoc.status === 'Active') {
          assoc.status = 'Unassigned';
          assoc.unassignedAt = new Date();
        }
      });
      await historyRecord.save();
    }

    // ==========================================
    // Server-to-Server DELETE Call to EV Fleet Server
    // ==========================================
    try {
      
      
      const syncResponse = await fetch(`${fleetServerUrl}/api/vehicle-assign-closter-info/${vehicleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const syncResult = await syncResponse.json();
      if (!syncResult.success) {
        console.error('Failed to sync vehicle removal with EV Fleet Server:', syncResult.message);
      } else {
        console.log(`Vehicle ${vehicleId} successfully unassigned on EV Fleet Server.`);
      }
    } catch (syncError) {
      console.error('Failed to sync vehicle removal with EV Fleet Server:', syncError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle removed from cluster successfully and synced with fleet server.",
      data: { vehicleId, removeVehicleAt: vehicleItem.removeVehicleAt }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};


// GET: पेजिनेशन और व्हीकल आईडी सर्च के साथ क्लस्टर के व्हीकल्स प्राप्त करना
exports.getClusterVehicles = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { page = 1, limit = 30, search = '' } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 30;
    const skip = (pageNum - 1) * limitNum;

    const filter = mongoose.Types.ObjectId.isValid(clusterId)
      ? { _id: clusterId }
      : { vehicleClusterOwnerId: clusterId };

    const cluster = await VehicleCluster.findOne(filter)
      .select('vehicles vehicleClusterOwnerName vehicleCapacity');

    if (!cluster) {
      return res.status(404).json({ success: false, message: "Cluster not found" });
    }

    let vehiclesList = cluster.vehicles || [];

    // यदि सर्च टर्म (vehicleId) दिया गया है, तो फ़िल्टर करें
    if (search && search.trim() !== '') {
      const searchTerm = search.trim().toLowerCase();
      vehiclesList = vehiclesList.filter(v => 
        v.vehicleId && v.vehicleId.toLowerCase().includes(searchTerm)
      );
    }

    const totalVehicles = vehiclesList.length;
    
    // फ़िल्टर किए गए डेटा पर पेजिनेशन लागू करना (Slice)
    const paginatedVehicles = vehiclesList.slice(skip, skip + limitNum);

    res.status(200).json({ 
      success: true, 
      currentPage: pageNum,
      totalPages: Math.ceil(totalVehicles / limitNum) || 1,
      totalRecords: totalVehicles,
      count: paginatedVehicles.length, 
      data: paginatedVehicles 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};