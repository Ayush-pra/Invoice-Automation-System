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
  HiOutlineMail,
  HiOutlineExternalLink
} from 'react-icons/hi';
import DeleteModal from '../components/DeleteModal';
import BillingDetailDrawer from '../components/BillingDetailDrawer';

const API_BASE = 'http://localhost:3000/api';

const RECORD_TYPE_CONFIG = {
  invoice_pdf: { label: 'Invoice PDF', className: 'badge-pdf', icon: '📄' },
  invoice_link: { label: 'Invoice Link', className: 'badge-link', icon: '🔗' },
  billing_info_only: { label: 'Billing Info Only', className: 'badge-info', icon: '📋' },
};

const InvoicesPage = () => {
  const dispatch = useDispatch();
  const { integrations } = useSelector((state) => state.auth);
  const { invoices, loading, syncing, syncResult, error } = useSelector((state) => state.invoices);

  const isGmailConnected = integrations?.gmail?.connected;

  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchInvoices());
  }, [dispatch]);

  const handleSync = async () => {
    if (!isGmailConnected) {
      window.location.href = `${API_BASE}/auth/google`;
      return;
    }
    
    await dispatch(syncInvoices());
    dispatch(fetchInvoices());
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

  const handleToggleRead = (e, id, currentStatus) => {
    e.stopPropagation();
    dispatch(toggleReadStatus({ id, isRead: !currentStatus }));
  };

  const openDrawer = (record) => {
    setDrawerRecord(record);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerRecord(null), 300);
  };

  const handleDrawerDelete = (id) => {
    closeDrawer();
    setDeleteTarget(id);
    setDeleteModalOpen(true);
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
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(dateString));
  };

  const formatAmount = (amount, currency) => {
    if (!amount) return '—';
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
    return (
      <span className="amount-display">
        <span className="amount-currency">{symbol}</span>
        {amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  };

  // Get primary identifier for display
  const getPrimaryId = (record) => {
    if (record.invoiceNumber) return { label: 'INV', value: record.invoiceNumber };
    if (record.orderNumber) return { label: 'ORD', value: record.orderNumber };
    if (record.transactionId) return { label: 'TXN', value: record.transactionId };
    if (record.receiptNumber) return { label: 'RCT', value: record.receiptNumber };
    if (record.paymentReference) return { label: 'REF', value: record.paymentReference };
    return null;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing Records</h1>
          <p className="page-subtitle">Your collected billing events from email.</p>
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
              <HiOutlineRefresh className={`icon ${syncing ? 'spin' : ''}`} size={18} />
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Result Panel Removed */}
      
      {/* Error Toast */}
      {error && (
        <div className="toast toast-error mb-6">
          <HiOutlineExclamationCircle size={22} />
          <div>
            <h4>Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-blue-800 font-medium text-sm">{selectedIds.length} records selected</span>
          <button 
            className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
            onClick={() => { setDeleteTarget(null); setDeleteModalOpen(true); }}
          >
            <HiOutlineTrash size={14} /> Delete Selected
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="card">
        {loading && invoices.length === 0 ? (
          <div className="table-loading">
            <div className="loading-spinner" />
            <p>Loading billing records...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <HiOutlineDocumentText size={52} />
            </div>
            <h3>No billing records yet</h3>
            <p>
              {isGmailConnected 
                ? "Click 'Sync Now' to scan your Gmail for billing events from your selected vendors."
                : "Connect your Gmail account to start collecting billing records automatically."}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={selectedIds.length === invoices.length && invoices.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="w-10"></th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((record) => {
                  const typeConfig = RECORD_TYPE_CONFIG[record.recordType] || RECORD_TYPE_CONFIG.billing_info_only;
                  const primaryId = getPrimaryId(record);

                  return (
                  <tr 
                    key={record._id} 
                    className={`cursor-pointer ${!record.isRead ? 'unread' : ''}`}
                    onClick={() => openDrawer(record)}
                  >
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300"
                        checked={selectedIds.includes(record._id)}
                        onChange={() => toggleSelect(record._id)}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => handleToggleRead(e, record._id, record.isRead)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title={record.isRead ? "Mark as unread" : "Mark as read"}
                      >
                        {record.isRead 
                          ? <HiOutlineMailOpen size={18} /> 
                          : <HiOutlineMail size={18} className="text-blue-600" />
                        }
                      </button>
                    </td>
                    <td>
                      <div className="vendor-cell">
                        <div className="vendor-avatar">
                          {(record.productName || record.vendorName)?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className={`block font-medium ${!record.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                            {record.productName || record.vendorName}
                          </span>
                          <span className="text-xs text-gray-400 truncate max-w-[220px] block">
                            {record.productName ? `${record.vendorName} · ` : ''}{record.emailSubject || 'No subject'}
                          </span>
                          {primaryId && (
                            <span className="identifier-tag mt-0.5">
                              <span className="label">{primaryId.label}:</span> {primaryId.value}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {formatAmount(record.amount, record.currency)}
                    </td>
                    <td className="text-gray-600 text-sm">
                      {formatDate(record.transactionDate || record.createdAt)}
                    </td>
                    <td>
                      <span className={`badge ${typeConfig.className}`}>
                        {typeConfig.label}
                      </span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {record.pdfUrl && (
                          <a 
                            href={record.pdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            PDF
                          </a>
                        )}
                        {!record.pdfUrl && record.invoiceUrl && (
                          <a 
                            href={record.invoiceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <HiOutlineExternalLink size={12} /> Link
                          </a>
                        )}
                        <button 
                          className="btn btn-sm text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(record._id); setDeleteModalOpen(true); }}
                        >
                          <HiOutlineTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <BillingDetailDrawer 
        record={drawerRecord}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onDelete={handleDrawerDelete}
      />

      {/* Delete Modal */}
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
