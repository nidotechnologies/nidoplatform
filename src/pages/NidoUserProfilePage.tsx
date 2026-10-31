import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUsers } from '@/lib/nidoUsersStore';
import {
  ensureRecoveryCodes,
  generateRecoveryCodes,
  getRecoveryCodes,
  RecoveryCode,
} from '@/lib/recoveryCodeStore';
import {
  KeyRound,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  CheckCheck,
  ShieldCheck,
  ShieldAlert,
  Download,
  AlertTriangle,
} from 'lucide-react';

export default function NidoUserProfilePage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<RecoveryCode[]>([]);
  const [codesVisible, setCodesVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [justRegenerated, setJustRegenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Pull full user details from the store
  const fullUser = user ? getUsers().find(u => u.id === user.id) : null;

  useEffect(() => {
    if (!user) return;
    const fresh = ensureRecoveryCodes(user.id, user.email);
    setCodes(fresh);
    const record = getRecoveryCodes(user.id);
    setGeneratedAt(record?.generatedAt ?? null);
  }, [user]);

  const unusedCount = codes.filter(c => !c.used).length;

  const handleRegenerate = () => {
    if (!user) return;
    const fresh = generateRecoveryCodes(user.id, user.email);
    setCodes(fresh);
    const record = getRecoveryCodes(user.id);
    setGeneratedAt(record?.generatedAt ?? null);
    setCodesVisible(true);
    setShowRegenConfirm(false);
    setJustRegenerated(true);
    setTimeout(() => setJustRegenerated(false), 5000);
  };

  const handleCopyAll = () => {
    const text = codes
      .filter(c => !c.used)
      .map(c => c.code)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownload = () => {
    const lines = [
      `Recovery Codes — ${user?.name ?? user?.email}`,
      `Generated: ${generatedAt ? new Date(generatedAt).toLocaleString() : '—'}`,
      `Account: ${user?.email}`,
      '',
      'Keep these codes safe. Each code can only be used once.',
      '',
      ...codes.map(c => `${c.used ? '[USED]' : '[UNUSED]'} ${c.code}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nido-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor =
    unusedCount === 0
      ? 'text-red-600 bg-red-50 border-red-200'
      : unusedCount <= 2
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-green-600 bg-green-50 border-green-200';

  const StatusIcon = unusedCount === 0 ? ShieldAlert : unusedCount <= 2 ? AlertTriangle : ShieldCheck;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>

      {/* Account info card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Name', value: fullUser?.name ?? user?.name ?? '—' },
            { label: 'Email', value: fullUser?.email ?? user?.email ?? '—' },
            { label: 'Role', value: fullUser?.role ?? user?.role ?? '—' },
            { label: 'Department', value: fullUser?.department ?? '—' },
            { label: 'Employee ID', value: fullUser?.employeeId ?? '—' },
            { label: 'Last Login', value: fullUser?.lastLogin ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
              <p className="text-gray-900 dark:text-white font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recovery codes card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <KeyRound size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recovery Codes</h2>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusColor}`}>
            <StatusIcon size={13} />
            {unusedCount} of {codes.length} remaining
          </span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Recovery codes let you sign in if you forget your password or your account gets locked.
          Each code can only be used <strong>once</strong> — store them somewhere safe (password manager, printed copy).
        </p>

        {justRegenerated && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700 text-sm font-medium">✓ New recovery codes generated. Your old codes are now invalid.</p>
          </div>
        )}

        {unusedCount === 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">All your recovery codes have been used. Generate new ones now.</p>
          </div>
        )}

        {unusedCount <= 2 && unusedCount > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-700 text-sm">Only {unusedCount} recovery code{unusedCount > 1 ? 's' : ''} left. Consider generating a fresh set.</p>
          </div>
        )}

        {/* Code grid */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="grid grid-cols-2 gap-2">
            {codes.map((c, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-mono ${
                  c.used
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'
                }`}
              >
                <span>{codesVisible ? c.code : '•••••-•••••-•••••'}</span>
                {c.used && <span className="text-xs text-gray-400 ml-2 no-underline font-sans" style={{ textDecoration: 'none' }}>used</span>}
              </div>
            ))}
          </div>

          {generatedAt && (
            <p className="text-xs text-gray-400 mt-3 text-right">
              Generated {new Date(generatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCodesVisible(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {codesVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            {codesVisible ? 'Hide' : 'Reveal'} Codes
          </button>

          {codesVisible && unusedCount > 0 && (
            <>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {copied ? <CheckCheck size={15} className="text-green-600" /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Unused'}
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Download size={15} />
                Download
              </button>
            </>
          )}

          {!showRegenConfirm ? (
            <button
              onClick={() => setShowRegenConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors ml-auto"
            >
              <RefreshCw size={15} />
              Generate New Codes
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">Old codes become invalid. Continue?</p>
              <button
                onClick={handleRegenerate}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
              >
                Yes, regenerate
              </button>
              <button
                onClick={() => setShowRegenConfirm(false)}
                className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400">
            💡 Tip: Recovery codes also unlock a locked account — useful after too many failed sign-in attempts.
          </p>
        </div>
      </div>
    </div>
  );
}
