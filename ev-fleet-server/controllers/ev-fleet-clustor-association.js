const EVVehicle = require('../models/EVVehicle');
const crypto = require('crypto');
const zlib = require('zlib'); // 1. Node.js built-in zlib module import karein

exports.getEvsByCases = async (req, res) => {
  try {
    let { type, clusterId, status, page = 1, limit = 15 } = req.query;

    const validTypes = ['free', 'cluster', 'assigned', 'all'];
    const queryType = type ? type.trim().toLowerCase() : 'all';

    if (!validTypes.includes(queryType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid 'type' parameter. Allowed values are 'free', 'cluster', 'assigned', or 'all'."
      });
    }

    let query = {};

    if (queryType === 'free') {
      query['associateCluster.clusterId'] = null;
    } else if (queryType === 'cluster') {
      if (!clusterId || typeof clusterId !== 'string' || clusterId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Valid 'clusterId' string is required when type is 'cluster'."
        });
      }
      query['associateCluster.clusterId'] = clusterId.trim();
    } else if (queryType === 'assigned') {
      query['associateCluster.clusterId'] = { $ne: null };
    }

    if (status) {
      const validStatuses = ['Active', 'In-service', 'Non-active', 'Rejected', 'In Parking'];
      const trimmedStatus = status.trim();
      
      if (!validStatuses.includes(trimmedStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid 'status' parameter. Allowed values are: ${validStatuses.join(', ')}`
        });
      }
      query.status = trimmedStatus;
    }

    const pageNum = parseInt(page, 10);
    let limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) page = 1;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) limitNum = 15;

    const skip = (pageNum - 1) * limitNum;
    
    const allowedFields = 'vehicleId vehicleType vehicleNoPlate companyData pricing vehicleImage status associateCluster vehicleModelName vehicleYearModel vehicleMotorPowerKw batteryCapacityKwh rangeKm topSpeedKmph';

    const vehicles = await EVVehicle.find(query)
      .select(allowedFields)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalRecords = await EVVehicle.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const responsePayload = {
      success: true,
      currentPage: pageNum,
      totalPages: totalPages,
      totalRecords,
      limit: limitNum,
      data: vehicles
    };

    // 2. Check karein ki client gzip support karta hai ya nahi
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const jsonString = JSON.stringify(responsePayload);

    if (acceptEncoding.includes('gzip')) {
      // 3. Agar client gzip accept karta hai, toh data ko COMPRESS karke bhejें
      zlib.gzip(jsonString, (err, compressedBuffer) => {
        if (err) {
          // Fallback agar compression fail ho jaye
          return res.status(200).json(responsePayload);
        }
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).send(compressedBuffer);
      });
    } else {
      // Normal JSON response agar gzip support na ho
      return res.status(200).json(responsePayload);
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};