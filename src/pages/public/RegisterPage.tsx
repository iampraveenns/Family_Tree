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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password;

    if (!cleanIdentifier || !cleanPassword) {
      setErrorMessage('Please enter both your Email or Viewer Code and Password.');
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
      }
    } catch {
      setErrorMessage('Unable to connect to the authentication server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoIdentifier: string, demoPass: string) => {
    setIsLoading(true);
    setErrorMessage(null);
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
        <p className="text-sm text-[#64748B] mt-1.5 font-medium">
          Preserve, explore, and cherish your family heritage
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8 shadow-lg border border-[#CBD5E1] bg-white rounded-3xl">
          {/* Clean Welcome Header */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-[#0F172A]">
              Welcome to Family Tree Sign In
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your credentials to access your family tree
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Unified Single Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <Input
              label="Email or Viewer Code *"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. admin@pattara.heritage or VIEW-1001"
              leftIcon={<Mail className="w-3.5 h-3.5 text-slate-400" />}
              required
            />

            <Input
              label="Password *"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              leftIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
              required
            />

            <Button
              type="submit"
              className="w-full mt-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 shadow-sm font-semibold cursor-pointer"
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
              {/* Master Admin Card */}
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin('superadmin@familyroots.heritage', 'SuperAdmin#2026')
                }
                disabled={isLoading}
                className="w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-left transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Master Admin</span>
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
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    admin@pattara.heritage
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
