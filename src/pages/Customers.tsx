import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
  getUserInfo,
  logout as oidcLogout,
  isAuthenticated,
  type OIDCUserInfo,
} from '../services/auth';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
}

const STORAGE_KEY = 'office_customers';

const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: 'c-1001',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@northwind.example',
    phone: '+1 555-0145',
    company: 'Northwind Traders',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    id: 'c-1002',
    name: 'Sofia Rossi',
    email: 'sofia.rossi@acme.example',
    phone: '+1 555-0167',
    company: 'Acme Industrial',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  {
    id: 'c-1003',
    name: 'Liam O\u2019Connor',
    email: 'liam@globex.example',
    phone: '+1 555-0192',
    company: 'Globex Corp',
    status: 'pending',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'c-1004',
    name: 'Yuki Tanaka',
    email: 'yuki.tanaka@initech.example',
    phone: '+1 555-0118',
    company: 'Initech',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'c-1005',
    name: 'Isabella Garcia',
    email: 'isabella.g@umbrella.example',
    phone: '+1 555-0153',
    company: 'Umbrella Co.',
    status: 'inactive',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  {
    id: 'c-1006',
    name: 'Noah Schmidt',
    email: 'noah.s@cyberdyne.example',
    phone: '+1 555-0104',
    company: 'Cyberdyne Systems',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export function Customers() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Customer['status']>('all');
  const [oidcUser, setOidcUser] = useState<OIDCUserInfo | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCustomers(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load customers:', e);
        setCustomers(SAMPLE_CUSTOMERS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_CUSTOMERS));
      }
    } else {
      setCustomers(SAMPLE_CUSTOMERS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_CUSTOMERS));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }
    const loadUser = async () => {
      const info = await getUserInfo();
      if (info) setOidcUser(info);
    };
    loadUser();
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((c) => c.status === 'active').length,
      pending: customers.filter((c) => c.status === 'pending').length,
      inactive: customers.filter((c) => c.status === 'inactive').length,
    };
  }, [customers]);

  return (
    <div className="dashboard">
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
        <div className="nav-actions">
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
          {oidcUser && (
            <div className="user-info">
              <div className="user-avatar-small">
                {oidcUser.name?.[0] || oidcUser.email?.[0] || oidcUser.preferred_username?.[0] || 'U'}
              </div>
              <span className="user-name-small">
                {oidcUser.name || oidcUser.preferred_username || oidcUser.email}
              </span>
            </div>
          )}
          <button className="btn btn-outline" onClick={oidcLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </nav>

      <main className="dashboard-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">Browse and manage your customer accounts</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Customers</div>
            <div className="stat-value">{counts.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active</div>
            <div className="stat-value">{counts.active}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value">{counts.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Inactive</div>
            <div className="stat-value">{counts.inactive}</div>
          </div>
        </div>

        <div className="bills-toolbar">
          <div className="search-input-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-pills">
            {(['all', 'active', 'pending', 'inactive'] as const).map((s) => (
              <button
                key={s}
                className={`pill ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h3>No customers found</h3>
            <p>
              {customers.length === 0
                ? 'No customers have been added yet'
                : 'Try a different search or filter'}
            </p>
          </div>
        ) : (
          <div className="customers-table-wrapper">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="customer-name-cell">
                        <div className="contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
                        <span>{c.name}</span>
                      </div>
                    </td>
                    <td>{c.company}</td>
                    <td className="contact-detail">{c.email}</td>
                    <td className="contact-detail">{c.phone}</td>
                    <td>
                      <span className={`status-badge status-${c.status}`}>{c.status}</span>
                    </td>
                    <td className="bill-date">
                      {new Date(c.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Customer Management · Showing {filtered.length} of {customers.length}</p>
      </footer>
    </div>
  );
}

export default Customers;
