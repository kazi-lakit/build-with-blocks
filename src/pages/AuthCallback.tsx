import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleAuthorizationCallback } from '../services/auth';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const process = async () => {
      try {
        await handleAuthorizationCallback();
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };
    process();
  }, [navigate]);

  if (error) {
    return (
      <div className="callback-page">
        <div className="error-message" style={{ maxWidth: 400, textAlign: 'center' }}>
          {error}
          <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="callback-page">
      <div className="spinner"></div>
      <p>Completing sign in...</p>
    </div>
  );
}

export default AuthCallback;
