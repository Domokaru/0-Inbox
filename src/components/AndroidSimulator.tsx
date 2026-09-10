import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Archive,
  Trash2,
  PenLine,
  MailOpen,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  X,
  Sun,
  Moon,
  FolderInput,
  ChevronDown,
  RefreshCw,
  Check,
  Search,
} from 'lucide-react';
import PixelTitle from './PixelTitle';

const BIG_PIXEL_ZERO_PATH = `
  M1 0 h3 v1 h-3 Z 
  M0 1 h1 v1 h-1 Z M4 1 h1 v1 h-1 Z 
  M0 2 h1 v1 h-1 Z M3 2 h2 v1 h-2 Z 
  M0 3 h1 v1 h-1 Z M2 3 h1 v1 h-1 Z M4 3 h1 v1 h-1 Z 
  M0 4 h2 v1 h-2 Z M4 4 h1 v1 h-1 Z 
  M0 5 h1 v1 h-1 Z M4 5 h1 v1 h-1 Z 
  M1 6 h3 v1 h-3 Z
`;

export interface MockEmail {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  category: string;
}

export interface AccountLabel {
  id: string;
  name: string;
  color: string;
  count?: number;
}

const INITIAL_EMAILS: MockEmail[] = [
  {
    id: 'msg-1',
    sender: 'GitHub Notifications',
    subject: '[Google/Jetpack] Pull request #142 ready for review',
    snippet: 'Hey Ben, your latest pull request containing the Credential Manager refactor passed all CI integration tests. Ready for merge.',
    category: 'Updates',
  },
  {
    id: 'msg-2',
    sender: 'Google Cloud Platform',
    subject: 'Security Alert: New OAuth Client ID provisioned',
    snippet: 'A new OAuth 2.0 Web Client ID was created for your project "0 INBOX Client" with the scope gmail.modify.',
    category: 'Primary',
  },
  {
    id: 'msg-3',
    sender: 'TechCrunch Disrupt',
    subject: 'Early Bird passes: The future of AI & Mobile dev',
    snippet: 'Save 40% on all stage passes before midnight tonight. Join top Android engineers discussing Jetpack Compose 1.8.',
    category: 'Promotions',
  },
  {
    id: 'msg-4',
    sender: 'Sarah Lin (Product Lead)',
    subject: 'Urgent: Sprint review demo this afternoon at 3 PM',
    snippet: 'Can we sync for 10 minutes on the card gesture thresholds before we present to the executive team today?',
    category: 'Primary',
  },
  {
    id: 'msg-5',
    sender: 'Figma Community',
    subject: 'New Neon & Pastel Theme Kit published for Compose',
    snippet: 'Check out the latest neon color ramp, pastel light tokens, and interactive widget components built specifically for Android UI.',
    category: 'Social',
  },
];

const DEFAULT_ACCOUNT_LABELS: AccountLabel[] = [
  { id: 'lbl-work', name: 'Work / Projects', color: '#00FFFF', count: 18 },
  { id: 'lbl-personal', name: 'Personal', color: '#FF00FF', count: 9 },
  { id: 'lbl-finance', name: 'Finance & Invoices', color: '#10B981', count: 14 },
  { id: 'lbl-receipts', name: 'Receipts & Orders', color: '#F59E0B', count: 26 },
  { id: 'lbl-followup', name: 'Follow Up / Action', color: '#EC4899', count: 7 },
  { id: 'lbl-clients', name: 'Client Inquiries', color: '#8B5CF6', count: 12 },
  { id: 'lbl-travel', name: 'Travel & Trips', color: '#06B6D4', count: 5 },
  { id: 'lbl-newsletters', name: 'Newsletters & Reads', color: '#3B82F6', count: 31 },
];

type SwipeDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

interface LastAction {
  email: MockEmail;
  direction?: SwipeDirection;
  customLabel?: string;
  label: string;
}

interface AndroidSimulatorProps {
  isDarkTheme?: boolean;
  onToggleTheme?: (isDark: boolean) => void;
}

