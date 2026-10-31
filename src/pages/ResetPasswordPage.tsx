import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgConfig } from '@/contexts/ConfigContext';
import { completePasswordReset } from '@/lib/passwordResetService';
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Loader2, Lock, X, Zap } from 'lucide-react';

const DEFAULT_LOGIN_LOGO = '/attached_assets/image_1786602878335.png';

function getBrandName(displayName: string, industry: string) {
  const match = (displayName || 'Nido Tech').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {
    name: match ? match[1].trim() : (displayName || 'Nido Tech'),
    subtitle: match ? match[2].trim() : (industry || null),
  };
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const org = useOrgConfig();
  const brand = getBrandName(org.displayName, org.industry);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const requirements = useMemo(() => [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'One number', valid: /\d/.test(password) },
  ], [password]);

  const allRequirementsMet = requirements.every((requirement) => requirement.valid);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = allRequirementsMet && passwordsMatch && !isLoading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (!allRequirementsMet) {
      setError('Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    await completePasswordReset(password);
    setIsLoading(false);
    setIsSuccess(true);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-12 items-center"
          style={{
            fontFamily: 'Roboto, Lato, system-ui, sans-serif',
            fontWeight: '800',
            borderRadius: '15px',
          }}
        >
          <div className="hidden lg:block bg-black" style={{ marginLeft: '20px' }}>
            <div className="mb-14 flex flex-col items-start">
              <div
                role="img"
                aria-label={org.displayName || 'Nido Tech'}
                className="h-14 w-14 overflow-hidden rounded-xl bg-white/5 bg-left bg-no-repeat ring-1 ring-white/10"
                style={{
                  backgroundImage: `url("${org.logoUrl || DEFAULT_LOGIN_LOGO}")`,
                  backgroundSize: 'auto 100%',
                }}
              />
              <div className="mt-3">
                <div className="text-2xl font-extrabold leading-tight tracking-tight text-white">{brand.name}</div>
                {brand.subtitle && (
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-white/60">{brand.subtitle}</div>
                )}
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-6">Protect your account</h1>
            <div className="space-y-4">
              {['Use a unique password', 'Include letters and numbers', 'Keep your credentials private'].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="text-gray-400 mt-1">✓</div>
                  <p className="text-white">{item}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-white mt-12">© {new Date().getFullYear()} {org.companyName}</p>
          </div>

          <div className="w-full max-w-sm lg:ml-[50px] lg:mr-[-50px]">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10">
              <div className="mb-8 flex items-center gap-3">
                <div className={`${org.logoUrl ? 'h-10 w-10 rounded-lg border border-gray-200' : 'h-14 w-[180px]'} overflow-hidden bg-white flex items-center justify-start shrink-0`}>
                  <img src={org.logoUrl || DEFAULT_LOGIN_LOGO} alt={org.displayName || 'Nido Tech'} className="h-full w-full object-contain object-left" />
                </div>
                {org.logoUrl && (
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold leading-tight text-gray-900">{brand.name}</h2>
                    {brand.subtitle && <p className="mt-0.5 text-xs font-medium text-gray-500">{brand.subtitle}</p>}
                  </div>
                )}
              </div>

              {isSuccess ? (
                <div className="text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Password reset successful</h1>
                  <p className="text-sm leading-relaxed text-gray-600">
                    Your password has been updated successfully. You can now sign in with your new password.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Create a new password</h1>
                    <p className="text-gray-600 text-sm">Enter and confirm your new password below.</p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-900">New Password</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          id="new-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => { setPassword(event.target.value); setError(''); }}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-10 text-gray-900 transition-all focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter a strong password"
                          autoComplete="new-password"
                          disabled={isLoading}
                          required
                        />
                        <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Password requirements</p>
                      <div className="space-y-1.5">
                        {requirements.map((requirement) => (
                          <div key={requirement.label} className={`flex items-center gap-2 text-xs ${requirement.valid ? 'text-green-600' : 'text-gray-500'}`}>
                            {requirement.valid ? <Check size={14} /> : <X size={14} />}
                            {requirement.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-900">Confirm New Password</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
                          className={`w-full rounded-lg border bg-gray-50 py-2.5 pl-9 pr-10 text-gray-900 transition-all focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 ${confirmPassword && !passwordsMatch ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                          placeholder="Re-enter your password"
                          autoComplete="new-password"
                          disabled={isLoading}
                          required
                        />
                        <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {confirmPassword && !passwordsMatch && <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? <><Loader2 size={18} className="animate-spin" /> Resetting…</> : 'Reset Password'}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
                  >
                    <ArrowLeft size={15} /> Back to Login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}