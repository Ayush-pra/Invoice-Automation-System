import { useEffect } from 'react';
import { HiOutlineX, HiOutlineTrash, HiOutlineExternalLink } from 'react-icons/hi';

const RECORD_TYPE_CONFIG = {
  invoice_pdf: { label: 'Invoice PDF', className: 'badge-pdf' },
  invoice_link: { label: 'Invoice Link', className: 'badge-link' },
  billing_info_only: { label: 'Billing Info Only', className: 'badge-info' },
};

const BillingDetailDrawer = ({ record, isOpen, onClose, onDelete }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!record) return null;

  const typeConfig = RECORD_TYPE_CONFIG[record.recordType] || RECORD_TYPE_CONFIG.billing_info_only;

  const formatAmount = (amount, currency) => {
    if (!amount) return null;
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
    return (
      <span className="drawer-amount">
        <span className="currency">{symbol}</span>
        {amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  // Get the primary identifier to show with its exact label
  const getIdentifiers = () => {
    const ids = [];
    if (record.invoiceNumber) ids.push({ label: 'Invoice Number', value: record.invoiceNumber });
    if (record.orderNumber) ids.push({ label: 'Order ID', value: record.orderNumber });
    if (record.transactionId) ids.push({ label: 'Transaction ID', value: record.transactionId });
    if (record.receiptNumber) ids.push({ label: 'Receipt Number', value: record.receiptNumber });
    if (record.paymentReference) ids.push({ label: 'Payment Reference', value: record.paymentReference });
    if (record.customerTransactionId) ids.push({ label: 'Customer Transaction ID', value: record.customerTransactionId });
    if (record.merchantTransactionId) ids.push({ label: 'Merchant Transaction ID', value: record.merchantTransactionId });
    if (record.utr) ids.push({ label: 'UTR', value: record.utr });
    if (record.rrn) ids.push({ label: 'RRN', value: record.rrn });
    if (record.paymentGatewayReference) ids.push({ label: 'Payment Gateway Ref', value: record.paymentGatewayReference });
    return ids;
  };

  const identifiers = getIdentifiers();
  
  const displayTitle = record.productName || record.vendorName;
  const showSubTitle = record.productName && record.productName !== record.vendorName;

  return (
    <>
      {/* Overlay */}
      <div
        className={`drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      />

      {/* Panel */}
      <div className={`drawer-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="drawer-header">
          <h3>Billing Record</h3>
          <button className="drawer-close-btn" onClick={onClose}>
            <HiOutlineX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {/* Vendor + Type */}
          <div className="drawer-section">
            <div className="flex items-center gap-3 mb-3">
              <div className="vendor-avatar" style={{ width: '3rem', height: '3rem', fontSize: '1.125rem' }}>
                {displayTitle?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{displayTitle}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge ${typeConfig.className}`}>{typeConfig.label}</span>
                  {showSubTitle && <span className="text-xs text-gray-500 font-medium">{record.vendorName}</span>}
                </div>
              </div>
            </div>

            {/* Amount */}
            {record.amount && (
              <div className="mt-4">
                {formatAmount(record.amount, record.currency)}
              </div>
            )}
          </div>

          {/* Identifiers */}
          {identifiers.length > 0 && (
            <div className="drawer-section">
              <h4 className="drawer-section-title">Identifiers</h4>
              {identifiers.map((id) => (
                <div className="drawer-field" key={id.label}>
                  <span className="drawer-field-label">{id.label}</span>
                  <span className="drawer-field-value mono">{id.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Line Items */}
          {record.lineItems && record.lineItems.length > 0 && (
            <div className="drawer-section">
              <h4 className="drawer-section-title">Line Items</h4>
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                {record.lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-200 last:border-0 last:pb-0 first:pt-0">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">
                      {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="drawer-section">
            <h4 className="drawer-section-title">Dates</h4>
            <div className="drawer-field">
              <span className="drawer-field-label">Transaction Date</span>
              <span className="drawer-field-value">{formatDate(record.transactionDate)}</span>
            </div>
            {record.billingPeriod && (
              <div className="drawer-field">
                <span className="drawer-field-label">Billing Period</span>
                <span className="drawer-field-value">{record.billingPeriod}</span>
              </div>
            )}
          </div>

          {/* Subscription / Membership */}
          {(record.subscriptionName || record.membershipName || record.paymentMethod) && (
            <div className="drawer-section">
              <h4 className="drawer-section-title">Details</h4>
              {record.subscriptionName && (
                <div className="drawer-field">
                  <span className="drawer-field-label">Subscription</span>
                  <span className="drawer-field-value">{record.subscriptionName}</span>
                </div>
              )}
              {record.membershipName && (
                <div className="drawer-field">
                  <span className="drawer-field-label">Membership</span>
                  <span className="drawer-field-value">{record.membershipName}</span>
                </div>
              )}
              {record.paymentMethod && (
                <div className="drawer-field">
                  <span className="drawer-field-label">Payment Method</span>
                  <span className="drawer-field-value">{record.paymentMethod}</span>
                </div>
              )}
            </div>
          )}

          {/* Documents / Links */}
          <div className="drawer-section">
            <h4 className="drawer-section-title">Documents</h4>
            {record.pdfUrl && (
              <div className="drawer-field">
                <span className="drawer-field-label">PDF Invoice</span>
                <span className="drawer-field-value">
                  <a href={record.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    View PDF <HiOutlineExternalLink size={14} />
                  </a>
                </span>
              </div>
            )}
            {record.invoiceUrl && (
              <div className="drawer-field">
                <span className="drawer-field-label">Invoice Link</span>
                <span className="drawer-field-value">
                  <a href={record.invoiceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    Open Link <HiOutlineExternalLink size={14} />
                  </a>
                </span>
              </div>
            )}
            {!record.pdfUrl && !record.invoiceUrl && (
              <div className="drawer-field">
                <span className="drawer-field-label">Source</span>
                <span className="drawer-field-value" style={{ color: '#94a3b8' }}>Email only</span>
              </div>
            )}
          </div>

          {/* Email Info */}
          <div className="drawer-section">
            <h4 className="drawer-section-title">Email Source</h4>
            {record.emailSubject && (
              <div className="drawer-field">
                <span className="drawer-field-label">Subject</span>
                <span className="drawer-field-value" style={{ fontSize: '0.75rem' }}>{record.emailSubject}</span>
              </div>
            )}
            {record.senderEmail && (
              <div className="drawer-field">
                <span className="drawer-field-label">Sender</span>
                <span className="drawer-field-value mono">{record.senderEmail}</span>
              </div>
            )}
            {record.rawEmailIds && record.rawEmailIds.length > 0 && (
              <div className="drawer-field">
                <span className="drawer-field-label">Linked Emails</span>
                <span className="drawer-field-value">{record.rawEmailIds.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          {record.pdfUrl && (
            <a
              href={record.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary flex-1"
            >
              Download PDF
            </a>
          )}
          {!record.pdfUrl && record.invoiceUrl && (
            <a
              href={record.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary flex-1"
            >
              Open Invoice
            </a>
          )}
          <button
            className="btn btn-outline"
            style={{ color: '#ef4444', borderColor: '#fecaca' }}
            onClick={() => onDelete(record._id)}
          >
            <HiOutlineTrash size={16} />
            Delete
          </button>
        </div>
      </div>
    </>
  );
};

export default BillingDetailDrawer;
