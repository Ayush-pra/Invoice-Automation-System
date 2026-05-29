import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { validateVendorCredentials, clearValidationError } from '../store/slices/vendorIntegrationSlice';
import { HiOutlineX, HiOutlineExclamationCircle, HiOutlineCheckCircle } from 'react-icons/hi';

const VendorCredentialModal = ({ vendorName, isOpen, onClose }) => {
  const dispatch = useDispatch();
  const { registry, validating, validationResult, error } = useSelector((state) => state.vendorIntegration);
  
  const [formData, setFormData] = useState({});

  const vendorConfig = registry[vendorName];
  const fields = vendorConfig?.credentials?.fields || [];

  useEffect(() => {
    if (isOpen) {
      setFormData({});
      dispatch(clearValidationError());
    }
  }, [isOpen, vendorName, dispatch]);

  if (!isOpen || !vendorConfig) return null;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(validateVendorCredentials({
      vendorName,
      credentials: formData
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 scale-100">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Connect {vendorName}
          </h3>
          <button 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors" 
            onClick={onClose} 
            disabled={validating}
          >
            <HiOutlineX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <p className="text-sm text-gray-500 leading-relaxed">
              Enter your {vendorName} credentials to enable automatic API billing sync. These will be encrypted and stored securely using AES-256-CBC.
            </p>

            <div className="space-y-4 mt-2">
              {fields.map((field) => (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type={field.type}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  />
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3.5 bg-red-50/80 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3 mt-4">
                <HiOutlineExclamationCircle size={20} className="shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {validationResult?.success && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-100 rounded-xl text-emerald-600 text-sm flex items-start gap-3 mt-4">
                <HiOutlineCheckCircle size={20} className="shrink-0 mt-0.5" />
                <span className="font-medium">{validationResult.message}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
            <button 
              type="button" 
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 rounded-xl transition-colors" 
              onClick={onClose}
              disabled={validating}
            >
              {validationResult?.success ? 'Close' : 'Cancel'}
            </button>
            {!validationResult?.success && (
              <button 
                type="submit" 
                className={`px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow shadow-blue-500/20 rounded-xl transition-all ${validating ? 'opacity-70 cursor-wait' : ''}`}
                disabled={validating}
              >
                {validating ? 'Connecting...' : 'Connect Vendor'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorCredentialModal;
