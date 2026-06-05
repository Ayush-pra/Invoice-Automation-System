import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineLightningBolt, HiOutlineMail } from 'react-icons/hi';

const VendorCard = ({ vendor, integration, caps, isSelected, onToggle, onClick }) => {
  const isConnected = integration?.status === 'connected';
  const hasError = integration?.status === 'error' || integration?.status === 'invalid_credentials';
  const collectionMethod = caps?.supportsApi ? 'API' : 'Email';

  return (
    <div 
      className={`group relative bg-white border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md hover:border-gray-300 flex flex-col h-full
        ${isSelected ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-200'}`}
      onClick={(e) => {
        // Only trigger onClick for the drawer if we click the card body, not the checkbox/toggle
        onClick(vendor);
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center font-bold text-gray-700 text-xl shadow-sm group-hover:scale-105 transition-transform">
          {vendor.name.charAt(0).toUpperCase()}
        </div>
        
        <div 
          className="relative flex items-center justify-center w-6 h-6 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(vendor);
          }}
        >
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={() => {}} // handled by parent div onClick
            className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-bold text-gray-900 text-base">{vendor.name}</h3>
        <p className="text-sm text-gray-500 line-clamp-2 mt-1">{vendor.category}</p>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-medium">
        {/* Method Indicator */}
        <div className="flex items-center gap-1.5 text-gray-600">
          {collectionMethod === 'API' ? (
            <><HiOutlineLightningBolt className="text-yellow-500" /> API</>
          ) : (
            <><HiOutlineMail className="text-blue-400" /> Email</>
          )}
        </div>

        {/* Status Indicator */}
        {collectionMethod === 'API' && (
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Connected
              </span>
            ) : hasError ? (
              <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                <HiOutlineExclamationCircle />
                Action Required
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                Not Connected
              </span>
            )}
          </div>
        )}
        
        {collectionMethod === 'Email' && isSelected && (
          <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Active
          </span>
        )}
      </div>
    </div>
  );
};

export default VendorCard;
