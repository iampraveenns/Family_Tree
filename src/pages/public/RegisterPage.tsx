import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitFork, Lock, Mail, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { setAuthTokens } from '../../utils/api.ts';
import { useFamilyStore } from '../../stores/useFamilyStore.ts';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSignInMode, setIsSignInMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const displayName = `${firstName} ${lastName}`.trim() || 'Family Historian';

    try {
      const endpoint = isSignInMode ? '/api/auth/login' : '/api/auth/register';
      const body = isSignInMode
        ? { email: email.trim(), password }
        : { displayName, email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data?.accessToken) {
        setAuthTokens(json.data.accessToken, json.data.refreshToken);
        await useFamilyStore.getState().fetchFamilyTree();
        navigate('/family/tree');
      } else {
        setErrorMessage(
          json.error?.message ||
          json.message ||
          (isSignInMode
            ? 'Invalid email or password. Please try again or use Quick Demo Access.'
            : 'Password must be at least 8 characters with at least one letter and number.')
        );
      }
    } catch {
      setErrorMessage('Unable to connect to server. You can also explore directly using Demo Access.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setIsLoading(true);
    try {
      await useFamilyStore.getState().fetchFamilyTree();
      navigate('/family/tree');
    } catch {
      navigate('/family/tree');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-white mx-auto flex items-center justify-center shadow-md mb-4 ring-4 ring-blue-100">
          <GitFork className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
          FamilyTree
        </h1>
        <p className="text-sm text-[#64748B] mt-2">
          {isSignInMode
            ? 'Sign in to access your family tree'
            : 'Create your account to explore and build your family tree'}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8 shadow-md border border-[#E2E8F0] bg-white rounded-3xl">
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isSignInMode && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                />
                <Input
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                />
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              required
            />

            <Button
              type="submit"
              className="w-full mt-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 shadow-sm font-semibold"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isSignInMode ? 'Sign In to Family Tree' : 'Create Account & Open Tree'}
            </Button>
          </form>

          {/* Quick Demo Access Button */}
          <div className="mt-5 pt-4 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-2.5 px-4 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#1E293B] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>Direct Demo Access (Explore Tree Instantly)</span>
            </button>
          </div>

          {/* Mode Switcher: Sign In <-> Sign Up */}
          <div className="mt-4 text-center text-xs text-[#64748B]">
            {isSignInMode ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignInMode(false);
                    setErrorMessage(null);
                  }}
                  className="text-[#2563EB] font-semibold hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignInMode(true);
                    setErrorMessage(null);
                  }}
                  className="text-[#2563EB] font-semibold hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
