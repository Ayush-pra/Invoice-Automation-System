import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  fetchInvoices, 
  syncInvoices, 
  clearSyncResult,
  toggleReadStatus,
  deleteInvoice,
  bulkDeleteInvoices
} from '../store/slices/invoiceSlice';
import { 
  HiOutlineRefresh, 
  HiOutlineCheckCircle, 
  HiOutlineExclamationCircle, 
  HiOutlineDocumentText,
  HiOutlineTrash,
  HiOutlineMailOpen,
  HiOutlineMail
} from 'react-icons/hi';
import DeleteModal from '../components/DeleteModal';

const API_BASE = 'http://localhost:3000/api';

const InvoicesPage = () => {
  const dispatch = useDispatch();
  const { integrations } = useSelector((state) => state.auth);
  const { invoices, loading, syncing, syncResult, error } = useSelector((state) => state.invoices);
  const { data: config } = useSelector((state) => state.config);

  const isGmailConnected = integrations?.gmail?.connected;

  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // null = bulk, ID = single
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    dispatch(fetchInvoices());
  }, [dispatch]);

  const handleSync = async () => {
    if (!isGmailConnected) {
      window.location.href = `${API_BASE}/auth/google`;
      return;
    }
    
    await dispatch(syncInvoices());
    dispatch(fetchInvoices()); // Refresh list
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(invoices.map(inv => inv._id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleRead = (id, currentStatus) => {
    dispatch(toggleReadStatus({ id, isRead: !currentStatus }));
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    if (deleteTarget) {
      await dispatch(deleteInvoice(deleteTarget));
      setSelectedIds(prev => prev.filter(id => id !== deleteTarget));
    } else if (selectedIds.length > 0) {
      await dispatch(bulkDeleteInvoices(selectedIds));
      setSelectedIds([]);
    }
    setIsDeleting(false);
    setDeleteModalOpen(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(dateString));
  };

  const getConfidenceBadge = (score) => {
    if (score >= 80) return <span className="badge bg-green-100 text-green-800">{score}% Match</span>;
    if (score >= 60) return <span className="badge bg-yellow-100 text-yellow-800">{score}% Match</span>;
    return <span className="badge bg-red-100 text-red-800">{score}% Match</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing Records</h1>
          <p className="page-subtitle">Manage your transactions and invoices.</p>
        </div>

        <div className="header-actions">
          {!isGmailConnected ? (
            <button className="btn btn-primary" onClick={() => window.location.href = `${API_BASE}/auth/google`}>
              Connect Gmail
            </button>
          ) : (
            <button 
              className={`btn btn-primary ${syncing ? 'loading' : ''}`} 
              onClick={handleSync}
              disabled={syncing}
            >
              <HiOutlineRefresh className={`icon ${syncing ? 'spin' : ''}`} size={20} />
              <span>{syncing ? 'Syncing...' : 'Sync Invoices'}</span>
            </button>
          )}
        </div>
      </div>

      {syncResult && (
        <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6 mb-6">
          <div className="flex items-center text-green-700 mb-4">
            <HiOutlineCheckCircle size={24} className="mr-2" />
            <h4 className="text-lg font-semibold">Sync Complete</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded text-center">
              <span className="block text-2xl font-bold text-gray-800">{syncResult.imported}</span>
              <span className="text-sm text-gray-500">Imported</span>
            </div>
            <div className="p-3 bg-gray-50 rounded text-center">
              <span className="block text-2xl font-bold text-gray-800">{syncResult.skipped}</span>
              <span className="text-sm text-gray-500">Skipped (Dupes)</span>
            </div>
            <div className="p-3 bg-gray-50 rounded text-center">
              <span className="block text-2xl font-bold text-gray-800">{syncResult.errors}</span>
              <span className="text-sm text-gray-500">Errors</span>
            </div>
          </div>
          
          {syncResult.vendorStats && (
            <div>
              <h5 className="font-semibold text-gray-700 mb-2">Vendor Details:</h5>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {syncResult.vendorStats.map(stat => (
                  <div key={stat.vendor} className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800">{stat.vendor}</span>
                      <span className="text-sm font-medium bg-green-100 text-green-800 px-2 py-1 rounded">
                        {stat.invoicesImported} Qualified
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Emails Scanned:</span> {stat.emailsFound}
                    </div>
                    {stat.ignored > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-red-600 mb-1 block">Rejected ({stat.ignored}):</span>
                        {stat.rejectionReasons && Object.keys(stat.rejectionReasons).length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1 text-gray-600">
                            {Object.entries(stat.rejectionReasons).map(([reason, count]) => (
                              <li key={reason}>
                                <span className="font-medium">{count}x</span> {reason}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-500 italic">No specific reasons logged</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button 
            className="text-sm text-gray-500 hover:text-gray-700 underline mt-4 block"
            onClick={() => dispatch(clearSyncResult())}
          >
            Dismiss
          </button>
        </div>
      )}
      
      {error && (
        <div className="toast toast-error mb-6">
          <HiOutlineExclamationCircle size={24} />
          <div>
            <h4>Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-6 flex items-center justify-between">
          <span className="text-primary-800 font-medium">{selectedIds.length} invoices selected</span>
          <button 
            className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 border-none"
            onClick={() => { setDeleteTarget(null); setDeleteModalOpen(true); }}
          >
            <HiOutlineTrash size={16} className="mr-1" /> Delete Selected
          </button>
        </div>
      )}

      <div className="card table-card">
        {loading && invoices.length === 0 ? (
          <div className="table-loading py-12">
            <div className="loading-spinner" />
            <p>Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <HiOutlineDocumentText size={48} />
            </div>
            <h3>No invoices found</h3>
            <p className="max-w-md text-center mx-auto text-gray-500">
              {isGmailConnected 
                ? "Click 'Sync Invoices' to scan your Gmail for invoices based on your selected vendors."
                : "Connect your Gmail account to start collecting invoices automatically."}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={selectedIds.length === invoices.length && invoices.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Status</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Source / Completeness</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((record) => {
                  const hasPdf = record.documents?.some(d => d.pdfUrl);
                  const pdfDoc = record.documents?.find(d => d.pdfUrl);
                  const linkDoc = record.documents?.find(d => d.invoiceLink || d.receiptLink || d.billingPortalLink);
                  const docLink = linkDoc ? (linkDoc.invoiceLink || linkDoc.receiptLink || linkDoc.billingPortalLink) : null;
                  
                  let badge = null;
                  if (record.recordCompleteness === 100 || hasPdf) {
                    badge = <span className="badge bg-green-100 text-green-800">PDF Available</span>;
                  } else if (record.recordCompleteness >= 80 || docLink) {
                    badge = <span className="badge bg-blue-100 text-blue-800">Invoice Link Available</span>;
                  } else if (record.recordCompleteness >= 50) {
                    badge = <span className="badge bg-yellow-100 text-yellow-800">Email Receipt Only</span>;
                  } else {
                    badge = <span className="badge bg-gray-100 text-gray-800">Unknown</span>;
                  }

                  return (
                  <tr key={record._id} className={!record.isRead ? 'bg-gray-50/50' : ''}>
                    <td className="text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300"
                        checked={selectedIds.includes(record._id)}
                        onChange={() => toggleSelect(record._id)}
                      />
                    </td>
                    <td>
                      <button 
                        onClick={() => handleToggleRead(record._id, record.isRead)}
                        className="text-gray-400 hover:text-primary-600 transition-colors"
                        title={record.isRead ? "Mark as unread" : "Mark as read"}
                      >
                        {record.isRead ? <HiOutlineMailOpen size={20} /> : <HiOutlineMail size={20} className="text-primary-600" />}
                      </button>
                    </td>
                    <td>
                      <div className="vendor-cell">
                        <div className="vendor-avatar">
                          {record.vendorName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className={`block font-medium ${!record.isRead ? 'text-gray-900' : 'text-gray-700'} flex items-center`}>
                            {record.vendorName}
                            {record.reviewStatus === 'needs_review' && (
                              <span className="ml-2 text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Needs Review</span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500 truncate max-w-[200px] block">
                            {record.documents && record.documents.length > 0 ? record.documents[0].emailSubject : 'No email subject'}
                          </span>
                          {record.amount && (
                            <span className="text-xs font-medium text-gray-700 block mt-0.5">
                              {record.currency || '$'}{record.amount}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(record.transactionDate || record.createdAt)}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        {badge}
                        {record.documents && record.documents.length > 1 && (
                          <span className="text-xs text-gray-500">Grouped ({record.documents.length} docs)</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right space-x-2">
                      {hasPdf && (
                        <a 
                          href={pdfDoc.pdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline text-xs"
                        >
                          View PDF
                        </a>
                      )}
                      {!hasPdf && docLink && (
                        <a 
                          href={docLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          Open Link
                        </a>
                      )}
                      <button 
                        className="btn btn-sm text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100"
                        onClick={() => { setDeleteTarget(record._id); setDeleteModalOpen(true); }}
                      >
                        <HiOutlineTrash size={16} />
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        isBulk={!deleteTarget}
        count={selectedIds.length}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default InvoicesPage;
