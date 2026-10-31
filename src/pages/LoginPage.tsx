import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { findPortalUser } from '@/lib/portalUserStore';
import {
  authenticateNidoUser,
  getUsers,
  isSystemOwnerPasswordSetupRequired,
  setupSystemOwnerPassword,
  SYSTEM_OWNER_EMAIL,
  unlockUser,
  type LoginContext,
} from '@/lib/nidoUsersStore';
import { consumeRecoveryCode } from '@/lib/recoveryCodeStore';
import { useOrgConfig } from '@/contexts/ConfigContext';
import { Mail, Lock, Eye, EyeOff, Loader2, KeyRound, ShieldAlert, MapPin } from 'lucide-react';

type LoginTab = 'password' | 'recovery';
const DEFAULT_LOGIN_LOGO = '/attached_assets/image_1786602878335.png';

interface LoginContextResult {
  context: LoginContext;
  locationGranted: boolean;
}

async function getLocationPermissionState(): Promise<PermissionState | undefined> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state;
  } catch {
    return undefined;
  }
}

async function captureLoginContext(): Promise<LoginContextResult> {
  const context: LoginContext = {
    device: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  try {
    const response = await fetch('/api/client-context');
    if (response.ok) {
      const data = await response.json() as { ip?: string };
      context.ip = data.ip;
    }
  } catch {
    // The authentication flow still works if the context endpoint is unavailable.
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { context, locationGranted: false };
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 300000,
      });
    });
    context.latitude = position.coords.latitude;
    context.longitude = position.coords.longitude;
    context.locationAccuracy = position.coords.accuracy;
    return { context, locationGranted: true };
  } catch {
    // Some browsers grant permission but cannot return a fresh fix quickly.
    // In that case sign-in may continue and the missing coordinates remain
    // explicitly unrecorded instead of incorrectly treating permission as denied.
    return {
      context,
      locationGranted: (await getLocationPermissionState()) === 'granted',
    };
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const org = useOrgConfig();
  const displayNameParts = (org.displayName || 'Nido Tech').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const mainDisplayName = displayNameParts ? displayNameParts[1].trim() : (org.displayName || 'Nido Tech');
  const displayNameSubtitle = displayNameParts ? displayNameParts[2].trim() : (org.industry || null);

  // Shared
  const [isOwnerSetupRequired, setIsOwnerSetupRequired] = useState(() => isSystemOwnerPasswordSetupRequired());
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [email, setEmail] = useState(isOwnerSetupRequired ? SYSTEM_OWNER_EMAIL : '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password tab
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [locationPrompt, setLocationPrompt] = useState<LoginTab | null>(null);

  // Recovery tab
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  const switchTab = (tab: LoginTab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
    setRecoverySuccess('');
    setIsLocked(false);
  };

  const handleUnlockSelf = () => {
    const users = getUsers();
    const match = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (match) {
      unlockUser(match.id);
      setError('');
      setIsLocked(false);
    } else {
      setError('Enter your email above first, then click Unlock.');
    }
  };

  const completePasswordLogin = async (context: LoginContext) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));

      // ── 1. Try NIDO internal users ────────────────────────────────────────
      const result = authenticateNidoUser(email.trim(), password, context);

      if ('user' in result && result.user) {
        const u = result.user;
        login({ id: u.id, email: u.email, name: u.name, role: u.role, userType: 'nido_admin' });
        navigate('/dashboard', { replace: true });
        return;
      }

      if ('error' in result) {
        if (result.error === 'inactive') { setError('This account has been deactivated. Contact your administrator.'); return; }
        if (result.error === 'suspended') { setError('This account is suspended. Contact your administrator.'); return; }
        if (result.error === 'locked') {
          setError('This account has been locked after too many failed sign-in attempts.');
          setIsLocked(true);
          return;
        }
      }

      // ── 2. Try Client Portal users ────────────────────────────────────────
      const portalUser = findPortalUser(email.trim(), password);
      if (portalUser) {
        login({ id: portalUser.id, email: portalUser.email, name: portalUser.name, role: portalUser.role, userType: portalUser.userType, clientId: portalUser.clientId, clientName: portalUser.clientName });
        navigate('/portal/dashboard', { replace: true });
        return;
      }

      setError('Invalid email or password.');
    } catch {
      setError('An error occurred during sign in. Please try again.');
    }
  };

  const completeRecoveryLogin = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));

      const userId = consumeRecoveryCode(email.trim(), recoveryCode.trim());
      if (!userId) {
        setError('Invalid or already-used recovery code. Please check the code and try again.');
        return;
      }

      // Find the user to build the auth payload
      const nidoUsers = getUsers();
      const nidoUser = nidoUsers.find(u => u.id === userId);

      if (nidoUser) {
        if (nidoUser.status === 'Inactive') { setError('This account has been deactivated. Contact your administrator.'); return; }
        if (nidoUser.status === 'Suspended') { setError('This account is suspended. Contact your administrator.'); return; }
        // Note: recovery login bypasses the account lock so users can regain access
        login({ id: nidoUser.id, email: nidoUser.email, name: nidoUser.name, role: nidoUser.role, userType: 'nido_admin' });
        navigate('/dashboard', { replace: true });
        return;
      }

      setError('Account not found. Make sure the email matches your account.');
    } catch {
      setError('An error occurred. Please try again.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLocked(false);
    setSuccess('');
    if (isOwnerSetupRequired) {
      if (password.length < 8) {
        setError('Use at least 8 characters for the System Owner password.');
        return;
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
      try {
        setupSystemOwnerPassword(password);
        setIsOwnerSetupRequired(false);
        setPassword('');
        setConfirmPassword('');
        setSuccess('System Owner password created. Sign in with the password you just chose.');
      } catch (setupError) {
        setError(setupError instanceof Error ? setupError.message : 'Unable to set up the System Owner account.');
      }
      return;
    }
    setLocationPrompt('password');
  };

  const handleRecoveryLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRecoverySuccess('');
    setLocationPrompt('recovery');
  };

  const handleLocationContinue = async () => {
    if (!locationPrompt) return;
    const requestedAction = locationPrompt;
    setIsLoading(true);

    const captured = await captureLoginContext();
    setLocationPrompt(null);
    if (requestedAction === 'password') {
      await completePasswordLogin(captured.context);
    } else {
      await completeRecoveryLogin();
    }
    setIsLoading(false);
  };

  const handleContinueWithoutLocation = async () => {
    if (!locationPrompt) return;
    const requestedAction = locationPrompt;
    setLocationPrompt(null);
    setIsLoading(true);

    const context: LoginContext = {
      device: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
    if (requestedAction === 'password') {
      await completePasswordLogin(context);
    } else {
      await completeRecoveryLogin();
    }
    setIsLoading(false);
  };

  // Format recovery code input as user types: insert hyphens automatically
  const handleRecoveryCodeChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts = [clean.slice(0, 5), clean.slice(5, 10), clean.slice(10, 15)].filter(Boolean);
    setRecoveryCode(parts.join('-'));
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-12 items-center"
          style={{
            fontFamily: 'Roboto, Lato, system-ui, sans-serif',
            fontWeight: '800',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            borderRadius: '15px',
          }}
        >
          {/* Left — Feature panel */}
          <div className="hidden lg:block bg-black" style={{ marginLeft: '20px' }}>
             {/* Live platform branding — mirrors the sidebar header */}
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
                   {mainDisplayName}
                 </div>
                 {displayNameSubtitle && (
                   <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
                     {displayNameSubtitle}
                   </div>
                 )}
               </div>
             </div>
            <h1 className="text-4xl font-bold text-white mb-6">Real-time spend insights</h1>
            <div className="space-y-6">
              <p className="text-sm font-semibold text-white uppercase tracking-wider">Enterprise Features</p>
              <div className="space-y-4">
                {[
                  'Automated purchase orders',
                  'Multi-location support',
                  'Role-based access control',
                  'Multi-tenant client portal',
                  'Enterprise-grade security',
                ].map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="text-gray-400 mt-1">✓</div>
                    <p className="text-white">{f}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-white mt-12">© {new Date().getFullYear()} {org.companyName}</p>
          </div>

          {/* Right — Login form */}
          <div className="w-full max-w-sm lg:ml-[50px] lg:mr-[-50px]">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10">
              {/* Logo */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`${org.logoUrl ? 'h-10 w-10 rounded-lg border border-gray-200' : 'h-14 w-[180px]'} overflow-hidden bg-white flex items-center justify-start shrink-0`}>
                    <img
                      src={org.logoUrl || DEFAULT_LOGIN_LOGO}
                      alt={org.displayName || 'Nido Tech'}
                      className="h-full w-full object-contain object-left"
                    />
                  </div>
                  {org.logoUrl && (
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold leading-tight text-gray-900">{mainDisplayName}</h2>
                      {displayNameSubtitle && (
                        <p className="mt-0.5 text-xs font-medium text-gray-500">{displayNameSubtitle}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-6 border-b border-gray-200 flex gap-1">
                  <button
                    type="button"
                  onClick={() => switchTab('password')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'password' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Sign In
                </button>
                  {!isOwnerSetupRequired && <button
                    type="button"
                  onClick={() => switchTab('recovery')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'recovery' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <KeyRound size={13} />
                  Recovery Code
                </button>}
              </div>

              {/* ── Password tab ─────────────────────────────────────── */}
              {activeTab === 'password' && (
                <>
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {isOwnerSetupRequired ? 'Set up the System Owner' : 'Welcome back'}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {isOwnerSetupRequired
                        ? 'Create a password for this browser before signing in.'
                        : 'Sign in to your account to continue'}
                    </p>
                  </div>

                  {isOwnerSetupRequired && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs leading-relaxed text-amber-800">
                        Setup is stored in this browser. The first person to open this app in a fresh browser profile can create the owner password.
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">{error}</p>
                      {isLocked && (
                        <button
                          type="button"
                          onClick={handleUnlockSelf}
                          className="mt-2 w-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg py-1.5 transition-colors"
                        >
                          🔓 Unlock My Account
                        </button>
                      )}
                      {isLocked && (
                        <button
                          type="button"
                          onClick={() => switchTab('recovery')}
                          className="mt-2 w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <KeyRound size={13} /> Use a Recovery Code Instead
                        </button>
                      )}
                    </div>
                  )}

                  {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 text-sm">{success}</p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <label htmlFor="login-email" className="block text-sm font-medium text-gray-900 mb-2">Email</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          id="login-email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                          placeholder="your@email.com"
                          autoComplete="email"
                          disabled={isLoading}
                          readOnly={isOwnerSetupRequired}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="login-password" className="block text-sm font-medium text-gray-900 mb-2">
                        {isOwnerSetupRequired ? 'Create password' : 'Password'}
                      </label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="login-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                          placeholder={isOwnerSetupRequired ? 'At least 8 characters' : '••••••••••'}
                          autoComplete={isOwnerSetupRequired ? 'new-password' : 'current-password'}
                          minLength={isOwnerSetupRequired ? 8 : undefined}
                          disabled={isLoading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          disabled={isLoading}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {isOwnerSetupRequired && (
                      <div>
                        <label htmlFor="confirm-owner-password" className="block text-sm font-medium text-gray-900 mb-2">
                          Confirm password
                        </label>
                        <input
                          type="password"
                          id="confirm-owner-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                          autoComplete="new-password"
                          minLength={8}
                          disabled={isLoading}
                          required
                        />
                      </div>
                    )}

                    {!isOwnerSetupRequired && (
                      <div className="-mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => navigate('/forgot-password')}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                    >
                      {isLoading ? (
                        <><Loader2 size={18} className="animate-spin" />Signing in…</>
                      ) : (
                        <>{isOwnerSetupRequired ? 'Create Owner Password' : 'Sign In'} <span>→</span></>
                      )}
                    </button>
                  </form>
                </>
              )}

              {/* ── Recovery Code tab ─────────────────────────────────── */}
              {activeTab === 'recovery' && !isOwnerSetupRequired && (
                <>
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Recovery Code</h3>
                    <p className="text-gray-600 text-sm">
                      Use one of your one-time recovery codes to access your account.
                      Each code can only be used once.
                    </p>
                  </div>

                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                    <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-amber-700 text-xs leading-relaxed">
                      Recovery codes bypass your password and account lock. Keep them stored safely and never share them.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}

                  {recoverySuccess && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 text-sm">{recoverySuccess}</p>
                    </div>
                  )}

                  <form onSubmit={handleRecoveryLogin} className="space-y-5">
                    <div>
                      <label htmlFor="recovery-email" className="block text-sm font-medium text-gray-900 mb-2">Email</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          id="recovery-email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                          placeholder="your@email.com"
                          autoComplete="email"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="recovery-code" className="block text-sm font-medium text-gray-900 mb-2">Recovery Code</label>
                      <div className="relative">
                        <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          id="recovery-code"
                          value={recoveryCode}
                          onChange={(e) => handleRecoveryCodeChange(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900 font-mono tracking-widest uppercase"
                          placeholder="XXXXX-XXXXX-XXXXX"
                          maxLength={17}
                          disabled={isLoading}
                          required
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Format: 5 characters, dash, 5 characters, dash, 5 characters</p>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || recoveryCode.replace(/-/g, '').length < 15}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                      {isLoading ? (
                        <><Loader2 size={18} className="animate-spin" />Verifying…</>
                      ) : (
                        <><KeyRound size={16} /> Sign In with Recovery Code</>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">
                      Remembered your password?{' '}
                      <button onClick={() => switchTab('password')} className="text-blue-600 hover:underline font-medium">
                        Sign in normally
                      </button>
                    </p>
                  </div>
                </>
              )}

              {locationPrompt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="location-permission-title"
                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <MapPin size={24} />
                    </div>
                    <h2 id="location-permission-title" className="mt-4 text-center text-xl font-bold text-gray-900">
                      Location access
                    </h2>
                    <p className="mt-2 text-center text-sm leading-relaxed text-gray-600">
                      NIDO can record your sign-in IP address, device information, and (when available) your device&apos;s latitude and longitude for the audit trail.
                    </p>
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
                      Your coordinates are requested by your browser and stored with the sign-in activity when permission is granted. You can continue without sharing your location.
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setLocationPrompt(null)}
                        disabled={isLoading}
                        className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleContinueWithoutLocation}
                        disabled={isLoading}
                        className="rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
                      >
                        Continue without location
                      </button>
                      <button
                        type="button"
                        onClick={handleLocationContinue}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                        {isLoading ? 'Checking location…' : 'Allow & Continue'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
