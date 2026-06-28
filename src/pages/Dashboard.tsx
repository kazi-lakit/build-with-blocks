import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { getUserInfo, logout as oidcLogout, isAuthenticated, type OIDCUserInfo } from '../services/auth';

interface BillImage {
  id: string;
  url: string;
  name: string;
}

interface Bill {
  id: string;
  amount: number;
  purpose: string;
  contactPerson: string;
  contactEmail?: string;
  contactPhone?: string;
  images: BillImage[];
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

const STORAGE_KEY = 'office_bills';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [bills, setBills] = useState<Bill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Bill['status']>('all');
  
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [images, setImages] = useState<BillImage[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const [oidcUser, setOidcUser] = useState<OIDCUserInfo | null>(null);

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setBills(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load bills:', e);
      }
    } else {
      const sampleBills: Bill[] = [
        {
          id: '1',
          amount: 1250.00,
          purpose: 'Office supplies - Q2 procurement',
          contactPerson: 'Sarah Johnson',
          contactEmail: 'sarah.j@office.com',
          contactPhone: '+1 555-0101',
          images: [],
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'approved',
        },
        {
          id: '2',
          amount: 450.00,
          purpose: 'Team lunch meeting',
          contactPerson: 'Michael Chen',
          contactEmail: 'm.chen@office.com',
          contactPhone: '+1 555-0102',
          images: [],
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'pending',
        },
        {
          id: '3',
          amount: 2300.50,
          purpose: 'Software licenses renewal',
          contactPerson: 'Emily Davis',
          contactEmail: 'emily@office.com',
          contactPhone: '+1 555-0103',
          images: [],
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ];
      setBills(sampleBills);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleBills));
    }
  }, []);

  const persistBills = (newBills: Bill[]) => {
    setBills(newBills);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBills));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setError('Please upload only image files');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage: BillImage = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          url: event.target?.result as string,
          name: file.name,
        };
        setImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const resetForm = () => {
    setAmount('');
    setPurpose('');
    setContactPerson('');
    setContactEmail('');
    setContactPhone('');
    setImages([]);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!purpose.trim()) {
      setError('Purpose is required');
      return;
    }

    if (!contactPerson.trim()) {
      setError('Contact person is required');
      return;
    }

    setSubmitting(true);

    const newBill: Bill = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      amount: amountNum,
      purpose: purpose.trim(),
      contactPerson: contactPerson.trim(),
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      images,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    persistBills([newBill, ...bills]);
    resetForm();
    setShowForm(false);
    setSubmitting(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this bill?')) {
      persistBills(bills.filter((b) => b.id !== id));
    }
  };

  const handleCopyImage = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Image URL copied');
    } catch {
      showToast('Copy failed', true);
    }
  };

  const handleCopyAsCurl = async (img: BillImage) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://iam.seliseblocks.com';
    const tenantId = import.meta.env.VITE_TENANT_ID || '';
    const curl = `curl '${apiUrl}/api/bills/images/${img.id}?filename=${encodeURIComponent(img.name)}}' \\
  -H 'accept: */*' \\
  -H 'x-blocks-key: ${tenantId}' \\
  -H 'authorization: Bearer \${ACCESS_TOKEN}' \\
  --output '${img.name}'`;
    try {
      await navigator.clipboard.writeText(curl);
      showToast('Curl command copied');
    } catch {
      showToast('Copy failed', true);
    }
  };

  const handleLogout = async () => {
    await oidcLogout();
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }
    const loadUser = async () => {
      const userInfo = await getUserInfo();
      if (userInfo) setOidcUser(userInfo);
    };
    loadUser();
  }, [navigate]);

  const filteredBills = bills.filter((bill) => {
    const matchesSearch = 
      bill.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = filteredBills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="dashboard">
      {toast && (
        <div className={`toast ${toast.isError ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}
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
              <span className="user-name-small">{oidcUser.name || oidcUser.preferred_username || oidcUser.email}</span>
            </div>
          )}
          <button className="btn btn-outline" onClick={handleLogout}>
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
            <h1 className="page-title">Office Bills</h1>
            <p className="page-subtitle">Manage and track all office expenses and receipts</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Bill
              </>
            )}
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Bills</div>
            <div className="stat-value">{bills.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Amount</div>
            <div className="stat-value">{formatCurrency(bills.reduce((s, b) => s + b.amount, 0))}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value">{bills.filter((b) => b.status === 'pending').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Approved</div>
            <div className="stat-value">{bills.filter((b) => b.status === 'approved').length}</div>
          </div>
        </div>

        {showForm && (
          <div className="bill-form-card">
            <h2 className="form-title">Add New Bill</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" disabled>
                    <option>Pending</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Purpose *</label>
                <input
                  type="text"
                  placeholder="e.g., Office supplies, Travel, Software"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Person *</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    placeholder="contact@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 555-0000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bill Images</label>
                <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p>Click to upload bill images</p>
                  <span>JPG, PNG, GIF (multiple allowed)</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                {images.length > 0 && (
                  <div className="image-preview-grid">
                    {images.map((img) => (
                      <div key={img.id} className="image-preview">
                        <img src={img.url} alt={img.name} />
                        <button
                          type="button"
                          className="image-remove"
                          onClick={() => removeImage(img.id)}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => { resetForm(); setShowForm(false); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="spinner-small"></span> : 'Save Bill'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bills-toolbar">
          <div className="search-input-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by purpose or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-pills">
            <button
              className={`pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`pill ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Pending
            </button>
            <button
              className={`pill ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              Approved
            </button>
            <button
              className={`pill ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              Rejected
            </button>
          </div>
        </div>

        {filteredBills.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h3>No bills found</h3>
            <p>{bills.length === 0 ? 'Add your first bill to get started' : 'Try a different search or filter'}</p>
          </div>
        ) : (
          <div className="bills-grid">
            {filteredBills.map((bill) => (
              <div key={bill.id} className="bill-card">
                <div className="bill-card-header">
                  <div className="bill-amount">{formatCurrency(bill.amount)}</div>
                  <span className={`status-badge status-${bill.status}`}>{bill.status}</span>
                </div>
                <h3 className="bill-purpose">{bill.purpose}</h3>
                <div className="bill-contact">
                  <div className="contact-avatar">
                    {bill.contactPerson.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{bill.contactPerson}</div>
                    {bill.contactEmail && <div className="contact-detail">{bill.contactEmail}</div>}
                    {bill.contactPhone && <div className="contact-detail">{bill.contactPhone}</div>}
                  </div>
                </div>
                {bill.images.length > 0 && (
                  <div className="bill-images">
                    {bill.images.slice(0, 3).map((img) => (
                      <div key={img.id} className="bill-image-wrapper">
                        <img src={img.url} alt={img.name} className="bill-thumbnail" />
                        <div className="bill-image-overlay">
                          <button
                            className="image-action-btn"
                            onClick={() => handleCopyImage(img.url)}
                            aria-label="Copy image"
                            title="Copy"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <button
                            className="image-action-btn"
                            onClick={() => handleCopyAsCurl(img)}
                            aria-label="Copy as curl"
                            title="Copy as curl"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="4 17 10 11 4 5" />
                              <line x1="12" y1="19" x2="20" y2="19" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {bill.images.length > 3 && (
                      <div className="bill-thumbnail-more">+{bill.images.length - 3}</div>
                    )}
                  </div>
                )}
                <div className="bill-card-footer">
                  <span className="bill-date">
                    {new Date(bill.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <button className="bill-delete" onClick={() => handleDelete(bill.id)} aria-label="Delete bill">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Office Bills Management · Total: {formatCurrency(totalAmount)}</p>
      </footer>
    </div>
  );
}

export default Dashboard;
