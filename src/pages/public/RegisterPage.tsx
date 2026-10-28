import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitFork,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Eye,
  KeyRound,
  Hash,
} from 'lucide-react';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { setAuthTokens } from '../../utils/api.ts';
import { useFamilyStore } from '../../stores/useFamilyStore.ts';
import { useCollaborationStore } from '../../stores/useCollaborationStore.ts';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  // Separate login modes: 'admin' vs 'viewer'
  const [loginMode, setLoginMode] = useState<'admin' | 'viewer'>('admin');

  // Admin form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Viewer form state
  const [viewerCode, setViewerCode] = useState('');
  const [viewerPassword, setViewerPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const credentialIdentifier = loginMode === 'admin'
      ? adminEmail.trim().toLowerCase()
      : viewerCode.trim().toUpperCase();

    const credentialPassword = loginMode === 'admin' ? adminPassword : viewerPassword;

    if (!credentialIdentifier || !credentialPassword) {
      setErrorMessage(
        loginMode === 'admin'
          ? 'Please enter both your Admin Email and Password.'
          : 'Please enter both your Viewer Login Code and Viewer Password.'
      );
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: credentialIdentifier,
          password: credentialPassword,
        }),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success && json?.data?.accessToken) {
        setAuthTokens(json.data.accessToken, json.data.refreshToken);
        const userRole = json.data.user?.role;
        if (userRole) {
          localStorage.setItem('familyroots_user_role', userRole);
        }

        if (userRole === 'SUPER_ADMIN') {
          navigate('/super-admin/dashboard');
          return;
        }

        // Fetch dynamic family tree for the authenticated user account
        if (json.data.user?.familyTreeId) {
          await useFamilyStore.getState().setActiveFamilyId(json.data.user.familyTreeId);
        }
        await useFamilyStore.getState().fetchFamilyTree();
        const currentFam = useFamilyStore.getState().currentFamily;
        if (currentFam?.id) {
          await useCollaborationStore.getState().fetchPermissions(currentFam.id);
        }

        navigate('/family/tree');
      } else {
        const defaultErr =
          loginMode === 'admin'
            ? 'Account not registered or invalid Admin credentials. Contact Super Admin to provision your account.'
            : 'Invalid Viewer Login Code or Viewer Password. Contact your Family Admin or Super Admin.';
        setErrorMessage(json?.error?.message || json?.message || defaultErr);
      }
    } catch {
      setErrorMessage('Unable to connect to the authentication server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (
    targetMode: 'admin' | 'viewer',
    demoIdentifier: string,
    demoPass: string
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLoginMode(targetMode);

    if (targetMode === 'admin') {
      setAdminEmail(demoIdentifier);
      setAdminPassword(demoPass);
    } else {
      setViewerCode(demoIdentifier);
      setViewerPassword(demoPass);
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: demoIdentifier, password: demoPass }),
      });

      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.data?.accessToken) {
        setAuthTokens(json.data.accessToken, json.data.refreshToken);
        const userRole = json.data.user?.role;
        if (userRole) {
          localStorage.setItem('familyroots_user_role', userRole);
        }

        if (userRole === 'SUPER_ADMIN') {
          navigate('/super-admin/dashboard');
          return;
        }

        if (json.data.user?.familyTreeId) {
          await useFamilyStore.getState().setActiveFamilyId(json.data.user.familyTreeId);
        }
        await useFamilyStore.getState().fetchFamilyTree();
        const currentFam = useFamilyStore.getState().currentFamily;
        if (currentFam?.id) {
          await useCollaborationStore.getState().fetchPermissions(currentFam.id);
        }
        navigate('/family/tree');
      } else {
        setErrorMessage(json?.error?.message || json?.message || 'Demo sign in failed.');
      }
    } catch {
      setErrorMessage('Unable to connect to the authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-white mx-auto flex items-center justify-center shadow-md mb-3 ring-4 ring-blue-100">
          <GitFork className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
          FamilyTree
        </h1>
        <p className="text-xs text-[#64748B] mt-1.5 font-medium">
          Three-Tier RBAC & SQL Tenant Management System
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8 shadow-lg border border-[#CBD5E1] bg-white rounded-3xl">
          {/* Strict Provisioning Notice */}
          <div className="mb-5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11.5px]">
              <strong>Provisioned Access Only:</strong> Public self-registration is disabled. All Admin accounts and Viewer codes are provisioned exclusively by the Super Admin in the SQL database.
            </p>
          </div>

          {/* Login Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] rounded-2xl border border-[#CBD5E1] mb-5">
            <button
              type="button"
              onClick={() => {
                setLoginMode('admin');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                loginMode === 'admin'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('viewer');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                loginMode === 'viewer'
                  ? 'bg-white text-[#0284C7] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Viewer Login</span>
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode 1: Admin Login Form */}
          {loginMode === 'admin' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-[11.5px] text-slate-500 font-medium">
                Sign in with your provisioned Admin credentials:
              </div>

              <Input
                label="Admin Email *"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@pattara.heritage"
                leftIcon={<Mail className="w-3.5 h-3.5 text-slate-400" />}
                required
              />

              <Input
                label="Admin Password *"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
                leftIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                required
              />

              <Button
                type="submit"
                className="w-full mt-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 shadow-sm font-semibold"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In as Admin
              </Button>
            </form>
          )}

          {/* Mode 2: Viewer Login Form */}
          {loginMode === 'viewer' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-[11.5px] text-slate-500 font-medium">
                Sign in with your family tree Viewer Code and dedicated Viewer Password:
              </div>

              <Input
                label="Viewer Login Code *"
                type="text"
                value={viewerCode}
                onChange={(e) => setViewerCode(e.target.value.toUpperCase())}
                placeholder="e.g. VIEW-1001"
                leftIcon={<Hash className="w-3.5 h-3.5 text-slate-400" />}
                required
              />

              <Input
                label="Viewer Password *"
                type="password"
                value={viewerPassword}
                onChange={(e) => setViewerPassword(e.target.value)}
                placeholder="Enter viewer password"
                leftIcon={<KeyRound className="w-3.5 h-3.5 text-slate-400" />}
                required
              />

              <Button
                type="submit"
                className="w-full mt-2 bg-[#0284C7] hover:bg-[#0369A1] text-white py-2.5 shadow-sm font-semibold"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In as Viewer (Read-Only)
              </Button>
            </form>
          )}

          {/* Three-Tier Quick Demo Access */}
          <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-2.5">
              Three-Tier Quick Demo Access
            </p>
            <div className="space-y-2">
              {/* Tier 1: Super Admin */}
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin('admin', 'superadmin@familyroots.heritage', 'SuperAdmin#2026')
                }
                disabled={isLoading}
                className="w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-left transition-colors cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Super Admin Master (Platform & SQL Dashboard)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    superadmin@familyroots.heritage &bull; SuperAdmin#2026
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 shrink-0">
                  Dashboard
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Tier 2: Admin (Customer) */}
                <button
                  type="button"
                  onClick={() =>
                    handleQuickDemoLogin('admin', 'admin@pattara.heritage', 'FamilyRoots#2026')
                  }
                  disabled={isLoading}
                  className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#1D4ED8] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Admin (Customer)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    admin@pattara.heritage
                  </div>
                  <div className="text-[9.5px] text-slate-400">Pass: FamilyRoots#2026</div>
                </button>

                {/* Tier 3: Viewer (Shared Account) */}
                <button
                  type="button"
                  onClick={() =>
                    handleQuickDemoLogin('viewer', 'VIEW-1001', 'FamilyRoots#2026')
                  }
                  disabled={isLoading}
                  className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-sky-800 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                    <span>Viewer (Code Login)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                    VIEW-1001
                  </div>
                  <div className="text-[9.5px] text-slate-400">Pass: FamilyRoots#2026</div>
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
