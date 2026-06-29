import { useState, useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
  getUserInfo,
  logout as oidcLogout,
  isAuthenticated,
  type OIDCUserInfo,
} from '../services/auth';
import {
  getCustomers,
  insertCustomer,
  updateCustomerStatus,
  deleteCustomer,
  type CustomerItem,
} from '../services/customers';
import { getPreSignedUploadUrl, uploadFileToSignedUrl, getFiles } from '../services/files';

type CustomerType = 'company' | 'individual';
type CustomerStatus = 'active' | 'inactive' | 'pending';

interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  logo?: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

const normalizeType = (raw: string | undefined): CustomerType => {
  const v = (raw || '').toLowerCase();
  return v === 'individual' ? 'individual' : 'company';
};

const normalizeStatus = (raw: string | undefined): CustomerStatus => {
  const v = (raw || '').toLowerCase();
  if (v === 'inactive' || v === 'pending') return v;
  return 'active';
};

const mapItem = (item: CustomerItem): Customer => ({
  id: item.ItemId,
  type: normalizeType(item.Type),
  name: item.Name || '—',
  email: item.Email || '',
  phone: item.PhoneNumber || '',
  status: normalizeStatus(item.Status),
  logo: item.ImageId || undefined,
  createdAt: item.CreatedDate || new Date().toISOString(),
});

