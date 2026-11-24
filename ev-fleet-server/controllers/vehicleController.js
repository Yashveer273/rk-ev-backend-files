const EVVehicle = require('../models/EVVehicle');
const crypto = require('crypto');



const VehicleCluster = require('../models/VehicleCluster');

exports.AppsearchVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID is required',
      });
    }

    const mongoose = require('mongoose');

    const matchConditions = [
      { vehicleId: id },
    ];

    if (mongoose.Types.ObjectId.isValid(id)) {
      matchConditions.push({
        _id: new mongoose.Types.ObjectId(id),
      });
    }

    const collectionName = VehicleCluster.collection.name;

    const vehicles = await EVVehicle.aggregate([
      {
        $match: {
          $or: matchConditions,
        },
      },
      {
        $limit: 1,
      },
      {
        $lookup: {
          from: collectionName,
          let: {
            currentClusterId: '$associateCluster.clusterId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    '$_id',
                    {
                      $convert: {
                        input: '$$currentClusterId',
                        to: 'objectId',
                        onError: null,
                        onNull: null,
                      },
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                vehicleClusterLocation: 1,
              },
            },
          ],
          as: 'clusterData',
        },
      },
      {
        $addFields: {
          vehicleClusterLocation: {
            $ifNull: [
              {
                $arrayElemAt: [
                  '$clusterData.vehicleClusterLocation',
                  0,
                ],
              },
              null,
            ],
          },
        },
      },
      {
        $project: {
          clusterData: 0,
        },
      },
    ]);

    if (!vehicles.length) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vehicle details fetched successfully',
      data: vehicles[0],
    });

  } catch (error) {
    console.error('AppsearchVehicleById Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle details',
      error: error.message,
    });
  }
};


