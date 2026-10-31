import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgConfig } from '@/contexts/ConfigContext';
import { requestResetEmail } from '@/lib/passwordResetService';
import { ArrowLeft, CheckCircle2, Loader2, Mail, RotateCcw, Zap } from 'lucide-react';

const DEFAULT_LOGIN_LOGO = '/attached_assets/image_1786602878335.png';

function getBrandName(displayName: string, industry: string) {
  const match = (displayName || 'Nido Tech').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {
    name: match ? match[1].trim() : (displayName || 'Nido Tech'),
    subtitle: match ? match[2].trim() : (industry || null),
  };
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const org = useOrgConfig();
  const brand = getBrandName(org.displayName, org.industry);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    setError('');

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    await requestResetEmail(normalizedEmail);
    setIsLoading(false);
    setIsSuccess(true);
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
                <div className="text-2xl font-extrabold leading-tight tracking-tight text-white">
                  {brand.name}
                </div>
                {brand.subtitle && (
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
                    {brand.subtitle}
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-6">Secure account recovery</h1>
            <div className="space-y-4">
              {[
                'Use your registered email address',
                'Reset requests are privacy-preserving',
                'Choose a strong new password',
              ].map((item) => (
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
                  <img
                    src={org.logoUrl || DEFAULT_LOGIN_LOGO}
                    alt={org.displayName || 'Nido Tech'}
                    className="h-full w-full object-contain object-left"
                  />
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
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
                  <p className="text-sm leading-relaxed text-gray-600">
                    If an account exists for this email address, you will receive a password reset link shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/reset-password')}
                    className="mt-6 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    Continue to Reset Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSuccess(false); setEmail(''); }}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                  >
                    <RotateCcw size={14} /> Try another email
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot your password?</h1>
                    <p className="text-gray-600 text-sm">
                      Enter your registered email address and we&apos;ll send you a password reset link.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-gray-900">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          id="forgot-email"
                          type="email"
                          value={email}
                          onChange={(event) => { setEmail(event.target.value); setError(''); }}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-gray-900 transition-all focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="your@email.com"
                          autoComplete="email"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : 'Send Reset Link'}
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