import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchInvoices, syncInvoices, clearSyncResult } from '../store/slices/invoiceSlice';
import { HiOutlineRefresh, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineDocumentText } from 'react-icons/hi';

const API_BASE = 'http://localhost:3000/api';

const InvoicesPage = () => {
  const dispatch = useDispatch();
  const { integrations } = useSelector((state) => state.auth);
  const { invoices, loading, syncing, syncResult, error } = useSelector((state) => state.invoices);

  const isGmailConnected = integrations?.gmail?.connected;

  useEffect(() => {
    dispatch(fetchInvoices());
  }, [dispatch]);

  // Clear sync result after 5 seconds
  useEffect(() => {
    if (syncResult) {
      const timer = setTimeout(() => {
        dispatch(clearSyncResult());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [syncResult, dispatch]);

  const handleSync = async () => {
    if (!isGmailConnected) {
      window.location.href = `${API_BASE}/auth/google`;
      return;
    }
    
    await dispatch(syncInvoices());
    dispatch(fetchInvoices()); // Refresh list after sync
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage all your collected invoices in one place.</p>
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

      {/* Sync Result Toast */}
      {syncResult && (
        <div className={`toast toast-success`}>
          <HiOutlineCheckCircle size={24} />
          <div>
            <h4>Sync Complete</h4>
            <p>Imported: {syncResult.imported} | Skipped: {syncResult.skipped} | Errors: {syncResult.errors}</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className={`toast toast-error`}>
          <HiOutlineExclamationCircle size={24} />
          <div>
            <h4>Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="card table-card">
        {loading && invoices.length === 0 ? (
          <div className="table-loading">
            <div className="loading-spinner" />
            <p>Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <HiOutlineDocumentText size={48} />
            </div>
            <h3>No invoices found</h3>
            <p>
              {isGmailConnected 
                ? "Click 'Sync Invoices' to scan your Gmail for invoices."
                : "Connect your Gmail account to start collecting invoices automatically."}
            </p>
            {!isGmailConnected && (
              <button className="btn btn-outline mt-4" onClick={() => window.location.href = `${API_BASE}/auth/google`}>
                Connect Gmail
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>
                      <div className="vendor-cell">
                        <div className="vendor-avatar">
                          {invoice.vendorName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="fw-medium">{invoice.vendorName}</span>
                      </div>
                    </td>
                    <td>{formatDate(invoice.invoiceDate || invoice.createdAt)}</td>
                    <td>
                      <span className="badge badge-source">
                        {invoice.sourceProvider}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success">
                        {invoice.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {invoice.pdfUrl && (
                        <a 
                          href={invoice.pdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline"
                        >
                          View PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
