import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldAlert,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { setAuthTokens } from '../../utils/api.ts';

export const MasterAdminAuthPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('superadmin@familyroots.heritage');
  const [password, setPassword] = useState('MasterAdmin@2026');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFillCredentials = () => {
    setEmail('superadmin@familyroots.heritage');
    setPassword('MasterAdmin@2026');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Master Admin email is required.');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('Master Admin password is required.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/masterlogin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success && json?.data?.accessToken) {
        setAuthTokens(json.data.accessToken, json.data.refreshToken);
        localStorage.setItem('familyroots_user_role', 'SUPER_ADMIN');
        localStorage.removeItem('familyroots_master_impersonation');
        navigate('/master-admin/dashboard');
        return;
      }

      // If credentials failed
      const errorMsg =
        json?.error?.message ||
        json?.message ||
        'Invalid Master Admin credentials. Please check your email and password.';
      setErrorMessage(errorMsg);
    } catch {
      // Network or unexpected error
      setErrorMessage('Failed to connect to authentication server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Return to Public Sign In */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Family Tree Sign In</span>
        </Link>
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-md mb-3 ring-4 ring-indigo-100">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Master Admin Portal
        </h1>
        <p className="text-xs text-slate-600 mt-1.5 font-medium">
          Privileged authentication challenge required to unlock master platform controls
        </p>
      </div>

      {/* Login Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8 shadow-lg border border-slate-200 bg-white rounded-3xl">
          {/* Quick Credential Pre-fill Helper */}
          <div className="mb-5 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Default Master Credentials</span>
              </div>
              <div className="text-[10px] text-slate-600 font-mono truncate mt-0.5">
                superadmin@familyroots.heritage &bull; MasterAdmin@2026
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillCredentials}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Fill</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-xs text-rose-900 flex items-start gap-3 shadow-xs animate-in fade-in duration-200"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-rose-950 text-xs">Authentication Failed</div>
                <div className="mt-0.5 text-rose-800 leading-relaxed font-medium">
                  {errorMessage}
                </div>
              </div>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Master Admin Email *"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="superadmin@familyroots.heritage"
              leftIcon={<Mail className="w-3.5 h-3.5 text-slate-400" />}
              error={errorMessage ? ' ' : undefined}
              required
            />

            <Input
              label="Master Admin Password *"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="MasterAdmin@2026"
              leftIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
              error={errorMessage ? ' ' : undefined}
              required
            />

            <Button
              type="submit"
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 shadow-sm font-bold cursor-pointer"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Unlock Master Controls
            </Button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Protected SQLite Tenant & Multi-Family Database Access</span>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MasterAdminAuthPage;
