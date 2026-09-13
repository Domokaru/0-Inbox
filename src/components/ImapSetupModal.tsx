import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  testImapConnection,
  saveImapCredentials,
  getLastUsedAppPassword,
  saveLastUsedAppPassword,
  getStoredImapCredentials,
} from '../services/imapService';

interface ImapSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string, appPassword: string) => void;
  isDarkTheme?: boolean;
  initialEmail?: string;
  initialError?: string | null;
}

export default function ImapSetupModal({
  isOpen,
  onClose,
  onSuccess,
  isDarkTheme = true,
  initialEmail = '',
  initialError = null,
}: ImapSetupModalProps) {
  const rememberedCreds = getStoredImapCredentials();
  const lastUsedStoredPass = getLastUsedAppPassword();

  const [email, setEmail] = useState(
    initialEmail || rememberedCreds?.email || 'ben.hallauer@gmail.com'
  );
  const [appPassword, setAppPassword] = useState(
    lastUsedStoredPass || rememberedCreds?.appPassword || ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Help section toggle
  const [showHelp, setShowHelp] = useState(false);

  // Masked last-used password state
  const [lastUsedPass, setLastUsedPass] = useState<string | null>(lastUsedStoredPass);

  // Hold-down state
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // PIN security modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize when modal opens
  useEffect(() => {
    if (isOpen) {
      const stored = getLastUsedAppPassword() || getStoredImapCredentials()?.appPassword || '';
      setLastUsedPass(stored || null);
      if (!appPassword && stored) {
        setAppPassword(stored);
      }
      setErrorMessage(initialError);
      setSuccessToast(null);
    }
  }, [isOpen, initialError]);

  useEffect(() => {
    if (showPinModal) {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [showPinModal]);

  if (!isOpen) return null;

  // Handle Hold-down gesture (starts on mouse/touch down, requires ~550ms hold)
  const HOLD_DURATION_MS = 550;

  const startHold = () => {
    if (!lastUsedPass) return;
    setIsHolding(true);
    setHoldProgress(0);

    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);
    }, 25);

    holdTimerRef.current = setTimeout(() => {
      cancelHold();
      // Trigger PIN modal to verify code 9077
      setPinInput('');
      setPinError(null);
      setShowPinModal(true);
    }, HOLD_DURATION_MS);
  };

  const cancelHold = () => {
    setIsHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handleVerifyPinAndCopy = async () => {
    if (pinInput.trim() === '9077') {
      if (lastUsedPass) {
        try {
          await navigator.clipboard.writeText(lastUsedPass);
          setSuccessToast('✓ Unmasked App Password copied to clipboard!');
          setAppPassword(lastUsedPass);
        } catch (_) {
          // Fallback if clipboard API restricted
          setAppPassword(lastUsedPass);
          setSuccessToast('✓ Password unlocked and filled into field!');
        }
        setShowPinModal(false);
        setPinInput('');
        setPinError(null);
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } else {
      setPinError('Incorrect code. Please enter 9077 to unlock.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPass = appPassword.trim().replace(/\s+/g, '');

    if (!cleanEmail) {
      setErrorMessage('Please enter your Gmail address');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Please enter your 16-character Google App Password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await testImapConnection(cleanEmail, cleanPass);
      // Remember credentials if requested
      if (rememberMe) {
        saveImapCredentials(cleanEmail, cleanPass);
      }
      saveLastUsedAppPassword(cleanPass);
      setLastUsedPass(cleanPass);

      onSuccess(cleanEmail, cleanPass);
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Failed to authenticate with Gmail IMAP. Please verify your 16-character Google App Password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-full max-w-lg rounded-3xl p-6 shadow-2xl transition-all border max-h-[92vh] overflow-y-auto ${
          isDarkTheme
            ? 'bg-[#14141E] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-xl transition-colors cursor-pointer ${
            isDarkTheme ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide">Connect Gmail</h2>
              <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                Zero Inbox Direct IMAP Connection
              </p>
            </div>
          </div>
        </div>

        {/* Last Used App Password (Device Stored) */}
        {lastUsedPass && (
          <div
            className={`p-3 rounded-xl border mb-4 ${
              isDarkTheme ? 'bg-[#12131D] border-white/10' : 'bg-white/90 border-cyan-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDarkTheme ? 'text-gray-400' : 'text-slate-600'
                }`}
              >
                Last Used App Password (Device Stored)
              </span>
            </div>

            <div
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              className={`relative overflow-hidden flex items-center justify-between p-2.5 rounded-lg border cursor-pointer select-none transition-all active:scale-[0.99] ${
                isDarkTheme
                  ? 'bg-[#0A0B10] border-white/10 hover:border-cyan-500/40'
                  : 'bg-slate-50 border-slate-300 hover:border-cyan-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tracking-widest text-emerald-400 font-bold">
                  •••• •••• •••• ••••
                </span>
              </div>

              {isHolding && (
                <span className="text-cyan-400 font-bold text-xs animate-pulse">
                  Holding... {Math.round(holdProgress)}%
                </span>
              )}

              {/* Visual Hold Progress Bar */}
              {isHolding && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-cyan-400 transition-all duration-75"
                  style={{ width: `${holdProgress}%` }}
                />
              )}
            </div>
          </div>
        )}

        {/* Success Toast */}
        {successToast && (
          <div className="p-3 rounded-xl mb-4 border text-xs leading-relaxed flex items-center gap-2.5 bg-emerald-950/50 border-emerald-500/40 text-emerald-300 animate-fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <div className="font-semibold">{successToast}</div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div
            className={`p-3 rounded-xl mb-4 border text-xs leading-relaxed flex items-start gap-2.5 ${
              isDarkTheme
                ? 'bg-red-950/40 border-red-500/40 text-red-300'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label
              className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isDarkTheme ? 'text-gray-300' : 'text-slate-700'
              }`}
            >
              Gmail Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className={`w-full px-3.5 py-2.5 pl-10 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all ${
                  isDarkTheme
                    ? 'bg-[#1C1C28] border-white/10 text-white focus:ring-cyan-500/50 focus:border-cyan-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-cyan-500/40 focus:border-cyan-500'
                }`}
              />
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            </div>
          </div>

          {/* App Password Input */}
          <div>
            <label
              className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isDarkTheme ? 'text-gray-300' : 'text-slate-700'
              }`}
            >
              App Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="abcd efgh ijkl mnop"
                className={`w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl text-sm font-mono border focus:outline-none focus:ring-2 transition-all ${
                  isDarkTheme
                    ? 'bg-[#1C1C28] border-white/10 text-white focus:ring-cyan-500/50 focus:border-cyan-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-cyan-500/40 focus:border-cyan-500'
                }`}
              />
              <Key className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-200 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember on this device Checkbox */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="checkbox"
              id="remember_device_checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-400 focus:ring-cyan-500 border-gray-600 cursor-pointer"
            />
            <label
              htmlFor="remember_device_checkbox"
              className={`text-xs select-none cursor-pointer font-medium ${
                isDarkTheme ? 'text-gray-300' : 'text-slate-700'
              }`}
            >
              Remember App Password on this device (auto-login next time)
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                isDarkTheme
                  ? 'border-white/10 hover:bg-white/5 text-gray-300'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Connect Gmail</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* PIN Security Prompt Modal for Code 9077 */}
      {showPinModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDarkTheme
                ? 'bg-[#15151F] border-cyan-500/30 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">Security Verification</h3>
                <p className={`text-[11px] ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                  Enter code to reveal &amp; copy password
                </p>
              </div>
            </div>

            <p className={`text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
              Please enter the 4-digit security code <strong>9077</strong> to copy your unmasked App Password:
            </p>

            <div>
              <input
                ref={pinInputRef}
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyPinAndCopy();
                }}
                placeholder="Enter 9077"
                className={`w-full px-4 py-2.5 text-center text-lg font-mono tracking-widest rounded-xl border focus:outline-none focus:ring-2 ${
                  pinError
                    ? 'border-red-500 text-red-400 focus:ring-red-500/40'
                    : isDarkTheme
                    ? 'bg-[#0E0F16] border-white/10 text-white focus:border-cyan-500 focus:ring-cyan-500/40'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500 focus:ring-cyan-500/30'
                }`}
              />
              {pinError && (
                <p className="text-[11px] text-red-400 mt-1.5 text-center font-medium">
                  {pinError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput('');
                  setPinError(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                  isDarkTheme ? 'border-white/10 hover:bg-white/5 text-gray-300' : 'border-slate-300 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyPinAndCopy}
                className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Verify &amp; Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
