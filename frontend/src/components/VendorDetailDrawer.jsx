import { HiOutlineX, HiOutlineLightningBolt, HiOutlineMail, HiOutlineClock, HiOutlineLink, HiOutlineExclamationCircle } from 'react-icons/hi';
import { VENDOR_HELP_CONTENT } from '../config/vendorHelpConstants';

const VendorDetailDrawer = ({ vendor, integration, caps, isOpen, onClose, onConnect }) => {
  if (!isOpen || !vendor) return null;

  const isConnected = integration?.status === 'connected';
  const hasError = integration?.status === 'error' || integration?.status === 'invalid_credentials';
  const collectionMethod = caps?.supportsApi ? 'API' : 'Email';
  const helpContent = VENDOR_HELP_CONTENT[vendor.name];

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
    }).format(new Date(dateString));
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center font-bold text-gray-800 text-xl shadow-sm">
              {vendor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{vendor.name}</h2>
              <p className="text-sm text-gray-500">{vendor.category}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <HiOutlineX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 flex flex-col gap-8">
          
          {/* Status Section */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Integration Status</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Collection Method</span>
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {collectionMethod === 'API' ? (
                    <><HiOutlineLightningBolt className="text-yellow-500" /> API Import</>
                  ) : (
                    <><HiOutlineMail className="text-blue-500" /> Email Scan</>
                  )}
                </span>
              </div>

              {collectionMethod === 'API' && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Connection Status</span>
                  {isConnected ? (
                    <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Connected
                    </span>
                  ) : hasError ? (
                    <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <HiOutlineExclamationCircle /> Action Required
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      Not Connected
                    </span>
                  )}
                </div>
              )}

              {isConnected && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last Sync</span>
                  <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <HiOutlineClock className="text-gray-400" />
                    {formatDate(integration?.lastSyncAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description & Docs */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">About</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {helpContent?.description || `Import your billing events, invoices, and receipts automatically from ${vendor.name}.`}
            </p>
            {helpContent?.docLink && (
              <a 
                href={helpContent.docLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 mt-3"
              >
                <HiOutlineLink size={16} /> View Documentation
              </a>
            )}
          </div>

          {/* Required Credentials */}
          {collectionMethod === 'API' && caps?.credentials && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Required Credentials</h3>
              <div className="flex flex-wrap gap-2">
                {caps.credentials.fields.map(field => (
                  <span key={field.name} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-100">
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          {collectionMethod === 'API' ? (
            <button 
              onClick={() => onConnect(vendor)}
              className="w-full py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              {isConnected ? 'Manage Connection' : 'Connect Account'}
            </button>
          ) : (
            <p className="text-xs text-center text-gray-500">
              This integration runs securely via Gmail scanning. Ensure the vendor is selected to enable collection.
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default VendorDetailDrawer;
