import React, { useState } from 'react';
import { Mail, Key, Eye, EyeOff, ExternalLink, AlertCircle, Loader2, X, Sparkles } from 'lucide-react';
import { testImapConnection, saveImapCredentials } from '../services/imapService';

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
  const [email, setEmail] = useState(initialEmail || 'ben.hallauer@gmail.com');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);

  if (!isOpen) return null;

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
      saveImapCredentials(cleanEmail, cleanPass);
      onSuccess(cleanEmail, cleanPass);
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Failed to authenticate with Gmail IMAP. Please check your App Password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-full max-w-lg rounded-2xl p-6 shadow-2xl transition-all border ${
          isDarkTheme
            ? 'bg-[#14141E] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-xl transition-colors ${
            isDarkTheme ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-wide">Connect Gmail</h2>
          </div>
        </div>

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
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                App Password
              </label>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 hover:underline"
              >
                <span>Get App Password</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
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
                className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
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
              className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
    </div>
  );
}
