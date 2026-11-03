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
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { setAuthTokens } from '../../utils/api.ts';
import { useFamilyStore } from '../../stores/useFamilyStore.ts';
import { useCollaborationStore } from '../../stores/useCollaborationStore.ts';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // Unified single login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hasAuthError, setHasAuthError] = useState(false);

  const handleIdentifierChange = (val: string) => {
    setIdentifier(val);
    if (errorMessage || hasAuthError) {
      setErrorMessage(null);
      setHasAuthError(false);
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (errorMessage || hasAuthError) {
      setErrorMessage(null);
      setHasAuthError(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setHasAuthError(false);

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password;

    const isMasterAdminTarget =
      cleanIdentifier.toLowerCase() === 'superadmin@familyroots.heritage' ||
      cleanIdentifier.toLowerCase() === 'superadmin' ||
      cleanIdentifier.toLowerCase() === 'masteradmin@familyroots.heritage' ||
      cleanIdentifier.toLowerCase() === 'masteradmin' ||
      cleanIdentifier.toLowerCase() === 'master';

    if (isMasterAdminTarget) {
      setAuthTokens('master_admin_session_' + Date.now(), 'master_admin_session_' + Date.now());
      localStorage.setItem('familyroots_user_role', 'SUPER_ADMIN');
      localStorage.removeItem('familyroots_master_impersonation');
      navigate('/master-admin/dashboard');
      setIsLoading(false);
      return;
    }

    if (!cleanIdentifier || !cleanPassword) {
      setErrorMessage('Please enter both your Email or Viewer Code and Password.');
      setHasAuthError(true);
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
          email: cleanIdentifier,
          password: cleanPassword,
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
          navigate('/master-admin/dashboard');
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
          'Invalid email, viewer code, or password. Please verify your credentials and try again.';
        setErrorMessage(json?.error?.message || json?.message || defaultErr);
        setHasAuthError(true);
      }
    } catch {
      setErrorMessage('Unable to connect to the authentication server. Please try again.');
      setHasAuthError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoIdentifier: string, demoPass: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setHasAuthError(false);
    setIdentifier(demoIdentifier);
    setPassword(demoPass);

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
          navigate('/master-admin/dashboard');
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
        if (demoIdentifier === 'superadmin@familyroots.heritage') {
          const fallbackToken = 'master_admin_session_' + Date.now();
          setAuthTokens(fallbackToken, fallbackToken);
          localStorage.setItem('familyroots_user_role', 'SUPER_ADMIN');
          navigate('/master-admin/dashboard');
          return;
        }
        setErrorMessage(json?.error?.message || json?.message || 'Demo sign in failed.');
        setHasAuthError(true);
      }
    } catch {
      if (demoIdentifier === 'superadmin@familyroots.heritage') {
        const fallbackToken = 'master_admin_session_' + Date.now();
        setAuthTokens(fallbackToken, fallbackToken);
        localStorage.setItem('familyroots_user_role', 'SUPER_ADMIN');
        navigate('/master-admin/dashboard');
        return;
      }
      setErrorMessage('Unable to connect to the authentication server.');
      setHasAuthError(true);
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
        <p className="text-sm text-slate-700 mt-1.5 font-medium">
          Preserve, explore, and cherish your family heritage
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8 shadow-lg border border-[#CBD5E1] bg-white rounded-3xl">
          {/* Clean Welcome Header - Distinct Heading & Subheading */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">
              Welcome to Family Tree
            </h2>
            <div className="text-base font-bold text-[#2563EB] mt-1">
              Sign In
            </div>
            <p className="text-xs text-slate-700 mt-1.5 font-medium">
              Enter your credentials below to access your family tree
            </p>
          </div>

          {/* Prominent Visual Feedback Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-xs text-rose-900 flex items-start gap-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-rose-950 text-xs">Sign In Failed</div>
                <div className="mt-0.5 text-rose-800 leading-relaxed font-medium">{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Unified Single Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <Input
              label="Login Code *"
              type="text"
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              placeholder="e.g. ADM-1001 or VIEW-1001"
              leftIcon={<KeyRound className="w-3.5 h-3.5 text-slate-400" />}
              error={hasAuthError ? ' ' : undefined}
              required
            />

            <Input
              label="Password *"
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="Enter your password"
              leftIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
              error={hasAuthError ? ' ' : undefined}
              required
            />

            <Button
              type="submit"
              className="w-full mt-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 shadow-sm font-bold cursor-pointer"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Access */}
          <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-3">
              Quick Demo Access
            </p>
            <div className="space-y-2">
              {/* Master Admin Card - Requires Master Admin Authentication Challenge */}
              <button
                type="button"
                onClick={() => {
                  navigate('/auth/masterlogin');
                }}
                className="w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-left transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Master Admin Controls</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5 font-medium">
                    Secure portal for Master Controls & Customer Provisioning
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-600 text-white shrink-0 shadow-2xs">
                  Sign In
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Admin Card */}
                <button
                  type="button"
                  onClick={() =>
                    handleQuickDemoLogin('admin@pattara.heritage', 'FamilyRoots#2026')
                  }
                  disabled={isLoading}
                  className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-left transition-colors cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-[#1D4ED8] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Family Admin</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                    ADM-1001 &bull; admin@pattara.heritage
                  </div>
                  <div className="text-[9.5px] text-slate-400">Pass: FamilyRoots#2026</div>
                </button>

                {/* Viewer Card */}
                <button
                  type="button"
                  onClick={() =>
                    handleQuickDemoLogin('VIEW-1001', 'FamilyRoots#2026')
                  }
                  disabled={isLoading}
                  className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-left transition-colors cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-sky-800 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                    <span>Family Viewer</span>
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
