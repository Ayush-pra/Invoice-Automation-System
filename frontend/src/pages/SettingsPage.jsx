import { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchVendorCatalog } from '../store/slices/vendorSlice';
import { fetchConfig, updateConfig, clearConfigError } from '../store/slices/configSlice';
import { fetchVendorRegistry, fetchVendorIntegrations } from '../store/slices/vendorIntegrationSlice';
import { HiOutlineSearch, HiOutlineCheckCircle, HiOutlineSave, HiOutlineKey } from 'react-icons/hi';
import VendorCredentialModal from '../components/VendorCredentialModal';

const SettingsPage = () => {
  const dispatch = useDispatch();
  
  const { catalog, loading: vendorsLoading } = useSelector((state) => state.vendors);
  const { data: config, loading: configLoading, saving, error } = useSelector((state) => state.config);
  const { registry, integrations, loadingRegistry } = useSelector((state) => state.vendorIntegration);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [scanDurationDays, setScanDurationDays] = useState(90);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVendorForModal, setSelectedVendorForModal] = useState(null);

  useEffect(() => {
    dispatch(fetchVendorCatalog());
    dispatch(fetchConfig());
    dispatch(fetchVendorRegistry());
    dispatch(fetchVendorIntegrations());
  }, [dispatch]);

  // Load config into local state
  useEffect(() => {
    if (config) {
      setSelectedVendors(config.selectedVendors.map(v => v._id));
      setScanDurationDays(config.scanDurationDays || 90);
    }
  }, [config]);

  const handleToggleVendor = (vendor) => {
    const isSelected = selectedVendors.includes(vendor._id);
    
    if (isSelected) {
      setSelectedVendors(prev => prev.filter(id => id !== vendor._id));
    } else {
      setSelectedVendors(prev => [...prev, vendor._id]);
      
      // Prompt for credentials immediately if API is supported and not already connected
      const caps = registry[vendor.name];
      if (caps && caps.supportsApi && caps.credentials) {
        const isConnected = integrations.some(i => i.vendorName === vendor.name && i.status === 'connected');
        if (!isConnected) {
          setSelectedVendorForModal(vendor.name);
          setModalOpen(true);
        }
      }
    }
  };

  const handleOpenModal = (e, vendorName) => {
    e.stopPropagation();
    setSelectedVendorForModal(vendorName);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const result = await dispatch(updateConfig({
      selectedVendors,
      scanDurationDays: Number(scanDurationDays),
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
            <HiOutlineSave size={18} className="icon" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="toast toast-success mb-6">
          <HiOutlineCheckCircle size={22} />
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
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Select Vendors to Track</h3>
              <p className="text-sm text-gray-500 mb-6">
                Only billing events from selected vendors will be imported during sync.
                <span className="ml-1 font-medium text-blue-600">({selectedVendors.length} selected)</span>
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
                          const caps = registry[vendor.name];
                          const integration = integrations.find(i => i.vendorName === vendor.name);
                          const isConnected = integration?.status === 'connected';

                          return (
                            <div 
                              key={vendor._id}
                              className={`vendor-chip cursor-pointer border rounded-lg p-3 transition-all ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-400 shadow-sm' 
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => handleToggleVendor(vendor)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`font-medium text-sm ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                  {vendor.name}
                                </span>
                                {isSelected && <HiOutlineCheckCircle className="text-blue-600" size={18} />}
                              </div>
                              
                              {/* Connection Status indicator if API supported */}
                              {caps?.supportsApi && caps?.credentials && (
                                <div className="mt-2 text-xs flex justify-between items-center border-t border-gray-200 pt-1">
                                  {isConnected ? (
                                    <span className="text-green-600 font-medium">Connected</span>
                                  ) : (
                                    <span className="text-orange-500 font-medium">Needs Setup</span>
                                  )}
                                  <button 
                                    className="text-gray-500 hover:text-blue-600"
                                    onClick={(e) => handleOpenModal(e, vendor.name)}
                                    title="Configure API Credentials"
                                  >
                                    <HiOutlineKey size={14} />
                                  </button>
                                </div>
                              )}
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
        </div>

        {/* Right Column: Sync Options */}
        <div className="space-y-6">
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Sync Preferences</h3>
              
              <div className="form-group mb-6">
                <label className="label block mb-2 font-medium text-sm text-gray-700">Scan Duration</label>
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
                <p className="text-xs text-gray-400 mt-2">How far back the system searches Gmail for billing emails.</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">How it works</h4>
                <ul className="text-xs text-gray-500 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Emails with a monetary amount and billing keywords are imported
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">✗</span>
                    Security alerts, marketing, and emails without amounts are ignored
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">→</span>
                    Duplicate events (same Order ID / Invoice #) are merged automatically
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      <VendorCredentialModal 
        vendorName={selectedVendorForModal}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default SettingsPage;
