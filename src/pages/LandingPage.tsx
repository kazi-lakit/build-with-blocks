import { useTheme } from '../context/ThemeContext';
import { startAuthorization } from '../services/auth';
import { useState } from 'react';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await startAuthorization();
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="url(#logoGrad)" />
            <path d="M12 20L20 12L28 20L20 28L12 20Z" fill="white" />
            <circle cx="20" cy="20" r="6" fill="url(#logoGrad)" />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="var(--accent-primary)" />
                <stop offset="1" stopColor="var(--accent-secondary)" />
              </linearGradient>
            </defs>
          </svg>
          <span className="logo-text">Project OS</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </nav>

      <main className="hero-section">
        <div className="hero-content">
          <div className="badge">Powered by AI</div>
          <h1 className="hero-title">
            Welcome to <span className="gradient-text">Project OS</span>
          </h1>
          <p className="hero-subtitle">
            Manage your office bills, expenses, and receipts — all in one intelligent workspace.
          </p>
          <div className="cta-container">
            <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? (
                <span className="spinner-small"></span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                  </svg>
                  Login to Continue
                </>
              )}
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="grid-bg"></div>
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
      </main>

      <footer className="footer">
        <p>Secure OIDC authentication via Blocks IAM</p>
      </footer>
    </div>
  );
}

export default LandingPage;
