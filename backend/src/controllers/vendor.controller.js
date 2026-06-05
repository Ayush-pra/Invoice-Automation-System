import VendorCatalog from '../models/VendorCatalog.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getVendors = asyncHandler(async (req, res) => {
  const vendors = await VendorCatalog.find({ active: true }).sort({ name: 1 }).lean();
  
  // Group by category
  const grouped = vendors.reduce((acc, vendor) => {
    if (!acc[vendor.category]) {
      acc[vendor.category] = [];
    }
    acc[vendor.category].push(vendor);
    return acc;
  }, {});

  res.json({
    success: true,
    data: grouped
  });
});

export const searchVendors = asyncHandler(async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.json({ success: true, data: [] });
  }

  const vendors = await VendorCatalog.find(
    { $text: { $search: q }, active: true },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).lean();

  res.json({
    success: true,
    data: vendors
  });
});
