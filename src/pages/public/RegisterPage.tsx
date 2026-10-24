import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitFork,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  UserPlus,
  KeyRound,
} from 'lucide-react';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { setAuthTokens } from '../../utils/api.ts';
import { useFamilyStore } from '../../stores/useFamilyStore.ts';
import { useCollaborationStore } from '../../stores/useCollaborationStore.ts';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick relative registration modal/state for family admins
  const [isRelativeModalOpen, setIsRelativeModalOpen] = useState(false);
  const [relativeFirstName, setRelativeFirstName] = useState('');
  const [relativeLastName, setRelativeLastName] = useState('');
  const [relativeEmail, setRelativeEmail] = useState('');
  const [relativePassword, setRelativePassword] = useState('');
  const [isRegisteringRelative, setIsRegisteringRelative] = useState(false);
  const [relativeNotice, setRelativeNotice] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const displayName = `${firstName} ${lastName}`.trim() || 'Family Member';

    try {
      const endpoint = activeTab === 'signin' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        activeTab === 'signin'
          ? { email: cleanEmail, password }
          : { displayName, email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success && json?.data?.accessToken) {
        setAuthTokens(json.data.accessToken, json.data.refreshToken);

        // Fetch dynamic family tree for the authenticated user account
        await useFamilyStore.getState().fetchFamilyTree();
        const currentFam = useFamilyStore.getState().currentFamily;
        if (currentFam?.id) {
          await useCollaborationStore.getState().fetchPermissions(currentFam.id);
        }

        navigate('/family/tree');
      } else {
        const errorText =
          json?.error?.message ||
          json?.message ||
          (activeTab === 'signin'
            ? 'Invalid email or password. Please verify your registered account credentials.'
            : 'Registration failed. Password must be at least 8 characters with letters and numbers.');
        setErrorMessage(errorText);
      }
    } catch {
      setErrorMessage('Unable to connect to the JSON authentication server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterRelativeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegisteringRelative(true);
    setRelativeNotice(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: `${relativeFirstName} ${relativeLastName}`.trim(),
          email: relativeEmail.trim().toLowerCase(),
          password: relativePassword,
        }),
      });

      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setRelativeNotice(
          `Account for ${relativeFirstName} (${relativeEmail.trim()}) registered successfully! You can now add them as a tree node using this email.`
        );
        setRelativeFirstName('');
        setRelativeLastName('');
        setRelativeEmail('');
        setRelativePassword('');
      } else {
        setRelativeNotice(json?.error?.message || json?.message || 'Failed to register account.');
      }
    } catch {
      setRelativeNotice('Network error registering relative account.');
    } finally {
      setIsRegisteringRelative(false);
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
          JSON-Based Authentication & Verified Node Mapping System
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8 shadow-lg border border-[#CBD5E1] bg-white rounded-3xl">
          {/* Strict Rule Notice Pill */}
          <div className="mb-5 p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11.5px]">
              <strong>Strict Account Rule:</strong> Every person in the family tree must have a registered account created via this JSON authentication system and maps directly to their member node.
            </p>
          </div>

          {/* Tab Switcher: Sign In vs. Register */}
          <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] rounded-2xl border border-[#CBD5E1] mb-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              Register Account
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* JSON Auth Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {activeTab === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name *"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Arun"
                  leftIcon={<User className="w-3.5 h-3.5 text-slate-400" />}
                  required
                />
                <Input
                  label="Last Name *"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Pattara"
                  required
                />
              </div>
            )}

            <Input
              label="Account Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              leftIcon={<Mail className="w-3.5 h-3.5 text-slate-400" />}
              required
            />

            <Input
              label="Password *"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              leftIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
              required
            />

            <Button
              type="submit"
              className="w-full mt-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 shadow-sm font-semibold"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {activeTab === 'signin' ? 'Sign In & Access Tree' : 'Register Account & Open Tree'}
            </Button>
          </form>

          {/* Helper: Register a relative's account in advance */}
          <div className="mt-5 pt-4 border-t border-[#E2E8F0] text-center">
            <button
              type="button"
              onClick={() => setIsRelativeModalOpen(true)}
              className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register an account for another relative</span>
            </button>
            <p className="text-[10.5px] text-[#64748B] mt-0.5">
              Allows you to create an account for a family member so they can be placed as a tree node.
            </p>
          </div>
        </Card>
      </div>

      {/* Modal: Register Relative User Account */}
      {isRelativeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#CBD5E1] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Register Relative Account</h3>
                  <p className="text-[11px] text-slate-500">Create an account for a relative before adding their node</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRelativeModalOpen(false);
                  setRelativeNotice(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {relativeNotice && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                {relativeNotice}
              </div>
            )}

            <form onSubmit={handleRegisterRelativeAccount} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  label="First Name *"
                  placeholder="Relative's first name"
                  value={relativeFirstName}
                  onChange={(e) => setRelativeFirstName(e.target.value)}
                  required
                />
                <Input
                  label="Last Name *"
                  placeholder="Relative's last name"
                  value={relativeLastName}
                  onChange={(e) => setRelativeLastName(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Registered Email *"
                type="email"
                placeholder="relative@example.com"
                value={relativeEmail}
                onChange={(e) => setRelativeEmail(e.target.value)}
                required
              />

              <Input
                label="Temporary Password *"
                type="password"
                placeholder="Min 8 characters (e.g. Rel#2026)"
                value={relativePassword}
                onChange={(e) => setRelativePassword(e.target.value)}
                required
              />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRelativeModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Done
                </button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isRegisteringRelative}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                >
                  Register Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
