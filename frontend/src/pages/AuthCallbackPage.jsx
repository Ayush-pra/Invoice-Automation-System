import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { checkAuth } from '../store/slices/authSlice';

/**
 * Auth callback page.
 * After Google OAuth redirect, this page checks auth status
 * and redirects to the invoices page.
 */
const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        await dispatch(checkAuth()).unwrap();
        navigate('/invoices', { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    };

    verifyAuth();
  }, [dispatch, navigate]);

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Completing sign in...</p>
    </div>
  );
};

export default AuthCallbackPage;
