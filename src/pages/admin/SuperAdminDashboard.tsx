import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Database,
  UserPlus,
  GitFork,
  Trash2,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Eye,
  Settings,
  Lock,
  Mail,
} from 'lucide-react';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { authenticatedFetch } from '../../utils/api.ts';
import { useToastStore } from '../../stores/useToastStore.ts';

export interface CustomerRecord {
  customer_id: string;
  customer_name: string;
  admin_email: string;
  viewer_login_code: string;
  family_tree_name: string;
  family_tree_id: string;
  created_time: string;
  member_count?: number;
  memory_count?: number;
}

export const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToastStore();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [familyTreeName, setFamilyTreeName] = useState('');
  const [viewerLoginCode, setViewerLoginCode] = useState('');
  const [viewerPassword, setViewerPassword] = useState('');

  // Super Admin Account Settings states
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [superEmailInput, setSuperEmailInput] = useState('superadmin@familyroots.heritage');
  const [superPasswordInput, setSuperPasswordInput] = useState('');
  const [superConfirmPasswordInput, setSuperConfirmPasswordInput] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const fetchSuperAccount = async () => {
    try {
      const res = await authenticatedFetch('/api/super-admin/account');
      const json = await res.json();
      if (res.ok && json.success && json.data?.email) {
        setSuperEmailInput(json.data.email);
      }
    } catch {}
  };

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch('/api/super-admin/customers');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setCustomers(json.data);

        // Auto-suggest next customer ID if empty
        if (!customerIdInput) {
          const maxNum = json.data.reduce((max: number, c: CustomerRecord) => {
            const m = c.customer_id.match(/CUST-(\d+)/i);
            return m ? Math.max(max, parseInt(m[1], 10)) : max;
          }, 1000);
          setCustomerIdInput(`CUST-${maxNum + 1}`);
          setViewerLoginCode(`VIEW-${maxNum + 1}`);
        }
      }
    } catch {
      toastError('Failed to load customer records from SQL database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const role = typeof localStorage !== 'undefined' ? (localStorage.getItem('familyroots_user_role') || '').toUpperCase() : '';
    if (role && role !== 'SUPER_ADMIN') {
      navigate('/family/tree', { replace: true });
      return;
    }
    fetchCustomers();
    fetchSuperAccount();
  }, [navigate]);

  const handleOpenSettings = () => {
    setSettingsError(null);
    setSettingsSuccess(null);
    setSuperPasswordInput('');
    setSuperConfirmPasswordInput('');
    fetchSuperAccount();
    setIsSettingsModalOpen(true);
  };

  const handleSaveAccountSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);

    if (!superEmailInput.trim()) {
      setSettingsError('Super Admin email address is required.');
      return;
    }

    if (superPasswordInput && superPasswordInput.length < 4) {
      setSettingsError('Super Admin password must be at least 4 characters long.');
      return;
    }

    if (superPasswordInput && superPasswordInput !== superConfirmPasswordInput) {
      setSettingsError('New passwords do not match.');
      return;
    }

    setIsSavingSettings(true);
    try {
      const res = await authenticatedFetch('/api/super-admin/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: superEmailInput.trim().toLowerCase(),
          password: superPasswordInput.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to update credentials');
      }

      setSettingsSuccess('Super Admin credentials updated successfully and persisted in SQL database.');
      success('Super Admin credentials updated successfully in SQL database.', 'Credentials Saved');

      setTimeout(() => {
        setIsSettingsModalOpen(false);
        setSuperPasswordInput('');
        setSuperConfirmPasswordInput('');
        setSettingsSuccess(null);
      }, 1200);
    } catch (err: any) {
      setSettingsError(err?.message || 'Failed to update credentials.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await authenticatedFetch('/api/super-admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerIdInput.trim() || undefined,
          customer_name: customerName.trim(),
          admin_email: adminEmail.trim().toLowerCase(),
          admin_password: adminPassword.trim() || 'AdminPassword#2026',
          viewer_login_code: viewerLoginCode.trim() || undefined,
          viewer_password: viewerPassword.trim() || 'FamilyRoots#2026',
          family_tree_name: familyTreeName.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to create customer');
      }

      const newRecord: CustomerRecord = json.data;
      // Live state update: Immediately insert new record into table without reloading
      setCustomers((prev) => [newRecord, ...prev]);

      setFormSuccess(
        `Customer "${newRecord.customer_name}" and Family Tree "${newRecord.family_tree_name}" registered successfully into SQL database with separate Admin and Viewer credentials!`
      );
      success('Customer record inserted into SQL database.');

      // Reset form and compute next IDs
      const nextNumMatch = newRecord.customer_id.match(/\d+/);
      const nextNum = nextNumMatch ? parseInt(nextNumMatch[0], 10) + 1 : 1002;
      setCustomerIdInput(`CUST-${nextNum}`);
      setViewerLoginCode(`VIEW-${nextNum}`);
      setCustomerName('');
      setAdminEmail('');
      setAdminPassword('');
      setViewerPassword('');
      setFamilyTreeName('');
    } catch (err: any) {
      setFormError(err.message || 'An error occurred creating customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete customer ${id} (${name}) from the SQL database?`)) {
      return;
    }

    try {
      const res = await authenticatedFetch(`/api/super-admin/customers/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCustomers((prev) => prev.filter((c) => c.customer_id !== id));
        success(`Customer ${id} removed from SQL database.`);
      } else {
        toastError(json.error?.message || 'Failed to delete customer record.');
      }
    } catch {
      toastError('Network error deleting customer.');
    }
  };

  const handleCopyCredentials = (c: CustomerRecord) => {
    const text = `Admin Email: ${c.admin_email} | Viewer Code: ${c.viewer_login_code} | Tree: ${c.family_tree_name}`;
    navigator.clipboard.writeText(text);
    setCopiedId(c.customer_id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.admin_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.family_tree_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                  Super Admin Application Dashboard
                </h1>
                <p className="text-xs text-[#64748B] font-medium">
                  Centralized Customer Provisioning, Family Tree Tenant Management & SQL Database
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* SQL Database Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 shadow-2xs font-semibold">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>SQL Database: Connected (customers_family_trees)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenSettings}
              leftIcon={<Settings className="w-3.5 h-3.5 text-indigo-600" />}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
            >
              Account Settings
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={fetchCustomers}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Customers</div>
                <div className="text-2xl font-extrabold text-[#0F172A] mt-1">{customers.length}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Family Trees</div>
                <div className="text-2xl font-extrabold text-[#0F172A] mt-1">{customers.length}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <GitFork className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Relatives</div>
                <div className="text-2xl font-extrabold text-[#0F172A] mt-1">
                  {customers.reduce((sum, c) => sum + (c.member_count || 0), 0)}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Role</div>
                <div className="text-sm font-extrabold text-indigo-700 mt-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                  <span>SUPER_ADMIN</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Synchronized 2-Section Layout: Section 1 (Form) + Section 2 (Live Table) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SECTION 1: Create Customer / Family Tree Form */}
          <div className="lg:col-span-5">
            <Card className="p-5 sm:p-6 bg-white border border-[#CBD5E1] shadow-md rounded-3xl sticky top-4">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#F1F5F9]">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A]">Create Customer / Family Tree</h2>
                  <p className="text-[11px] text-slate-500">Insert record into SQL database & provision tree</p>
                </div>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateCustomer} className="space-y-3.5 text-xs">
                {/* 1. Customer ID */}
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="1. Customer ID *"
                    value={customerIdInput}
                    onChange={(e) => setCustomerIdInput(e.target.value)}
                    placeholder="e.g. CUST-1003"
                    required
                  />
                  {/* 7. Family Tree Name */}
                  <Input
                    label="2. Family Tree Name *"
                    value={familyTreeName}
                    onChange={(e) => setFamilyTreeName(e.target.value)}
                    placeholder="e.g. Sharma Family Heritage"
                    required
                  />
                </div>

                {/* 2. Customer Name (Admin) */}
                <Input
                  label="3. Customer Name (Admin) *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Vikram Sharma"
                  required
                />

                {/* Admin Credentials Group */}
                <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-3">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Admin Login Credentials (Full Tree CRUD)</span>
                  </div>
                  {/* 3. Admin Login Email */}
                  <Input
                    label="4. Admin Login Email *"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@sharma.heritage"
                    required
                  />
                  {/* 4. Admin Password */}
                  <Input
                    label="5. Admin Password *"
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Leave empty for AdminPassword#2026"
                  />
                </div>

                {/* Viewer Credentials Group */}
                <div className="p-3 rounded-2xl bg-sky-50/50 border border-sky-200/80 space-y-3">
                  <div className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                    <span>Viewer Shared Credentials (Read-Only Tree + Memories)</span>
                  </div>
                  {/* 5. Viewer Login Code */}
                  <Input
                    label="6. Viewer Login Code *"
                    value={viewerLoginCode}
                    onChange={(e) => setViewerLoginCode(e.target.value.toUpperCase())}
                    placeholder="e.g. VIEW-1003"
                    required
                  />
                  {/* 6. Viewer Password */}
                  <Input
                    label="7. Viewer Password *"
                    type="text"
                    value={viewerPassword}
                    onChange={(e) => setViewerPassword(e.target.value)}
                    placeholder="Leave empty for FamilyRoots#2026"
                  />
                </div>

                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  className="w-full mt-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 font-bold shadow-xs cursor-pointer"
                >
                  Insert Record & Provision Tree
                </Button>
              </form>
            </Card>
          </div>

          {/* SECTION 2: Live Customer & Family Tree Table */}
          <div className="lg:col-span-7">
            <Card className="bg-white border border-[#CBD5E1] shadow-md rounded-3xl overflow-hidden flex flex-col h-full">
              {/* Table Header with Search */}
              <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#2563EB]" />
                    <span>Live Customer & Family Tree Table</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">Live records from SQL table: `customers_family_trees`</p>
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search customers or trees..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Table Body */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Customer ID</th>
                      <th className="py-3 px-4">Admin Name & Email</th>
                      <th className="py-3 px-4">Family Tree Name</th>
                      <th className="py-3 px-4">Viewer Code</th>
                      <th className="py-3 px-4">Created Time</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                          <span>Querying SQL database records...</span>
                        </td>
                      </tr>
                    ) : filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No customer records found matching your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((cust) => (
                        <tr key={cust.customer_id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-[#2563EB]">
                              {cust.customer_id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#0F172A]">{cust.customer_name}</div>
                            <div className="text-[10.5px] text-slate-500 truncate">{cust.admin_email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <GitFork className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{cust.family_tree_name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {cust.member_count ?? 0} {cust.member_count === 1 ? 'relative' : 'relatives'}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                              {cust.viewer_login_code}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{new Date(cust.created_time).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyCredentials(cust)}
                                title="Copy Credentials"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer"
                              >
                                {copiedId === cust.customer_id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(cust.customer_id, cust.customer_name)}
                                title="Delete Customer Record from SQL Database"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>

        {/* Super Admin Account Settings Modal */}
        <Modal
          isOpen={isSettingsModalOpen}
          onClose={() => {
            if (!isSavingSettings) {
              setIsSettingsModalOpen(false);
              setSettingsError(null);
              setSettingsSuccess(null);
            }
          }}
          title="Super Admin Account Settings"
          description="Update your Master Super Admin login credentials. New credentials will be immediately persisted in the SQL database for subsequent logins."
          maxWidth="md"
        >
          <form onSubmit={handleSaveAccountSettings} className="space-y-4">
            {settingsError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            <Input
              label="Super Admin Email *"
              type="email"
              value={superEmailInput}
              onChange={(e) => setSuperEmailInput(e.target.value)}
              placeholder="e.g. superadmin@familyroots.heritage"
              leftIcon={<Mail className="w-3.5 h-3.5 text-slate-400" />}
              required
            />

            <div className="pt-1">
              <Input
                label="New Super Admin Password (leave blank to keep current)"
                type="password"
                value={superPasswordInput}
                onChange={(e) => setSuperPasswordInput(e.target.value)}
                placeholder="Enter new master password (min 4 characters)"
                leftIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
              />
            </div>

            {superPasswordInput.trim().length > 0 && (
              <Input
                label="Confirm New Password *"
                type="password"
                value={superConfirmPasswordInput}
                onChange={(e) => setSuperConfirmPasswordInput(e.target.value)}
                placeholder="Re-type new password"
                leftIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                required={superPasswordInput.trim().length > 0}
              />
            )}

            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
              <strong>Persistence note:</strong> Credential changes are written to the SQLite <code>super_admin_credentials</code> table and synced directly with your authentication session.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                disabled={isSavingSettings}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <Button
                type="submit"
                isLoading={isSavingSettings}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold"
                leftIcon={<KeyRound className="w-3.5 h-3.5" />}
              >
                Save Credentials
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
