import React from 'react';

interface GoogleSignInButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | string;
  isDarkTheme?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export default function GoogleSignInButton({
  onClick,
  disabled = false,
  isLoading = false,
  variant = 'primary',
  isDarkTheme = true,
  size = 'md',
  label = 'Sign in with Google',
  className = '',
}: GoogleSignInButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-2',
    md: 'px-4 py-2 text-xs font-semibold gap-2.5',
    lg: 'px-5 py-2.5 text-sm font-semibold gap-3',
  }[size];

  const themeClasses = isDarkTheme
    ? 'bg-[#1E1E28] hover:bg-[#282838] text-white border-[#38384C] hover:border-white/30'
    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm hover:border-slate-400';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center rounded-xl border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeClasses} ${themeClasses} ${className}`}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="shrink-0 w-4 h-4"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
      )}
      <span className="truncate">{isLoading ? 'Connecting...' : label}</span>
    </button>
  );
}