export function Customers() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerStatus>('all');
  const [oidcUser, setOidcUser] = useState<OIDCUserInfo | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<CustomerType>('company');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<CustomerStatus>('active');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const [pageNo, setPageNo] = useState(1);
  const [pageSize] = useState(PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const [pendingToggle, setPendingToggle] = useState<Customer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState('');

  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  const fetchCustomers = useCallback(
    async (page: number) => {
      setLoading(true);
      setPageError('');
      try {
        const result = await getCustomers(page, pageSize);
        setCustomers(result.items.map(mapItem));
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setHasNextPage(result.hasNextPage);
        setHasPreviousPage(result.hasPreviousPage);
        setPageNo(result.pageNo || page);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load customers';
        setPageError(message);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  const resolveFileUrls = useCallback(async (items: Customer[]) => {
    const ids = Array.from(
      new Set(items.map((c) => c.logo).filter((id): id is string => !!id)),
    );
    if (ids.length === 0) {
      setFileUrls({});
      return;
    }
    try {
      const files = await getFiles(ids);
      const map: Record<string, string> = {};
      for (const f of files) {
        if (f.isSuccess && f.url && f.itemId) {
          map[f.itemId] = f.url;
        }
      }
      setFileUrls(map);
    } catch (e) {
      console.error('Failed to resolve file URLs:', e);
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

  useEffect(() => {
    if (isAuthenticated()) {
      fetchCustomers(1);
    }
  }, [fetchCustomers]);

  useEffect(() => {
    resolveFileUrls(customers);
  }, [customers, resolveFileUrls]);

  const resetForm = () => {
    setFormType('company');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('active');
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setFormError('');
    setUploadStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please upload an image file');
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setFormError('');
    setUploadStatus('');
  };

  const removeLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setUploadStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formEmail.trim()) {
      setFormError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      setFormError('Please enter a valid email');
      return;
    }

    setSubmitting(true);
    try {
      let imageId = '';
      if (logoFile) {
        setUploadStatus('Requesting upload URL…');
        const presigned = await getPreSignedUploadUrl({ name: logoFile.name });
        setUploadStatus('Uploading logo…');
        await uploadFileToSignedUrl(presigned.uploadUrl!, logoFile);
        imageId = presigned.fileId!;
      }

      await insertCustomer({
        Name: formName.trim(),
        Type: formType,
        ImageId: imageId,
        Status: formStatus,
        Email: formEmail.trim(),
        PhoneNumber: formPhone.trim(),
      });

      resetForm();
      setShowForm(false);
      await fetchCustomers(pageNo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create customer';
      setFormError(message);
    } finally {
      setSubmitting(false);
      setUploadStatus('');
    }
  };

  const closeForm = () => {
    if (submitting) return;
    resetForm();
    setShowForm(false);
  };

  useEffect(() => {
    if (!showForm && logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
      setLogoFile(null);
    }
  }, [showForm, logoPreview]);

  const handleModalKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') closeForm();
  };

  useEffect(() => {
    if (!showForm) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showForm]);

  const filtered = customers.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const goToPage = (page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages) || loading) return;
    fetchCustomers(page);
  };

  const requestToggle = (customer: Customer) => {
    if (rowBusy[customer.id]) return;
    setActionError('');
    setPendingToggle(customer);
  };

  const requestDelete = (customer: Customer) => {
    if (rowBusy[customer.id]) return;
    setActionError('');
    setPendingDelete(customer);
  };

  const cancelConfirm = () => {
    if (
      (pendingToggle && rowBusy[pendingToggle.id]) ||
      (pendingDelete && rowBusy[pendingDelete.id])
    ) {
      return;
    }
    setPendingToggle(null);
    setPendingDelete(null);
    setActionError('');
  };

  const confirmToggle = async () => {
    const target = pendingToggle;
    if (!target) return;
    const next: CustomerStatus = target.status === 'active' ? 'inactive' : 'active';
    setRowBusy((s) => ({ ...s, [target.id]: true }));
    setActionError('');
    try {
      await updateCustomerStatus(target.id, next);
      setCustomers((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, status: next } : c)),
      );
      setPendingToggle(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setRowBusy((s) => {
        const next = { ...s };
        delete next[target.id];
        return next;
      });
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    if (!target) return;
    setRowBusy((s) => ({ ...s, [target.id]: true }));
    setActionError('');
    try {
      await deleteCustomer(target.id, false);
      setCustomers((prev) => prev.filter((c) => c.id !== target.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setPendingDelete(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete customer');
    } finally {
      setRowBusy((s) => {
        const next = { ...s };
        delete next[target.id];
        return next;
      });
    }
  };

  const counts = {
    total: totalCount,
    active: customers.filter((c) => c.status === 'active').length,
    pending: customers.filter((c) => c.status === 'pending').length,
    inactive: customers.filter((c) => c.status === 'inactive').length,
  };

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
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
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
                Add Customer
              </>
            )}
          </button>
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

        {showForm && (
          <>
            <div
              className="modal-backdrop"
              onClick={closeForm}
              aria-hidden="true"
            />
            <div
              className="side-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-customer-title"
              onKeyDown={handleModalKeyDown}
            >
              <div className="side-modal-header">
                <h2 id="add-customer-title" className="form-title">Add New Customer</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeForm}
                  aria-label="Close"
                  disabled={submitting}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="side-modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select
                      className="form-input"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as CustomerType)}
                    >
                      <option value="company">Company</option>
                      <option value="individual">Individual</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status *</label>
                    <select
                      className="form-input"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as CustomerStatus)}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    placeholder={formType === 'company' ? 'Company name' : 'Full name'}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      placeholder="contact@example.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      placeholder="+1 555-0000"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Logo / Image</label>
                  {logoPreview ? (
                    <div className="logo-preview">
                      <img src={logoPreview} alt="Logo preview" />
                      <button
                        type="button"
                        className="image-remove"
                        onClick={removeLogo}
                        aria-label="Remove logo"
                        disabled={submitting}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      className="image-upload-area"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p>Click to upload logo or image</p>
                      <span>JPG, PNG, GIF, SVG</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                  {uploadStatus && (
                    <div className="upload-status">
                      <span className="spinner-small"></span>
                      {uploadStatus}
                    </div>
                  )}
                </div>

                {formError && <div className="error-message">{formError}</div>}

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={closeForm}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <span className="spinner-small"></span> : 'Save Customer'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        <div className="bills-toolbar">
          <div className="search-input-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
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

        {pageError && (
          <div className="error-message" style={{ marginBottom: 16 }}>
            {pageError}
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginLeft: 12 }}
              onClick={() => fetchCustomers(pageNo)}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
            <h3>Loading customers…</h3>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h3>No customers found</h3>
            <p>
              {customers.length === 0 && totalCount === 0
                ? 'No customers have been added yet'
                : 'Try a different search or filter'}
            </p>
          </div>
        ) : (
          <div className="customers-table-wrapper">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isActive = c.status === 'active';
                  const busy = !!rowBusy[c.id];
                  const logoUrl = c.logo ? fileUrls[c.logo] : undefined;
                  return (
                    <tr key={c.id} className={busy ? 'row-busy' : ''}>
                      <td>
                        <div className="customer-name-cell">
                          {logoUrl ? (
                            <img src={logoUrl} alt={c.name} className="customer-logo" />
                          ) : c.logo ? (
                            <div className="customer-logo-placeholder" aria-label="Loading logo">
                              <span className="spinner-small"></span>
                            </div>
                          ) : (
                            <div className="contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
                          )}
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`type-pill type-${c.type}`}>{c.type}</span>
                      </td>
                      <td className="contact-detail">{c.email}</td>
                      <td className="contact-detail">{c.phone || '—'}</td>
                      <td>
                        <div className="status-cell">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${c.name}`}
                            className={`status-switch ${isActive ? 'on' : 'off'}`}
                            onClick={() => requestToggle(c)}
                            disabled={busy}
                          >
                            <span className="status-switch-knob" />
                          </button>
                          <span className={`status-badge status-${c.status}`}>{c.status}</span>
                        </div>
                      </td>
                      <td className="bill-date">
                        {new Date(c.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="td-actions">
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${c.name}`}
                          title="Delete"
                          onClick={() => requestDelete(c)}
                          disabled={busy}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !pageError && totalCount > 0 && (
          <div className="pagination">
            <button
              className="btn btn-outline"
              disabled={!hasPreviousPage}
              onClick={() => goToPage(pageNo - 1)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </button>
            <span className="pagination-info">
              Page {pageNo} of {Math.max(totalPages, 1)} · {totalCount} total
            </span>
            <button
              className="btn btn-outline"
              disabled={!hasNextPage}
              onClick={() => goToPage(pageNo + 1)}
            >
              Next
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Customer Management · {totalCount > 0
            ? `Page ${pageNo} of ${Math.max(totalPages, 1)} · ${totalCount} total`
            : 'No customers loaded'}
        </p>
      </footer>

      {(pendingToggle || pendingDelete) && (
        <>
          <div className="modal-backdrop" onClick={cancelConfirm} aria-hidden="true" />
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelConfirm();
            }}
          >
            <div className="confirm-modal-header">
              <div className={`confirm-icon ${pendingDelete ? 'danger' : 'warning'}`}>
                {pendingDelete ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
              </div>
              <h3 id="confirm-title" className="confirm-title">
                {pendingDelete ? 'Delete customer?' : 'Change customer status?'}
              </h3>
            </div>
            <p id="confirm-body" className="confirm-body">
              {pendingDelete ? (
                <>
                  This will remove <strong>{pendingDelete.name}</strong> from your customer list.
                  You can undo this by restoring the record before it is permanently purged.
                </>
              ) : pendingToggle ? (
                <>
                  {pendingToggle.status === 'active'
                    ? `Deactivate`
                    : `Activate`}{' '}
                  <strong>{pendingToggle.name}</strong>?{' '}
                  {pendingToggle.status === 'active'
                    ? 'They will no longer appear as active in your list.'
                    : 'They will be marked as active again.'}
                </>
              ) : null}
            </p>

            {actionError && <div className="error-message">{actionError}</div>}

            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={cancelConfirm}
                disabled={
                  (!!pendingToggle && !!rowBusy[pendingToggle.id]) ||
                  (!!pendingDelete && !!rowBusy[pendingDelete.id])
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className={pendingDelete ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={pendingDelete ? confirmDelete : confirmToggle}
                disabled={
                  (!!pendingToggle && !!rowBusy[pendingToggle.id]) ||
                  (!!pendingDelete && !!rowBusy[pendingDelete.id])
                }
              >
                {(pendingToggle && rowBusy[pendingToggle.id]) ||
                (pendingDelete && rowBusy[pendingDelete.id]) ? (
                  <span className="spinner-small"></span>
                ) : pendingDelete ? (
                  'Delete'
                ) : pendingToggle?.status === 'active' ? (
                  'Deactivate'
                ) : (
                  'Activate'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Customers;