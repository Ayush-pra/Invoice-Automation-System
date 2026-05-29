import { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchVendorCatalog } from '../store/slices/vendorSlice';
import { fetchConfig, updateConfig } from '../store/slices/configSlice';
import { fetchVendorRegistry, fetchVendorIntegrations } from '../store/slices/vendorIntegrationSlice';
import { HiOutlineSearch, HiOutlineCheckCircle, HiOutlineSave, HiOutlineLightningBolt, HiOutlineMail, HiOutlineExclamationCircle, HiOutlineServer } from 'react-icons/hi';
import VendorCard from '../components/VendorCard';
import VendorDetailDrawer from '../components/VendorDetailDrawer';
import IntegrationWizard from '../components/IntegrationWizard';

const SettingsPage = () => {
  const dispatch = useDispatch();
  
  const { catalog, loading: vendorsLoading } = useSelector((state) => state.vendors);
  const { data: config, loading: configLoading, saving, error } = useSelector((state) => state.config);
  const { registry, integrations, loadingRegistry } = useSelector((state) => state.vendorIntegration);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [scanDurationDays, setScanDurationDays] = useState(90);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Drawer & Wizard State
  const [drawerVendor, setDrawerVendor] = useState(null);
  const [wizardVendor, setWizardVendor] = useState(null);

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
    }
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

  // Flatten catalog for easier filtering
  const allVendors = useMemo(() => {
    const list = [];
    Object.values(catalog).forEach(vendors => list.push(...vendors));
    return list;
  }, [catalog]);

  const categories = ['All', ...Object.keys(catalog)];

  const filteredVendors = useMemo(() => {
    return allVendors.filter(v => {
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (v.aliases && v.aliases.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesCategory = filterCategory === 'All' || v.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allVendors, searchQuery, filterCategory]);

  const connectedVendors = useMemo(() => {
    return allVendors.filter(v => selectedVendors.includes(v._id));
  }, [allVendors, selectedVendors]);

  // Dashboard Stats
  const apiSourcesCount = connectedVendors.filter(v => registry[v.name]?.supportsApi).length;
  const emailSourcesCount = connectedVendors.filter(v => !registry[v.name]?.supportsApi).length;
  const failedConnections = integrations.filter(i => i.status === 'error' || i.status === 'invalid_credentials').length;
  
  const lastSyncTime = useMemo(() => {
    const syncs = integrations.map(i => new Date(i.lastSyncAt).getTime()).filter(t => !isNaN(t));
    if (syncs.length === 0) return 'Never';
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' }).format(new Date(Math.max(...syncs)));
  }, [integrations]);

  if (vendorsLoading || configLoading) {
    return (
      <div className="page-container flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-100 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Loading Integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-20">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrations Hub</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your billing sources, API connections, and sync preferences.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2
              ${saving ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black shadow-sm'}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
            ) : (
              <HiOutlineSave size={16} />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 border border-green-100 animate-fade-in">
          <HiOutlineCheckCircle size={20} className="shrink-0" />
          <span className="font-medium text-sm">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
          <HiOutlineExclamationCircle size={20} className="shrink-0" />
          <span className="font-medium text-sm">{error}</span>
        </div>
      )}

      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <HiOutlineServer size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Active</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{connectedVendors.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-yellow-600 mb-2">
            <HiOutlineLightningBolt size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-700">API Sources</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{apiSourcesCount}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <HiOutlineMail size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Email Scans</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{emailSourcesCount}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider">Issues</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{failedConnections}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Main Column: Marketplace */}
        <div className="lg:col-span-2">
          
          {connectedVendors.length === 0 ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-8 mb-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-blue-600">
                <HiOutlineLightningBolt size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Your First Billing Source</h3>
              <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
                Start automating your billing collection. We recommend connecting major infrastructure and payment providers first via API.
              </p>
            </div>
          ) : (
            <div className="mb-10">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                Connected Integrations <span className="bg-gray-100 text-gray-600 text-xs py-0.5 px-2 rounded-full">{connectedVendors.length}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {connectedVendors.map(vendor => (
                  <VendorCard 
                    key={vendor._id}
                    vendor={vendor}
                    integration={integrations.find(i => i.vendorName === vendor.name)}
                    caps={registry[vendor.name]}
                    isSelected={true}
                    onToggle={handleToggleVendor}
                    onClick={setDrawerVendor}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Integration Marketplace</h3>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <HiOutlineSearch className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                  placeholder="Search providers (e.g., AWS, GitHub)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="sm:w-48">
                <select 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm cursor-pointer"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVendors.length === 0 ? (
                <div className="col-span-full py-10 text-center text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No providers found matching your search.
                </div>
              ) : (
                filteredVendors.filter(v => !selectedVendors.includes(v._id)).map(vendor => (
                  <VendorCard 
                    key={vendor._id}
                    vendor={vendor}
                    integration={integrations.find(i => i.vendorName === vendor.name)}
                    caps={registry[vendor.name]}
                    isSelected={false}
                    onToggle={handleToggleVendor}
                    onClick={setDrawerVendor}
                  />
                ))
              )}
            </div>
          </div>
          
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Sync Preferences</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Historical Scan Depth</label>
              <select 
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm cursor-pointer"
                value={scanDurationDays}
                onChange={(e) => setScanDurationDays(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
                <option value="365">Last 1 year</option>
              </select>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Determines how far back the collection engine searches for API records and emails during a full sync.
              </p>
            </div>
          </div>
        </div>

      </div>

      <VendorDetailDrawer 
        vendor={drawerVendor}
        integration={drawerVendor ? integrations.find(i => i.vendorName === drawerVendor.name) : null}
        caps={drawerVendor ? registry[drawerVendor.name] : null}
        isOpen={!!drawerVendor}
        onClose={() => setDrawerVendor(null)}
        onConnect={(vendor) => {
          setDrawerVendor(null);
          setWizardVendor(vendor);
        }}
      />

      {wizardVendor && (
        <IntegrationWizard 
          vendorName={wizardVendor.name}
          requiredFields={registry[wizardVendor.name]?.credentials?.fields || []}
          isOpen={!!wizardVendor}
          onClose={() => setWizardVendor(null)}
          onSuccess={() => {
            // Ensure the vendor gets toggled ON if they successfully connect API
            if (!selectedVendors.includes(wizardVendor._id)) {
              setSelectedVendors(prev => [...prev, wizardVendor._id]);
            }
            dispatch(fetchVendorIntegrations());
          }}
        />
      )}

    </div>
  );
};

export default SettingsPage;
