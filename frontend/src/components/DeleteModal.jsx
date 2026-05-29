import { HiOutlineExclamationCircle } from 'react-icons/hi';

const DeleteModal = ({ isOpen, onClose, onConfirm, isBulk, count, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 transform transition-all">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <HiOutlineExclamationCircle className="text-red-600" size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {isBulk ? `Delete ${count} Invoices?` : 'Delete Invoice?'}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            This action cannot be undone. This will permanently delete the selected 
            {isBulk ? ' invoices' : ' invoice'} and remove the associated PDF {isBulk ? 'files' : 'file'} from storage.
          </p>
        </div>
        
        <div className="flex space-x-3 w-full">
          <button 
            className="flex-1 btn bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg font-medium transition-colors"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className={`flex-1 btn bg-red-600 text-white hover:bg-red-700 py-2 rounded-lg font-medium transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
