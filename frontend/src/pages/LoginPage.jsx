import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { HiOutlineDocumentText, HiOutlineMail, HiOutlineCloudUpload, HiOutlineDatabase } from 'react-icons/hi';

const API_BASE = 'http://localhost:3000/api';

const LoginPage = () => {
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  if (!loading && isAuthenticated) {
    return <Navigate to="/invoices" replace />;
  }

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb--1" />
        <div className="login-bg-orb login-bg-orb--2" />
        <div className="login-bg-orb login-bg-orb--3" />
      </div>

      <div className="login-container">
        {/* Left side — Branding */}
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-logo">
              <div className="login-logo-icon">
                <HiOutlineDocumentText size={40} />
              </div>
              <h1>InvoiceHub</h1>
            </div>
            <p className="login-tagline">
              Collect, organize, and manage all your invoices from Gmail — automatically.
            </p>

            <div className="login-features">
              <div className="login-feature">
                <div className="login-feature-icon">
                  <HiOutlineMail size={24} />
                </div>
                <div>
                  <h3>Gmail Integration</h3>
                  <p>Automatically scan your inbox for invoices</p>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <HiOutlineCloudUpload size={24} />
                </div>
                <div>
                  <h3>Cloud Storage</h3>
                  <p>PDFs securely uploaded and organized</p>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <HiOutlineDatabase size={24} />
                </div>
                <div>
                  <h3>Centralized Records</h3>
                  <p>All invoices in one searchable place</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side — Login Card */}
        <div className="login-card-wrapper">
          <div className="login-card">
            <h2>Get Started</h2>
            <p className="login-card-subtitle">
              Sign in with your Google account to connect Gmail and start collecting invoices.
            </p>

            <button
              className="google-login-btn"
              onClick={handleGoogleLogin}
              id="google-login-button"
            >
              <FcGoogle size={24} />
              <span>Sign in with Google</span>
            </button>

            <p className="login-disclaimer">
              By signing in, you grant read-only access to your Gmail inbox to scan for invoice emails.
              We never send emails on your behalf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
