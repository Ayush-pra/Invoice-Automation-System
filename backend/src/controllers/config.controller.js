import UserVendorConfig from '../models/UserVendorConfig.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getConfig = asyncHandler(async (req, res) => {
  let config = await UserVendorConfig.findOne({ userId: req.user._id }).populate('selectedVendors');
  
  if (!config) {
    config = await UserVendorConfig.create({
      userId: req.user._id,
      selectedVendors: [],
      scanDurationDays: 90,
      confidenceThreshold: 60
    });
  }

  res.json({
    success: true,
    data: config
  });
});

export const updateConfig = asyncHandler(async (req, res) => {
  const { selectedVendors, scanDurationDays, confidenceThreshold } = req.body;
  
  const updateData = {};
  if (selectedVendors) updateData.selectedVendors = selectedVendors;
  if (scanDurationDays) updateData.scanDurationDays = scanDurationDays;
  if (confidenceThreshold !== undefined) updateData.confidenceThreshold = confidenceThreshold;

  const config = await UserVendorConfig.findOneAndUpdate(
    { userId: req.user._id },
    { $set: updateData },
    { new: true, upsert: true }
  ).populate('selectedVendors');

  res.json({
    success: true,
    data: config
  });
});