exports.AppsearchVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      vehicleId,
      vehicleType,
      vehicleNoPlate,
      companyName,
      sellerName,
      purchaseLocation,
      status,
      vehicleModelName,
      vehicleYearModel,
      vehicleMotorPowerKw,
      batteryCapacityKwh,
      minRangeKm,
      minTopSpeedKmph,

      investmentAmount,
      minInvestment,
      maxInvestment,
      investorReturnRate,
      mininvestorReturnRate,
      maxinvestorReturnRate,
      outboundRentalRate,
      minOutboundRentalRate,
      maxOutboundRentalRate,

      search,
    } = req.query;

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageLimit = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (currentPage - 1) * pageLimit;

    const query = {};

    if (vehicleId) {
      query.vehicleId = new RegExp(vehicleId, 'i');
    }

    if (vehicleType) {
      query.vehicleType = new RegExp(vehicleType, 'i');
    }

    if (vehicleNoPlate) {
      query.vehicleNoPlate = new RegExp(vehicleNoPlate, 'i');
    }

    if (status) {
      query.status = status;
    }

    if (vehicleModelName) {
      query.vehicleModelName = new RegExp(vehicleModelName, 'i');
    }

    if (vehicleYearModel) {
      query.vehicleYearModel = Number(vehicleYearModel);
    }

    if (companyName) {
      query['companyData.companyName'] = new RegExp(companyName, 'i');
    }

    if (sellerName) {
      query['companyData.sellerName'] = new RegExp(sellerName, 'i');
    }

    if (purchaseLocation) {
      query['companyData.purchaseLocation'] = new RegExp(
        purchaseLocation,
        'i'
      );
    }

    // Investment Amount Filter
    if (investmentAmount !== undefined && investmentAmount !== '') {
      query['pricing.investmentAmount'] = Number(investmentAmount);
    } else if (minInvestment || maxInvestment) {
      query['pricing.investmentAmount'] = {};

      if (minInvestment) {
        query['pricing.investmentAmount'].$gte = Number(minInvestment);
      }

      if (maxInvestment) {
        query['pricing.investmentAmount'].$lte = Number(maxInvestment);
      }
    }

    // Investor Return Rate Filter
    if (
      investorReturnRate !== undefined &&
      investorReturnRate !== ''
    ) {
      query['pricing.investorReturnRate'] = Number(investorReturnRate);
    } else if (mininvestorReturnRate || maxinvestorReturnRate) {
      query['pricing.investorReturnRate'] = {};

      if (mininvestorReturnRate) {
        query['pricing.investorReturnRate'].$gte =
          Number(mininvestorReturnRate);
      }

      if (maxinvestorReturnRate) {
        query['pricing.investorReturnRate'].$lte =
          Number(maxinvestorReturnRate);
      }
    }

    // Outbound Rental Rate Filter
    if (
      outboundRentalRate !== undefined &&
      outboundRentalRate !== ''
    ) {
      query['pricing.outboundRentalRate'] = Number(outboundRentalRate);
    } else if (minOutboundRentalRate || maxOutboundRentalRate) {
      query['pricing.outboundRentalRate'] = {};

      if (minOutboundRentalRate) {
        query['pricing.outboundRentalRate'].$gte =
          Number(minOutboundRentalRate);
      }

      if (maxOutboundRentalRate) {
        query['pricing.outboundRentalRate'].$lte =
          Number(maxOutboundRentalRate);
      }
    }

    if (vehicleMotorPowerKw) {
      query.vehicleMotorPowerKw = Number(vehicleMotorPowerKw);
    }

    if (batteryCapacityKwh) {
      query.batteryCapacityKwh = Number(batteryCapacityKwh);
    }

    if (minRangeKm) {
      query.rangeKm = {
        $gte: Number(minRangeKm),
      };
    }

    if (minTopSpeedKmph) {
      query.topSpeedKmph = {
        $gte: Number(minTopSpeedKmph),
      };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');

      query.$or = [
        { vehicleNoPlate: searchRegex },
        { vehicleModelName: searchRegex },
        { 'companyData.companyName': searchRegex },
        { 'companyData.purchaseLocation': searchRegex },
      ];
    }

    const collectionName = VehicleCluster.collection.name;

    const [vehicles, totalCount] = await Promise.all([
      EVVehicle.aggregate([
        {
          $match: query,
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: pageLimit,
        },
        {
          $lookup: {
            from: collectionName,
            let: {
              currentClusterId: '$associatedCluster.clusterId',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      '$_id',
                      {
                        $convert: {
                          input: '$$currentClusterId',
                          to: 'objectId',
                          onError: null,
                          onNull: null,
                        },
                      },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  vehicleClusterLocation: 1,
                },
              },
            ],
            as: 'clusterData',
          },
        },
        {
          $addFields: {
            vehicleClusterLocation: {
              $ifNull: [
                {
                  $arrayElemAt: [
                    '$clusterData.vehicleClusterLocation',
                    0,
                  ],
                },
                null,
              ],
            },
          },
        },
        {
          $project: {
            clusterData: 0,
          },
        },
      ]),

      EVVehicle.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: vehicles.length,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageLimit),
      currentPage,
      data: vehicles,
    });
  } catch (error) {
    console.error('AppsearchVehicles Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.createVehicle = async (req, res) => {
  try {
    const newVehicle = await EVVehicle.create(req.body);
    res.status(201).json({ success: true, data: newVehicle });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.searchVehicles = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      vehicleId,
      vehicleType, 
      vehicleNoPlate,
      companyName, 
      sellerName,
      purchaseLocation,
      status, 
      vehicleModelName,
      vehicleYearModel,
      vehicleMotorPowerKw,
      batteryCapacityKwh,
      minRangeKm,
      minTopSpeedKmph,
      
      // Independent Financial & Investment Filters
      investmentAmount,
      minInvestment,
      maxInvestment,
      investorReturnRate,
      mininvestorReturnRate,
      maxinvestorReturnRate,
      outboundRentalRate,
      minOutboundRentalRate,
      maxOutboundRentalRate,

      search 
    } = req.query;
    
    let query = {};

    if (vehicleId) query.vehicleId = new RegExp(vehicleId, 'i');
    if (vehicleType) query.vehicleType = new RegExp(vehicleType, 'i');
    if (vehicleNoPlate) query.vehicleNoPlate = new RegExp(vehicleNoPlate, 'i');
    if (status) query.status = status;
    if (vehicleModelName) query.vehicleModelName = new RegExp(vehicleModelName, 'i');
    if (vehicleYearModel) query.vehicleYearModel = Number(vehicleYearModel);
    
    if (companyName) query['companyData.companyName'] = new RegExp(companyName, 'i');
    if (sellerName) query['companyData.sellerName'] = new RegExp(sellerName, 'i');
    if (purchaseLocation) query['companyData.purchaseLocation'] = new RegExp(purchaseLocation, 'i');

    // 1. Investment Amount Filter (For Investors)
    if (investmentAmount !== undefined && investmentAmount !== '') {
      query['pricing.investmentAmount'] = Number(investmentAmount);
    } else if (minInvestment || maxInvestment) {
      query['pricing.investmentAmount'] = {};
      if (minInvestment) query['pricing.investmentAmount'].$gte = Number(minInvestment);
      if (maxInvestment) query['pricing.investmentAmount'].$lte = Number(maxInvestment);
    }

    // 2. Vendor Rental Cost Filter (For Vendors)
    if (investorReturnRate !== undefined && investorReturnRate !== '') {
      query['pricing.investorReturnRate'] = Number(investorReturnRate);
    } else if (mininvestorReturnRate || maxinvestorReturnRate) {
      query['pricing.investorReturnRate'] = {};
      if (mininvestorReturnRate) query['pricing.investorReturnRate'].$gte = Number(mininvestorReturnRate);
      if (maxinvestorReturnRate) query['pricing.investorReturnRate'].$lte = Number(maxinvestorReturnRate);
    }

    // 3. Outbound Rental Rate Filter (For Customer Rentals)
    if (outboundRentalRate !== undefined && outboundRentalRate !== '') {
      query['pricing.outboundRentalRate'] = Number(outboundRentalRate);
    } else if (minOutboundRentalRate || maxOutboundRentalRate) {
      query['pricing.outboundRentalRate'] = {};
      if (minOutboundRentalRate) query['pricing.outboundRentalRate'].$gte = Number(minOutboundRentalRate);
      if (maxOutboundRentalRate) query['pricing.outboundRentalRate'].$lte = Number(maxOutboundRentalRate);
    }

    if (vehicleMotorPowerKw) query.vehicleMotorPowerKw = Number(vehicleMotorPowerKw);
    if (batteryCapacityKwh) query.batteryCapacityKwh = Number(batteryCapacityKwh);
    if (minRangeKm) query.rangeKm = { $gte: Number(minRangeKm) }; 
    if (minTopSpeedKmph) query.topSpeedKmph = { $gte: Number(minTopSpeedKmph) }; 

    if (search) {
      query.$or = [
        { vehicleNoPlate: new RegExp(search, 'i') },
        { vehicleModelName: new RegExp(search, 'i') },
        { 'companyData.companyName': new RegExp(search, 'i') },
        { 'companyData.purchaseLocation': new RegExp(search, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const vehicles = await EVVehicle.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await EVVehicle.countDocuments(query);

    res.status(200).json({
      success: true,
      count: vehicles.length,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      data: vehicles,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id });
    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const updatedVehicle = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id }, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!updatedVehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updatedVehicle });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.deleteVehicle = async (req, res) => {
  try {
    const deletedVehicle = await EVVehicle.findOneAndDelete({ vehicleId: req.params.id });
    if (!deletedVehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getVehicleImages = async (req, res) => {
  try {
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id }).select('vehicleImage');
    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: vehicle.vehicleImage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addOrUpdateVehicleImage = async (req, res) => {
  try {
    const { angle, imgurl, fuel, imageId } = req.body;
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id });

    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });

    if (imageId) {
      const imgIndex = vehicle.vehicleImage.findIndex(img => img.imageId === imageId);
      if (imgIndex > -1) {
        if (angle) vehicle.vehicleImage[imgIndex].angle = angle;
        if (imgurl) vehicle.vehicleImage[imgIndex].imgurl = imgurl;
        if (fuel) vehicle.vehicleImage[imgIndex].fuel = fuel;
      } else {
        return res.status(404).json({ success: false, error: 'Image ID not found' });
      }
    } else {
      const newImgId = 'IMG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      vehicle.vehicleImage.push({ imageId: newImgId, angle, imgurl, fuel });
    }

    await vehicle.save();
    res.status(200).json({ success: true, data: vehicle.vehicleImage });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.deleteVehicleImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const vehicle = await EVVehicle.findOne({ vehicleId: req.params.id });
    if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });

    vehicle.vehicleImage = vehicle.vehicleImage.filter(img => img.imageId !== imageId);
    await vehicle.save();

    res.status(200).json({ success: true, message: 'Image deleted successfully', data: vehicle.vehicleImage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateModelName = async (req, res) => {
  try {
    const { vehicleModelName } = req.body;
    const updated = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id },
      { $set: { vehicleModelName } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateYearModel = async (req, res) => {
  try {
    const { vehicleYearModel } = req.body;
    const updated = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id },
      { $set: { vehicleYearModel: Number(vehicleYearModel) } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await EVVehicle.findOneAndUpdate(
      { vehicleId: req.params.id },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Vehicle not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};


