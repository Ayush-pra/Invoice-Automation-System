import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { validateVendorCredentials } from '../store/slices/vendorIntegrationSlice';
import { HiOutlineX, HiOutlineExternalLink, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineKey, HiOutlineArrowRight } from 'react-icons/hi';
import { VENDOR_HELP_CONTENT } from '../config/vendorHelpConstants';

const IntegrationWizard = ({ vendorName, requiredFields = [], isOpen, onClose, onSuccess }) => {
  const dispatch = useDispatch();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const helpContent = VENDOR_HELP_CONTENT[vendorName] || {
    description: `Connect ${vendorName} to automatically import your billing records.`,
    required: requiredFields.map(f => f.label),
    steps: ["Login to your vendor dashboard.", "Locate the API settings.", "Generate new credentials."],
    docLink: "#"
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setFormData({});
      setError(null);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleNext = () => setCurrentStep(prev => prev + 1);
  const handleBack = () => setCurrentStep(prev => prev - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setCurrentStep(4); // Move to validating step

    try {
      const resultAction = await dispatch(validateVendorCredentials({
        vendorName,
        credentials: formData
      }));

      if (validateVendorCredentials.fulfilled.match(resultAction)) {
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1500); // Show success state briefly
      } else {
        setError(resultAction.payload || 'Validation failed. Please check your credentials.');
        setCurrentStep(3); // Kick back to input step
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      setCurrentStep(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row animate-scale-up">
        
        {/* Left Side: Progress & Info */}
        <div className="bg-gray-50 md:w-2/5 p-6 border-r border-gray-100 flex flex-col justify-between hidden md:flex">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                {vendorName.charAt(0).toUpperCase()}
              </div>
              <h3 className="font-bold text-gray-900">Connect {vendorName}</h3>
            </div>

            <div className="space-y-6 relative">
              {/* Vertical line connecting steps */}
              <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-gray-200 z-0"></div>

              {/* Step Indicators */}
              {[
                { num: 1, title: 'What You Need' },
                { num: 2, title: 'How To Get It' },
                { num: 3, title: 'Enter Details' },
                { num: 4, title: 'Validation' }
              ].map((step) => (
                <div key={step.num} className={`flex items-start gap-4 relative z-10 transition-opacity ${currentStep >= step.num ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 
                    ${currentStep > step.num ? 'bg-blue-600 border-blue-600 text-white' : 
                      currentStep === step.num ? 'bg-white border-blue-600 text-blue-600' : 
                      'bg-white border-gray-300 text-gray-400'}`}>
                    {currentStep > step.num ? '✓' : step.num}
                  </div>
                  <div className={`text-sm font-medium pt-0.5 ${currentStep === step.num ? 'text-blue-700' : 'text-gray-700'}`}>
                    {step.title}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <a 
            href={helpContent.docLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors mt-8"
          >
            <HiOutlineExternalLink /> Official Documentation
          </a>
        </div>

        {/* Right Side: Dynamic Content */}
        <div className="p-8 md:w-3/5 relative flex flex-col h-full min-h-[400px]">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <HiOutlineX size={20} />
          </button>

          <div className="flex-1 mt-2">
            
            {currentStep === 1 && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold text-gray-900 mb-2">What You Need</h2>
                <p className="text-gray-600 text-sm mb-6">{helpContent.description}</p>
                
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-8">
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">Required Credentials</h4>
                  <ul className="space-y-3">
                    {helpContent.required.map((req, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm text-blue-900 font-medium">
                        <div className="bg-white p-1.5 rounded shadow-sm text-blue-600">
                          <HiOutlineKey size={16} />
                        </div>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold text-gray-900 mb-6">How To Get It</h2>
                
                <ol className="space-y-4">
                  {helpContent.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-gray-700">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-medium text-xs">
                        {idx + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {currentStep === 3 && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Enter Connection Details</h2>
                <p className="text-sm text-gray-500 mb-6">Your credentials are encrypted immediately using AES-256 before being stored securely.</p>
                
                <form id="credential-form" onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2 border border-red-100 mb-4">
                      <HiOutlineExclamationCircle className="mt-0.5 shrink-0" size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  {requiredFields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={field.type || 'text'}
                        name={field.name}
                        placeholder={field.placeholder}
                        required={field.required}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                      />
                    </div>
                  ))}
                </form>
              </div>
            )}

            {currentStep === 4 && (
              <div className="animate-fade-in h-full flex flex-col items-center justify-center text-center pb-8">
                {isSubmitting ? (
                  <>
                    <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                    <h3 className="text-lg font-bold text-gray-900">Validating Connection</h3>
                    <p className="text-gray-500 text-sm mt-2">Connecting securely to {vendorName}...</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                      <HiOutlineCheckCircle size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Connected Successfully</h3>
                    <p className="text-gray-500 text-sm mt-2">Your API keys have been verified and encrypted.</p>
                  </>
                )}
              </div>
            )}

          </div>

          {/* Footer Navigation */}
          {currentStep < 4 && (
            <div className="mt-8 flex items-center justify-between pt-4 border-t border-gray-100">
              {currentStep > 1 ? (
                <button 
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Back
                </button>
              ) : <div></div>}

              {currentStep < 3 ? (
                <button 
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  Continue <HiOutlineArrowRight />
                </button>
              ) : (
                <button 
                  type="submit"
                  form="credential-form"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Connect Account
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default IntegrationWizard;
