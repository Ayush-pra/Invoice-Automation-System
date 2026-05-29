import { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchVendorCatalog } from '../store/slices/vendorSlice';
import { fetchConfig, updateConfig, clearConfigError } from '../store/slices/configSlice';
import { HiOutlineSearch, HiOutlineCheckCircle, HiOutlineSave } from 'react-icons/hi';

const SettingsPage = () => {
  const dispatch = useDispatch();
  
  const { catalog, loading: vendorsLoading } = useSelector((state) => state.vendors);
  const { data: config, loading: configLoading, saving, error } = useSelector((state) => state.config);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [scanDurationDays, setScanDurationDays] = useState(90);
  const [confidenceThreshold, setConfidenceThreshold] = useState(60);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    dispatch(fetchVendorCatalog());
    dispatch(fetchConfig());
  }, [dispatch]);

  // Load config into local state
  useEffect(() => {
    if (config) {
      setSelectedVendors(config.selectedVendors.map(v => v._id));
      setScanDurationDays(config.scanDurationDays || 90);
      setConfidenceThreshold(config.confidenceThreshold || 60);
    }
  }, [config]);

  const handleToggleVendor = (vendorId) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const handleSave = async () => {
    const result = await dispatch(updateConfig({
      selectedVendors,
      scanDurationDays: Number(scanDurationDays),
      confidenceThreshold: Number(confidenceThreshold)
    }));

    if (updateConfig.fulfilled.match(result)) {
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // Filter catalog based on search
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog;

    const query = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(catalog).forEach(([category, vendors]) => {
      const matchingVendors = vendors.filter(v => {
        const matchesName = v.name.toLowerCase().includes(query);
        const matchesAlias = v.aliases && v.aliases.some(alias => alias.toLowerCase().includes(query));
        return matchesName || matchesAlias;
      });
      if (matchingVendors.length > 0) {
        filtered[category] = matchingVendors;
      }
    });

    return filtered;
  }, [catalog, searchQuery]);

  if (vendorsLoading || configLoading) {
    return (
      <div className="page-container">
        <div className="loading-spinner mx-auto mt-8" />
        <p className="text-center mt-4">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your vendor preferences and sync options.</p>
        </div>
        <div className="header-actions">
          <button 
            className={`btn btn-primary ${saving ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            <HiOutlineSave size={20} className="icon" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="toast toast-success mb-6">
          <HiOutlineCheckCircle size={24} />
          <div>
            <h4>Success</h4>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="toast toast-error mb-6">
          <div className="toast-content">
            <h4>Error saving config</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Vendor Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="card-title mb-4">Select Vendors to Track</h3>
            <p className="text-sm text-gray-500 mb-6">
              Only invoices from these selected vendors will be imported during sync.
              ({selectedVendors.length} selected)
            </p>

            <div className="search-bar mb-6 relative">
              <HiOutlineSearch className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="text" 
                className="input pl-10 w-full" 
                placeholder="Search vendors (e.g. AWS, Adobe)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="vendor-catalog space-y-8 h-[600px] overflow-y-auto pr-2">
              {Object.keys(filteredCatalog).length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No vendors found matching "{searchQuery}"
                </div>
              ) : (
                Object.entries(filteredCatalog).map(([category, vendors]) => (
                  <div key={category} className="vendor-category">
                    <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2">{category}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {vendors.map(vendor => {
                        const isSelected = selectedVendors.includes(vendor._id);
                        return (
                          <div 
                            key={vendor._id}
                            className={`vendor-chip cursor-pointer border rounded-lg p-3 transition-colors ${
                              isSelected ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => handleToggleVendor(vendor._id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>
                                {vendor.name}
                              </span>
                              {isSelected && <HiOutlineCheckCircle className="text-primary-600" size={20} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Sync Options */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-title mb-4">Sync Preferences</h3>
            
            <div className="form-group mb-6">
              <label className="label block mb-2 font-medium">Scan Duration (Days)</label>
              <select 
                className="input w-full"
                value={scanDurationDays}
                onChange={(e) => setScanDurationDays(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 180 days</option>
                <option value="365">Last 1 year</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">How far back the system searches Gmail.</p>
            </div>

            <div className="form-group mb-6">
              <label className="label block mb-2 font-medium">Confidence Threshold: {confidenceThreshold}</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5"
                className="w-full accent-primary-600"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(e.target.value)}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Loose (0)</span>
                <span>Strict (100)</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Minimum score required to import an invoice. 60 is recommended.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
