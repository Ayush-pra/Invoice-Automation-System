import { Outlet, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { HiOutlineLogout, HiOutlineMail, HiOutlineDocumentText } from 'react-icons/hi';

const Layout = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <HiOutlineDocumentText size={24} />
            </div>
            <span className="logo-text">InvoiceHub</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a
            href="/invoices"
            className="nav-item active"
            onClick={(e) => {
              e.preventDefault();
              navigate('/invoices');
            }}
          >
            <HiOutlineDocumentText size={20} />
            <span>Invoices</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <HiOutlineLogout size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