export default function AndroidSimulator({
  isDarkTheme: externalDarkTheme,
  onToggleTheme,
}: AndroidSimulatorProps = {}) {
  const [internalDarkTheme, setInternalDarkTheme] = useState(true);
  const isDarkTheme = externalDarkTheme !== undefined ? externalDarkTheme : internalDarkTheme;

  const setIsDarkTheme = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(isDarkTheme) : val;
    setInternalDarkTheme(nextVal);
    onToggleTheme?.(nextVal);
  };

  const [showSettings, setShowSettings] = useState(false);
  const [emails, setEmails] = useState<MockEmail[]>(INITIAL_EMAILS);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [activePopup, setActivePopup] = useState<{
    icon: 'archive' | 'trash' | 'pen' | 'mail' | 'label';
    color: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [batchCount, setBatchCount] = useState(1);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // Available Gmail Account Labels state
  const [accountLabels, setAccountLabels] = useState<AccountLabel[]>(DEFAULT_ACCOUNT_LABELS);
  const [isRefreshingLabels, setIsRefreshingLabels] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('Just now');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [emailToLabel, setEmailToLabel] = useState<MockEmail | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string>(DEFAULT_ACCOUNT_LABELS[0].id);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');

  // Double tap detection ref for header
  const lastTapRef = useRef<number>(0);

  // Confetti celebration explosion in matching neon colors
  const triggerNeonConfetti = useCallback(() => {
    const neonColors = isDarkTheme
      ? ['#00FFFF', '#FF00FF', '#007BFF', '#39FF14', '#FFE600', '#FF3366']
      : ['#0EA5E9', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

    // Center primary explosion
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.5, x: 0.5 },
      colors: neonColors,
      startVelocity: 45,
      ticks: 260,
      scalar: 1.2,
    });

    // Left and Right celebratory cannon bursts
    setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 70,
        origin: { x: 0.15, y: 0.6 },
        colors: neonColors,
        scalar: 1.1,
      });
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 70,
        origin: { x: 0.85, y: 0.6 },
        colors: neonColors,
        scalar: 1.1,
      });
    }, 180);

    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 130,
        origin: { y: 0.42, x: 0.5 },
        colors: neonColors,
        startVelocity: 35,
        scalar: 1.2,
      });
    }, 420);
  }, [isDarkTheme]);

  // Track unread count and explode confetti when number hits 0
  const prevCountRef = useRef(emails.length);
  useEffect(() => {
    if (prevCountRef.current > 0 && emails.length === 0) {
      triggerNeonConfetti();
    }
    prevCountRef.current = emails.length;
  }, [emails.length, triggerNeonConfetti]);

  // Refresh labels anytime the app is opened (per user requirement)
  const handleRefreshLabels = () => {
    setIsRefreshingLabels(true);
    setTimeout(() => {
      setIsRefreshingLabels(false);
      const now = new Date();
      setLastRefreshedTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
    }, 600);
  };

  useEffect(() => {
    handleRefreshLabels();
  }, []);

  const handleHeaderTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 350;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      setShowSettings(true);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleSwipe = (email: MockEmail, direction: SwipeDirection) => {
    // 1. Show Screen-centered popup: ONLY the icon, NO words or text
    const popupColor = isDarkTheme
      ? {
          RIGHT: '#00FFFF', // Neon Cyan
          LEFT: '#FF3366',  // Neon Red/Pink
          UP: '#FF00FF',    // Neon Magenta
          DOWN: '#007BFF',  // Electric Blue
        }[direction]
      : {
          RIGHT: '#0EA5E9', // Pastel Sky Cyan
          LEFT: '#F87171',  // Pastel Red/Coral
          UP: '#EC4899',    // Pastel Rose
          DOWN: '#3B82F6',  // Pastel Royal Blue
        }[direction];

    const iconType = {
      RIGHT: 'archive',
      LEFT: 'trash',
      UP: 'pen',
      DOWN: 'mail',
    }[direction] as 'archive' | 'trash' | 'pen' | 'mail';

    setActivePopup({ icon: iconType, color: popupColor });
    setTimeout(() => {
      setActivePopup(null);
    }, 700);

    // 2. Remove email locally
    setEmails((prev) => prev.filter((item) => item.id !== email.id));

    // 3. Set Last Action for Undo
    const actionDesc = {
      RIGHT: 'Archived email',
      LEFT: 'Deleted email',
      UP: 'Marked "Needs Update"',
      DOWN: 'Marked as read',
    }[direction];

    setLastAction({
      email,
      direction,
      label: `${actionDesc} from ${email.sender.split(' ')[0]}`,
    });
    setSnackbarVisible(true);
  };

  // Open the Label selection popup window (triggered by bottom button OR card long-press)
  const handleOpenLabelModal = (email?: MockEmail) => {
    const target = email || (emails.length > 0 ? emails[emails.length - 1] : null);
    if (!target) return;
    setEmailToLabel(target);
    setSelectedLabelId(accountLabels[0]?.id || '');
    setIsDropdownOpen(false);
    setLabelSearchQuery('');
    setShowLabelModal(true);
    // Refresh labels anytime app opens or modal is invoked
    handleRefreshLabels();
  };

  // Apply selected label to email, mark as read, and move from inbox
  const handleApplyLabel = (labelIdToApply?: string) => {
    const targetId = labelIdToApply || selectedLabelId;
    if (!emailToLabel || !targetId) return;

    const chosenLabel = accountLabels.find((l) => l.id === targetId);
    const labelName = chosenLabel ? chosenLabel.name : 'Selected Label';

    // 1. Show Screen-Centered Popup: ONLY the icon, zero words
    const popupColor = chosenLabel?.color || (isDarkTheme ? '#00FFFF' : '#0284C7');
    setActivePopup({ icon: 'label', color: popupColor });
    setTimeout(() => {
      setActivePopup(null);
    }, 700);

    // 2. Remove email locally (triaged to destination label)
    setEmails((prev) => prev.filter((item) => item.id !== emailToLabel.id));

    // 3. Set Last Action for Undo
    setLastAction({
      email: emailToLabel,
      customLabel: labelName,
      label: `Moved to "${labelName}" & marked read`,
    });
    setSnackbarVisible(true);

    // 4. Close modal
    setShowLabelModal(false);
    setEmailToLabel(null);
    setIsDropdownOpen(false);
  };

  const handleUndo = () => {
    if (!lastAction) return;

    // Restore to top of stack
    setEmails((prev) => [...prev, lastAction.email]);
    setSnackbarVisible(false);
    setLastAction(null);
  };

  const handleFetchNextBatch = () => {
    const nextBatch: MockEmail[] = [
      {
        id: `batch-${batchCount}-1`,
        sender: 'Android Weekly #620',
        subject: 'Mastering PointerInput & DragGestures in Jetpack Compose',
        snippet: 'A deep dive into high-performance physics-based swiping and card stacking in Kotlin.',
        category: 'Updates',
      },
      {
        id: `batch-${batchCount}-2`,
        sender: 'Google Developer Relations',
        subject: 'Credential Manager Migration Guide for Android 14',
        snippet: 'How to replace GoogleSignInClient with androidx.credentials and GoogleIdTokenCredential seamlessly.',
        category: 'Primary',
      },
      {
        id: `batch-${batchCount}-3`,
        sender: 'Stripe Billing',
        subject: 'Your monthly invoice for Cloud Run API proxy',
        snippet: 'Your statement for the current billing cycle is ready. Total charges: $0.00 (Free tier applied).',
        category: 'Updates',
      },
    ];

    setEmails((prev) => [...nextBatch, ...prev]);
    setBatchCount((c) => c + 1);
    if (batchCount >= 2) {
      setHasMore(false);
    }
  };

  const resetDemo = () => {
    setEmails(INITIAL_EMAILS);
    setLastAction(null);
    setSnackbarVisible(false);
    setHasMore(true);
    setBatchCount(1);
    handleRefreshLabels();
  };

  // Color tokens depending on theme
  const canvasBg = isDarkTheme ? 'bg-[#0F0F13]' : 'bg-[#FFFFFF]';
  const deviceBorder = isDarkTheme ? 'border-[#22222E]' : 'border-slate-300 shadow-2xl';
  const statusBarText = isDarkTheme ? 'text-gray-400' : 'text-slate-600';
  const signalColor = isDarkTheme ? 'bg-[#00FFFF]' : 'bg-[#0284C7]';
  const cardBorderColor = isDarkTheme ? 'border-[#FF00FF]' : 'border-[#F472B6]';
  const infoBorderColor = isDarkTheme ? 'border-[#007BFF]' : 'border-[#60A5FA]';
  const primaryAccent = isDarkTheme ? '#00FFFF' : '#0284C7';
  const secondaryAccent = isDarkTheme ? '#FF00FF' : '#DB2777';
  const tertiaryAccent = isDarkTheme ? '#007BFF' : '#2563EB';

  const selectedLabel = accountLabels.find((l) => l.id === selectedLabelId);

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-10 p-6 min-h-[calc(100vh-4rem)]">
      {/* Phone Hardware Shell with outer quick controls */}
      <div className="flex flex-col items-center">
        {/* Quick Simulator Header Controls */}
        <div className="w-[380px] flex items-center justify-between px-2 mb-3">
          <button
            onClick={() => setIsDarkTheme(!isDarkTheme)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
              isDarkTheme
                ? 'bg-[#15151A] border-[#2E2E3C] text-gray-200 hover:border-[#00FFFF]'
                : 'bg-white border-slate-300 text-slate-800 hover:border-sky-500'
            }`}
            title="Toggle between Neon Dark and Pastel Light"
          >
            {isDarkTheme ? (
              <>
                <Sun size={14} className="text-amber-400" />
                <span>Pastel Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={14} className="text-indigo-600" />
                <span>Neon Dark Mode</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
              isDarkTheme
                ? 'bg-[#15151A] border-[#2E2E3C] text-gray-300 hover:text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900'
            }`}
          >
            Settings
          </button>
        </div>

        <div className={`relative w-[380px] h-[740px] ${canvasBg} rounded-[48px] border-4 ${deviceBorder} shadow-[0_0_50px_rgba(0,123,255,0.15)] flex flex-col overflow-hidden select-none transition-colors duration-300`}>
          
          {/* Device Camera Notch */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 ${isDarkTheme ? 'bg-[#22222E]' : 'bg-[#E2E8F0]'} rounded-b-2xl z-50 flex items-center justify-center gap-3 transition-colors`}>
            <div className={`w-10 h-1.5 ${isDarkTheme ? 'bg-[#111118]' : 'bg-[#94A3B8]'} rounded-full`} />
            <div className={`w-2.5 h-2.5 ${isDarkTheme ? 'bg-[#0a0a0f]' : 'bg-[#64748B]'} rounded-full`} />
          </div>

          {/* Android Status Bar */}
          <div className={`h-10 px-8 pt-2 flex items-center justify-between text-xs ${statusBarText} font-mono z-40 ${canvasBg}`}>
            <span>9:41</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold" style={{ color: primaryAccent }}>5G</span>
              <div className="w-4 h-2.5 border border-current rounded-sm p-[1px]">
                <div className={`w-full h-full ${signalColor} rounded-[1px]`} />
              </div>
            </div>
          </div>

          {/* Top App Header: Pixelated "0 INBOX" with Slashed Zero & Equal Sizing (Double-Tap opens Settings) */}
          <div 
            onClick={handleHeaderTap}
            onDoubleClick={() => setShowSettings(true)}
            className="px-6 pt-3 pb-2 flex flex-col items-center justify-center z-30 cursor-pointer select-none transition-transform active:scale-98 bg-transparent"
            title="Double-tap header to open Settings"
          >
            <PixelTitle
              zeroColor={primaryAccent}
              inboxColor={secondaryAccent}
              width={180}
              height={60}
            />
          </div>

          {/* Main Stack View Area */}
          <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
            {emails.length === 0 && (
              <motion.div 
                initial={{ scale: 0.6, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                className="flex flex-col items-center justify-center text-center p-4 z-20 select-none max-w-[320px]"
              >
                {/* Big Pixelated 0 in Center of Screen */}
                <div 
                  className="cursor-pointer transition-transform hover:scale-105 active:scale-95 my-1"
                  onClick={triggerNeonConfetti}
                  title="Click to explode neon confetti!"
                >
                  <svg
                    viewBox="0 0 5 7"
                    className="w-32 h-44 sm:w-36 sm:h-52 drop-shadow-2xl"
                    style={{
                      shapeRendering: 'crispEdges',
                      filter: isDarkTheme
                        ? `drop-shadow(0 0 25px ${primaryAccent}) drop-shadow(0 0 10px ${secondaryAccent})`
                        : `drop-shadow(0 0 18px rgba(14,165,233,0.4))`,
                    }}
                  >
                    <path fill={primaryAccent} d={BIG_PIXEL_ZERO_PATH} />
                  </svg>
                </div>

                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mt-3 space-y-1"
                >
                  <h3 
                    className="text-base font-black tracking-[0.25em] font-mono uppercase" 
                    style={{ color: secondaryAccent }}
                  >
                    0 INBOX
                  </h3>
                  <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                    All emails have been processed!
                  </p>
                </motion.div>

                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="mt-5 flex items-center gap-2"
                >
                  <button
                    onClick={triggerNeonConfetti}
                    className="px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                    style={{
                      backgroundColor: `${primaryAccent}18`,
                      borderColor: `${primaryAccent}45`,
                      color: primaryAccent,
                    }}
                  >
                    <span>🎉</span>
                    <span>Confetti</span>
                  </button>

                  {hasMore ? (
                    <button
                      onClick={handleFetchNextBatch}
                      className="px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-md transition-transform active:scale-95 flex items-center gap-1"
                      style={{ backgroundColor: tertiaryAccent }}
                    >
                      <span>Fetch Next 20</span>
                      <ChevronRight size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={resetDemo}
                      className="px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-md transition-transform active:scale-95"
                      style={{ backgroundColor: tertiaryAccent }}
                    >
                      Reload Demo
                    </button>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* Informational Pagination Card (rendered at bottom of stack) */}
            {hasMore && (
              <motion.div
                className={`absolute w-[90%] aspect-[0.68] rounded-[24px] ${isDarkTheme ? 'bg-[#1A1A24]' : 'bg-[#F8FAFC]'} border-2 ${infoBorderColor} p-6 flex flex-col items-center justify-center text-center shadow-lg cursor-pointer`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleFetchNextBatch}
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ 
                    backgroundColor: `${tertiaryAccent}20`,
                    color: tertiaryAccent
                  }}
                >
                  <Sparkles size={24} />
                </div>
                <h4 className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                  More Emails Available
                </h4>
                <p className={`text-xs mt-1 mb-4 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                  Swipe or tap to fetch next 20 via Gmail API
                </p>
                <span 
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md flex items-center gap-1"
                  style={{ backgroundColor: tertiaryAccent }}
                >
                  Fetch Next 20 <ChevronRight size={14} />
                </span>
              </motion.div>
            )}

            {/* Email Cards Stack */}
            {emails.map((email, index) => {
              const isTop = index === emails.length - 1;
              return (
                <SwipeableCard
                  key={email.id}
                  email={email}
                  isTop={isTop}
                  isDarkTheme={isDarkTheme}
                  primaryAccent={primaryAccent}
                  cardBorderColor={cardBorderColor}
                  onSwipe={(dir) => handleSwipe(email, dir)}
                  onLongPress={() => handleOpenLabelModal(email)}
                />
              );
            })}

            {/* Screen-Centered Popup: ONLY THE ICON (No words or labels) */}
            <AnimatePresence>
              {activePopup && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute z-50 w-28 h-28 rounded-full ${isDarkTheme ? 'bg-black/85' : 'bg-white/90'} backdrop-blur-md flex items-center justify-center border-4 shadow-2xl pointer-events-none`}
                  style={{ borderColor: activePopup.color }}
                >
                  {activePopup.icon === 'archive' && <Archive size={48} color={activePopup.color} strokeWidth={2.5} />}
                  {activePopup.icon === 'trash' && <Trash2 size={48} color={activePopup.color} strokeWidth={2.5} />}
                  {activePopup.icon === 'pen' && <PenLine size={48} color={activePopup.color} strokeWidth={2.5} />}
                  {activePopup.icon === 'mail' && <MailOpen size={48} color={activePopup.color} strokeWidth={2.5} />}
                  {activePopup.icon === 'label' && <FolderInput size={48} color={activePopup.color} strokeWidth={2.5} />}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Material 3 Snackbar with UNDO Button */}
            <AnimatePresence>
              {snackbarVisible && lastAction && (
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className={`absolute bottom-4 left-3 right-3 z-50 ${isDarkTheme ? 'bg-[#1B1B26] border-[#007BFF]' : 'bg-[#F1F5F9] border-[#60A5FA]'} border rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <CheckCircle2 size={16} style={{ color: primaryAccent }} className="shrink-0" />
                    <span className={`text-xs truncate ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                      {lastAction.label}
                    </span>
                  </div>
                  <button
                    onClick={handleUndo}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1 shadow-sm"
                    style={{
                      backgroundColor: `${primaryAccent}20`,
                      color: primaryAccent,
                      border: `1px solid ${primaryAccent}40`
                    }}
                  >
                    <RotateCcw size={12} />
                    Undo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Label Selection Popup Modal (Dropdown list of account labels) */}
            <AnimatePresence>
              {showLabelModal && emailToLabel && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center p-3"
                  onClick={() => setShowLabelModal(false)}
                >
                  <motion.div
                    initial={{ y: 220, scale: 0.96 }}
                    animate={{ y: 0, scale: 1 }}
                    exit={{ y: 220, scale: 0.96 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full max-h-[92%] flex flex-col ${
                      isDarkTheme
                        ? 'bg-[#161622] text-white border-[#2A2A3E]'
                        : 'bg-white text-slate-900 border-slate-200'
                    } border rounded-3xl p-5 shadow-2xl overflow-hidden`}
                  >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${isDarkTheme ? 'bg-[#00FFFF]/15 text-[#00FFFF]' : 'bg-sky-100 text-sky-700'}`}>
                          <FolderInput size={18} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm leading-tight">Assign Label</h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                            <span>Gmail Account Labels</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleRefreshLabels}
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                            isDarkTheme
                              ? 'bg-[#1E1E2C] border-[#313146] text-gray-300 hover:text-white'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          }`}
                          title="Refresh labels from Gmail account anytime app opens"
                        >
                          <RefreshCw size={12} className={isRefreshingLabels ? 'animate-spin text-[#00FFFF]' : ''} />
                          <span className="text-[10px]">{isRefreshingLabels ? 'Syncing...' : lastRefreshedTime}</span>
                        </button>
                        <button
                          onClick={() => setShowLabelModal(false)}
                          className="p-1.5 rounded-lg hover:bg-gray-500/20 text-gray-400 hover:text-gray-200"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Email Target Card */}
                    <div className={`my-3 p-3 rounded-2xl border ${isDarkTheme ? 'bg-[#1E1E2C] border-[#2E2E42]' : 'bg-slate-50 border-slate-200'} text-xs`}>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 mb-0.5">
                        <span className="truncate" style={{ color: primaryAccent }}>{emailToLabel.sender}</span>
                        <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          Long Press Action
                        </span>
                      </div>
                      <p className={`font-bold truncate text-xs ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                        {emailToLabel.subject}
                      </p>
                    </div>

                    {/* Available Labels Dropdown */}
                    <div className="space-y-1.5 mb-3 relative">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                        Account Labels Dropdown
                      </label>
                      
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          isDarkTheme
                            ? 'bg-[#1C1C28] border-[#383850] text-white hover:border-[#00FFFF]'
                            : 'bg-white border-slate-300 text-slate-800 hover:border-sky-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: selectedLabel?.color || primaryAccent }}
                          />
                          <span className="truncate">{selectedLabel?.name || 'Choose an account label...'}</span>
                        </div>
                        <ChevronDown size={15} className={`transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu Popup List */}
                      {isDropdownOpen && (
                        <div className={`absolute top-full left-0 right-0 mt-1.5 max-h-48 overflow-y-auto rounded-xl border shadow-2xl z-50 p-1.5 ${
                          isDarkTheme ? 'bg-[#181826] border-[#383850]' : 'bg-white border-slate-200'
                        }`}>
                          <div className="p-1 mb-1 border-b border-gray-500/20 flex items-center gap-1.5">
                            <Search size={12} className="text-gray-400 shrink-0" />
                            <input
                              type="text"
                              value={labelSearchQuery}
                              onChange={(e) => setLabelSearchQuery(e.target.value)}
                              placeholder="Filter labels..."
                              className={`w-full text-xs bg-transparent outline-none ${
                                isDarkTheme ? 'text-white placeholder-gray-500' : 'text-slate-900 placeholder-slate-400'
                              }`}
                            />
                            {labelSearchQuery && (
                              <button onClick={() => setLabelSearchQuery('')} className="text-gray-400 hover:text-white text-[10px]">✕</button>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            {accountLabels
                              .filter((l) => l.name.toLowerCase().includes(labelSearchQuery.toLowerCase()))
                              .map((label) => {
                                const isSelected = label.id === selectedLabelId;
                                return (
                                  <button
                                    key={label.id}
                                    onClick={() => {
                                      setSelectedLabelId(label.id);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                                      isSelected
                                        ? (isDarkTheme ? 'bg-[#007BFF]/25 text-[#00FFFF] font-bold' : 'bg-sky-50 text-sky-700 font-bold')
                                        : (isDarkTheme ? 'hover:bg-[#252538] text-gray-200' : 'hover:bg-slate-100 text-slate-700')
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                                      <span className="truncate">{label.name}</span>
                                    </div>
                                    {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Explanation (Apply label, mark read, move from inbox) */}
                    <div className={`p-3 rounded-2xl border ${isDarkTheme ? 'bg-[#111118] border-[#22222E]' : 'bg-slate-50 border-slate-200'} text-[11px] space-y-1.5 mb-4`}>
                      <div className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Automated Triage Action:</div>
                      <div className="flex items-center gap-2 text-emerald-500 font-medium">
                        <Check size={13} className="shrink-0" />
                        <span>Apply label <strong>{selectedLabel?.name}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-500 font-medium">
                        <Check size={13} className="shrink-0" />
                        <span>Mark email as <strong>Read</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-500 font-medium">
                        <Check size={13} className="shrink-0" />
                        <span>Move from <strong>Inbox</strong> (Archived to Label)</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        onClick={() => setShowLabelModal(false)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                          isDarkTheme ? 'border-[#383850] text-gray-300 hover:bg-[#1E1E2C]' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleApplyLabel()}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                        style={{ backgroundColor: primaryAccent }}
                      >
                        <FolderInput size={14} />
                        <span>Apply & Move</span>
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Settings Menu Modal */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-3"
                >
                  <motion.div
                    initial={{ y: 200 }}
                    animate={{ y: 0 }}
                    exit={{ y: 200 }}
                    className={`w-full ${isDarkTheme ? 'bg-[#181822] text-white border-[#2A2A3A]' : 'bg-white text-slate-900 border-slate-200'} border rounded-3xl p-5 shadow-2xl`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-gray-500/20 mb-4">
                      <h3 className="font-bold text-base">App Settings</h3>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="p-1 rounded-full hover:bg-gray-500/20"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 block mb-2 uppercase tracking-wider">
                          Theme Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setIsDarkTheme(true)}
                            className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                              isDarkTheme
                                ? 'bg-[#0F0F13] border-[#00FFFF] shadow-[0_0_15px_rgba(0,255,255,0.2)] text-white'
                                : 'bg-gray-800/40 border-transparent text-gray-400 hover:text-white'
                            }`}
                          >
                            <Moon size={20} className={isDarkTheme ? 'text-[#00FFFF]' : ''} />
                            <span className="text-xs font-bold">Neon Dark</span>
                            <span className="text-[10px] opacity-70">Cyan & Magenta</span>
                          </button>

                          <button
                            onClick={() => setIsDarkTheme(false)}
                            className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                              !isDarkTheme
                                ? 'bg-white border-[#0EA5E9] shadow-[0_0_15px_rgba(14,165,233,0.25)] text-slate-900'
                                : 'bg-gray-800/40 border-transparent text-gray-400 hover:text-white'
                            }`}
                          >
                            <Sun size={20} className={!isDarkTheme ? 'text-[#0EA5E9]' : ''} />
                            <span className="text-xs font-bold">Pastel Light</span>
                            <span className="text-[10px] opacity-70">White & Pastels</span>
                          </button>
                        </div>
                      </div>

                      <div className={`p-3 rounded-xl ${isDarkTheme ? 'bg-[#111118]' : 'bg-slate-50'} text-xs text-gray-400 leading-relaxed border border-gray-500/10`}>
                        {isDarkTheme ? (
                          <p>🌙 <strong>Neon Dark Theme</strong> active: Dark canvas with high-voltage Cyan & Magenta accents.</p>
                        ) : (
                          <p>☀️ <strong>Pastel Light Theme</strong> active: Pure white canvas with soft sky cyan, rose pastel, and royal blue.</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setShowSettings(false)}
                      className="w-full mt-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-transform active:scale-98"
                      style={{ backgroundColor: tertiaryAccent }}
                    >
                      Done
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Small text indicating unread count: Under cards, above bottom icons */}
          <div className={`py-2 px-4 text-center select-none flex items-center justify-center gap-1.5 z-30 transition-colors ${
            isDarkTheme ? 'bg-[#0E0E14] text-gray-400 border-[#1E1E28]' : 'bg-slate-50 text-slate-500 border-slate-200'
          } border-t`}>
            <span className="text-[11px] font-medium tracking-wide">
              <strong
                className="font-bold font-mono text-xs"
                style={{ color: emails.length === 0 ? primaryAccent : (isDarkTheme ? '#FFFFFF' : '#0F172A') }}
              >
                {emails.length}
              </strong>{' '}
              {emails.length === 1 ? 'email unread in inbox' : 'emails unread in inbox'}
            </span>
          </div>

          {/* Quick Trigger Buttons on Bottom (Now includes the dedicated button for Assigning Custom Label) */}
          <div className={`px-4 py-3 ${isDarkTheme ? 'bg-[#121218] border-[#1E1E28]' : 'bg-[#F8FAFC] border-slate-200'} border-t flex items-center justify-between z-30 transition-colors`}>
            {/* 1. Delete (Swipe Left) */}
            <button
              title="Delete (Swipe Left)"
              disabled={emails.length === 0}
              onClick={() => emails.length > 0 && handleSwipe(emails[emails.length - 1], 'LEFT')}
              className={`w-10 h-10 rounded-full ${isDarkTheme ? 'bg-[#FF3366]/10 border-[#FF3366]/40 text-[#FF3366]' : 'bg-red-50 border-red-200 text-red-500'} border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40`}
            >
              <Trash2 size={18} />
            </button>

            {/* 2. Needs Update (Swipe Up) */}
            <button
              title="Needs Update (Swipe Up)"
              disabled={emails.length === 0}
              onClick={() => emails.length > 0 && handleSwipe(emails[emails.length - 1], 'UP')}
              className={`w-10 h-10 rounded-full ${isDarkTheme ? 'bg-[#FF00FF]/10 border-[#FF00FF]/40 text-[#FF00FF]' : 'bg-pink-50 border-pink-200 text-pink-600'} border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40`}
            >
              <PenLine size={18} />
            </button>

            {/* 3. Assign Custom Label (NO SWIPE ACTIVITY - Long Press on Card OR tap this button) */}
            <button
              title="Assign Label (or Long Press Card - No Swipe)"
              disabled={emails.length === 0}
              onClick={() => handleOpenLabelModal()}
              className={`w-11 h-11 rounded-full ${
                isDarkTheme
                  ? 'bg-[#00FFFF]/15 border-[#00FFFF]/60 text-[#00FFFF] hover:bg-[#00FFFF]/25 shadow-[0_0_15px_rgba(0,255,255,0.25)]'
                  : 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100 shadow-sm'
              } border-2 flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40`}
            >
              <FolderInput size={20} />
            </button>

            {/* 4. Mark Read (Swipe Down) */}
            <button
              title="Mark Read (Swipe Down)"
              disabled={emails.length === 0}
              onClick={() => emails.length > 0 && handleSwipe(emails[emails.length - 1], 'DOWN')}
              className={`w-10 h-10 rounded-full ${isDarkTheme ? 'bg-[#007BFF]/10 border-[#007BFF]/40 text-[#007BFF]' : 'bg-blue-50 border-blue-200 text-blue-600'} border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40`}
            >
              <MailOpen size={18} />
            </button>

            {/* 5. Archive (Swipe Right) */}
            <button
              title="Archive (Swipe Right)"
              disabled={emails.length === 0}
              onClick={() => emails.length > 0 && handleSwipe(emails[emails.length - 1], 'RIGHT')}
              className={`w-10 h-10 rounded-full ${isDarkTheme ? 'bg-[#00FFFF]/10 border-[#00FFFF]/40 text-[#00FFFF]' : 'bg-sky-50 border-sky-200 text-sky-600'} border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40`}
            >
              <Archive size={18} />
            </button>
          </div>

          {/* Android Gesture Bar */}
          <div className={`h-4 flex items-center justify-center ${isDarkTheme ? 'bg-[#121218]' : 'bg-[#F8FAFC]'}`}>
            <div className={`w-28 h-1 ${isDarkTheme ? 'bg-gray-600' : 'bg-slate-300'} rounded-full`} />
          </div>
        </div>
      </div>

      {/* Side Information Box */}
      <div className={`max-w-md ${isDarkTheme ? 'bg-[#15151A] border-[#1E1E28] text-gray-300' : 'bg-white border-slate-200 text-slate-700 shadow-xl'} border rounded-2xl p-6 space-y-4 text-sm transition-colors`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-base" style={{ color: primaryAccent }}>
            <Sparkles size={20} />
            <span>0 INBOX Architecture</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className={`text-xs px-2.5 py-1 rounded-lg ${isDarkTheme ? 'bg-[#22222E] hover:bg-[#2A2A38] text-white border-[#333344]' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'} border transition-colors`}
          >
            Open Settings
          </button>
        </div>

        <p className={`leading-relaxed text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
          <strong>Actions & Gestures:</strong>
        </p>
        <ul className={`space-y-2.5 text-xs ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
          <li className="flex items-start gap-2">
            <span className={`px-1.5 py-0.5 rounded font-mono shrink-0 ${isDarkTheme ? 'bg-[#00FFFF]/15 text-[#00FFFF]' : 'bg-sky-100 text-sky-700'}`}>LONG PRESS</span>
            <span><strong>Long press on any card</strong> (or tap the center bottom button) to open the label selector. No swipe activity required.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={`px-1.5 py-0.5 rounded font-mono shrink-0 ${isDarkTheme ? 'bg-[#FF00FF]/15 text-[#FF00FF]' : 'bg-pink-100 text-pink-700'}`}>ACCOUNT LABELS</span>
            <span>Labels are <strong>refreshed anytime the app is opened</strong> from the user's Gmail account via a dropdown popup window.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={`px-1.5 py-0.5 rounded font-mono shrink-0 ${isDarkTheme ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-emerald-100 text-emerald-700'}`}>3-IN-1 TRIAGE</span>
            <span>Selecting a label immediately <strong>applies the label</strong> in Gmail, <strong>marks it as read</strong>, and <strong>moves it from the inbox</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={`px-1.5 py-0.5 rounded font-mono shrink-0 ${isDarkTheme ? 'bg-[#007BFF]/15 text-[#007BFF]' : 'bg-blue-100 text-blue-700'}`}>UNDO SUPPORT</span>
            <span>Full Material 3 Snackbar undo restores the email to the stack and reverses the Gmail API triage action.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={`px-1.5 py-0.5 rounded font-mono shrink-0 ${isDarkTheme ? 'bg-[#FF3366]/15 text-[#FF3366]' : 'bg-red-100 text-red-700'}`}>ICON-ONLY POPUP</span>
            <span>Centered feedback popups display <strong>strictly the action icon</strong> with zero distracting text.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

interface SwipeableCardProps {
  email: MockEmail;
  isTop: boolean;
  isDarkTheme: boolean;
  primaryAccent: string;
  cardBorderColor: string;
  onSwipe: (dir: SwipeDirection) => void;
  onLongPress: () => void;
  key?: React.Key;
}

function SwipeableCard({
  email,
  isTop,
  isDarkTheme,
  primaryAccent,
  cardBorderColor,
  onSwipe,
  onLongPress,
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);

  const startLongPress = () => {
    if (!isTop) return;
    isDraggingRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(50);
        }
        onLongPress();
      }
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    cancelLongPress();
    const offsetX = info.offset.x;
    const offsetY = info.offset.y;
    const threshold = 100;

    if (Math.abs(offsetX) > Math.abs(offsetY)) {
      if (offsetX > threshold) {
        onSwipe('RIGHT');
      } else if (offsetX < -threshold) {
        onSwipe('LEFT');
      }
    } else {
      if (offsetY > threshold) {
        onSwipe('DOWN');
      } else if (offsetY < -threshold) {
        onSwipe('UP');
      }
    }
  };

  const cardBg = isDarkTheme ? 'bg-[#15151A]' : 'bg-[#FFFFFF]';
  const subjectColor = isDarkTheme ? 'text-white' : 'text-slate-900';
  const snippetColor = isDarkTheme ? 'text-gray-400' : 'text-slate-600';
  const tagBg = isDarkTheme ? 'bg-[#FF00FF]/15 text-[#FF00FF] border-[#FF00FF]/30' : 'bg-pink-50 text-pink-600 border-pink-200';

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        y: isTop ? y : 0,
        rotate: isTop ? rotate : 0,
        zIndex: isTop ? 20 : 10,
      }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragStart={() => {
        isDraggingRef.current = true;
        cancelLongPress();
      }}
      onDragEnd={handleDragEnd}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onContextMenu={(e) => {
        if (isTop) {
          e.preventDefault();
          cancelLongPress();
          onLongPress();
        }
      }}
      animate={{
        scale: isTop ? 1 : 0.95,
        y: isTop ? 0 : 8,
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`absolute w-[90%] aspect-[0.66] rounded-[24px] ${cardBg} border-2 ${cardBorderColor} p-6 flex flex-col justify-between shadow-2xl cursor-grab active:cursor-grabbing ${
        !isTop ? 'pointer-events-none' : ''
      }`}
      title={isTop ? 'Swipe in 4 directions or Long Press to Label' : undefined}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${tagBg}`}>
            {email.category}
          </span>
          <span className={`text-[10px] font-mono ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`}>Today</span>
        </div>
        <h4 
          className="text-base font-bold truncate mb-1"
          style={{ color: primaryAccent }}
        >
          {email.sender}
        </h4>
        <h3 className={`text-lg font-extrabold ${subjectColor} leading-snug line-clamp-3 mb-3`}>
          {email.subject}
        </h3>
      </div>

      <div className={`pt-2 border-t ${isDarkTheme ? 'border-[#22222E]/80' : 'border-slate-100'}`}>
        <p className={`text-xs ${snippetColor} line-clamp-6 leading-relaxed`}>
          {email.snippet}
        </p>
      </div>
    </motion.div>
  );
}
