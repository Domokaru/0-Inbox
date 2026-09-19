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
  ChevronLeft,
  ChevronUp,
  X,
  Sun,
  Moon,
  FolderInput,
  ChevronDown,
  RefreshCw,
  Check,
  Search,
  LogOut,
  Mail,
  ShieldCheck,
  AlertCircle,
  Radio,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import PixelTitle from './PixelTitle';
import GoogleSignInButton from './GoogleSignInButton';
import DestructiveConfirmModal from './DestructiveConfirmModal';
import {
  googleSignIn,
  logout,
  initAuth,
  fetchEmailsFromGmail,
  fetchLabelsFromGmail,
  archiveGmailThread,
  trashGmailThread,
  unarchiveGmailThread,
  untrashGmailThread,
  markGmailThreadRead,
  markGmailThreadUnread,
  applyNeedsResponseLabel,
  removeNeedsResponseLabel,
  applyCustomLabelToThread,
  unapplyCustomLabelFromThread,
  getStoredAccessToken,
  getStoredUser,
  blockSenderInGmail,
  extractEmailAddress,
  addBlockedSender,
  WebEmail,
  WebLabel,
} from '../services/gmailService';

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
  threadId?: string;
  uid?: number;
  isReal?: boolean;
}

export interface AccountLabel {
  id: string;
  name: string;
  color: string;
  count?: number;
}

const INITIAL_DEMO_EMAILS: MockEmail[] = [
  {
    id: 'msg-1',
    sender: 'GitHub Notifications',
    subject: '[Google/Jetpack] Pull request #142 ready for review',
    snippet:
      'Hey Ben, your latest pull request containing the Credential Manager refactor passed all CI integration tests. Ready for merge.',
    category: 'Updates',
    isReal: false,
  },
  {
    id: 'msg-2',
    sender: 'Google Cloud Platform',
    subject: 'Security Alert: New OAuth Client ID provisioned',
    snippet:
      'A new OAuth 2.0 Web Client ID was created for your project "tidy-signifier-dlcf1" with the scope gmail.modify.',
    category: 'Primary',
    isReal: false,
  },
  {
    id: 'msg-3',
    sender: 'TechCrunch Disrupt',
    subject: 'Early Bird passes: The future of AI & Mobile dev',
    snippet:
      'Save 40% on all stage passes before midnight tonight. Join top Android engineers discussing Jetpack Compose 1.8.',
    category: 'Promotions',
    isReal: false,
  },
  {
    id: 'msg-4',
    sender: 'Sarah Lin (Product Lead)',
    subject: 'Urgent: Sprint review demo this afternoon at 3 PM',
    snippet:
      'Can we sync for 10 minutes on the card gesture thresholds before we present to the executive team today?',
    category: 'Primary',
    isReal: false,
  },
  {
    id: 'msg-5',
    sender: 'Figma Community',
    subject: 'New Neon & Pastel Theme Kit published for Compose',
    snippet:
      'Check out the latest neon color ramp, pastel light tokens, and interactive widget components built specifically for Android UI.',
    category: 'Social',
    isReal: false,
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

const LABEL_COLORS = [
  '#00FFFF',
  '#FF00FF',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#3B82F6',
  '#EF4444',
  '#14B8A6',
];

const INBOX_ZERO_MESSAGES = [
  "You Legend! Inbox zero looks ridiculously good on you!",
  "You absolute BEAST! You didn’t clear your inbox, you conquered it!",
  "Woah there, Overachiever! You just made unread messages extinct!",
  "Okay, Hotshot! Zero emails, maximum swagger!",
  "Look at you, Superstar! Your inbox never stood a chance!",
  "Easy there, Champion! Save some productivity for the rest of us!",
  "Well damn, Hero! You came, you saw, you archived!",
  "You Magnificent Maniac! Nothing left to read, nothing left to fear!",
  "Whoa, Inbox Slayer! You just sent every last message packing!",
  "You glorious Show-Off! Inbox zero achieved like it was nothing!",
  "HELL YEAH - Natural 20 Baby! You just rolled a critical hit on your inbox!"
];

type SwipeDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

interface LastAction {
  email: MockEmail;
  direction?: SwipeDirection;
  customLabel?: string;
  customLabelId?: string;
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
  const [filterTwoDays, setFilterTwoDays] = useState(true);
  const [emails, setEmails] = useState<MockEmail[]>(INITIAL_DEMO_EMAILS);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [activePopup, setActivePopup] = useState<{
    icon: 'archive' | 'trash' | 'pen' | 'mail' | 'label' | 'block';
    color: string;
  } | null>(null);

  const [hasMore, setHasMore] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [batchCount, setBatchCount] = useState(1);

  // Real Gmail Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isLiveGmailMode, setIsLiveGmailMode] = useState(false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [hasDismissedLoginPrompt, setHasDismissedLoginPrompt] = useState(false);
  const [needsLoginRefresh, setNeedsLoginRefresh] = useState(false);

  useEffect(() => {
    if (hasDismissedLoginPrompt) return;
    // If existing OAuth credentials exist, or if an auth refresh is needed, do NOT pop up the blocking modal
    if (getStoredAccessToken() || needsLoginRefresh) {
      setShowLoginPrompt(false);
      return;
    }
    if (hasCheckedAuth && !currentUser) {
      setShowLoginPrompt(true);
    } else if (currentUser) {
      setShowLoginPrompt(false);
    }
  }, [hasCheckedAuth, currentUser, hasDismissedLoginPrompt, needsLoginRefresh]);

  // Destructive Confirmation Modal state (required by Workspace policy)
  const [destructiveModal, setDestructiveModal] = useState<{
    email: MockEmail;
  } | null>(null);

  // Available Account Labels state
  const [accountLabels, setAccountLabels] = useState<AccountLabel[]>(DEFAULT_ACCOUNT_LABELS);
  const [isRefreshingLabels, setIsRefreshingLabels] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('Just now');

  const [showLabelModal, setShowLabelModal] = useState(false);
  const [emailToLabel, setEmailToLabel] = useState<MockEmail | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string>(DEFAULT_ACCOUNT_LABELS[0].id);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [markAsReadWithLabel, setMarkAsReadWithLabel] = useState(true);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  // Double tap detection ref for header
  const lastTapRef = useRef<number>(0);

  // Confetti celebration explosion in matching neon colors
  const triggerNeonConfetti = useCallback(() => {
    const neonColors = isDarkTheme
      ? ['#00FFFF', '#FF00FF', '#007BFF', '#39FF14', '#FFE600', '#FF3366']
      : ['#0EA5E9', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.5, x: 0.5 },
      colors: neonColors,
      startVelocity: 45,
      ticks: 260,
      scalar: 1.2,
    });

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
  }, [isDarkTheme]);

  // Track unread count and explode confetti when number hits 0
  const [inboxZeroText, setInboxZeroText] = useState(INBOX_ZERO_MESSAGES[0]);
  const prevCountRef = useRef(emails.length);
  useEffect(() => {
    if (prevCountRef.current > 0 && emails.length === 0) {
      triggerNeonConfetti();
      setInboxZeroText(INBOX_ZERO_MESSAGES[Math.floor(Math.random() * INBOX_ZERO_MESSAGES.length)]);
    }
    prevCountRef.current = emails.length;
  }, [emails.length, triggerNeonConfetti]);

  // Load Real Gmail Data
  const loadRealGmailData = useCallback(
    async (token: string) => {
      setIsLoadingEmails(true);
      setAuthError(null);
      try {
        const [emailResult, labelsResult] = await Promise.all([
          fetchEmailsFromGmail(token, undefined, filterTwoDays),
          fetchLabelsFromGmail(token),
        ]);

        if (emailResult.emails.length > 0) {
          const formatted: MockEmail[] = emailResult.emails.map((e) => ({
            id: e.id,
            threadId: e.threadId,
            sender: e.sender,
            subject: e.subject,
            snippet: e.snippet,
            category: e.category,
            isReal: true,
          }));
          setEmails(formatted);
          setNextPageToken(emailResult.nextPageToken);
          setHasMore(Boolean(emailResult.nextPageToken));
        } else {
          setEmails([]);
          setHasMore(false);
        }

        if (labelsResult.length > 0) {
          const mappedLabels: AccountLabel[] = labelsResult.map((lbl, idx) => ({
            id: lbl.id,
            name: lbl.name,
            color: LABEL_COLORS[idx % LABEL_COLORS.length],
          }));
          setAccountLabels(mappedLabels);
          setSelectedLabelId(mappedLabels[0].id);
        }

        setIsLiveGmailMode(true);
        setNeedsLoginRefresh(false);
        const now = new Date();
        setLastRefreshedTime(
          `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        );
      } catch (err: any) {
        console.error('Failed to fetch real Gmail data:', err);
        // Rather than popping up an error modal, suppress popup and show the Refresh & Login button
        setNeedsLoginRefresh(true);
        setAuthError(null);
        setShowLoginPrompt(false);
        setEmails([]);
        setHasMore(false);
      } finally {
        setIsLoadingEmails(false);
      }
    },
    [filterTwoDays]
  );

  const handleSwitchToDemo = () => {
    setIsLiveGmailMode(false);
    setNeedsLoginRefresh(false);
    setAuthError(null);
    setEmails(INITIAL_DEMO_EMAILS);
    setBatchCount(1);
    setHasMore(true);
  };

  // Initialize Firebase Auth listener
  useEffect(() => {
    const existingToken = getStoredAccessToken();
    const existingUser = getStoredUser();

    // Immediately try to log in and retrieve email if credentials exist
    if (existingToken) {
      setAccessToken(existingToken);
      setIsLiveGmailMode(true);
      if (existingUser?.email) {
        setCurrentUser({ email: existingUser.email, displayName: existingUser.displayName } as unknown as User);
      }
      loadRealGmailData(existingToken);
      setHasCheckedAuth(true);
    }

    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setNeedsLoginRefresh(false);
        loadRealGmailData(token);
        setHasCheckedAuth(true);
      },
      () => {
        if (!getStoredAccessToken()) {
          setCurrentUser(null);
          setAccessToken(null);
          setIsLiveGmailMode(false);
        }
        setHasCheckedAuth(true);
      }
    );
    return () => unsubscribe();
  }, [loadRealGmailData]);

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsLoginRefresh(false);
        await loadRealGmailData(result.accessToken);
        setShowLoginPrompt(false);
        setShowSettings(false);
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      if (err.code !== 'auth/popup-closed-by-user' && !err.message?.includes('popup-closed-by-user')) {
        setNeedsLoginRefresh(true);
        setAuthError(null);
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  // Refresh inbox using existing OAuth credentials and tokens if available
  const handleRefreshInbox = async () => {
    const token = accessToken || getStoredAccessToken();
    if (token) {
      setIsLoadingEmails(true);
      try {
        await loadRealGmailData(token);
        setNeedsLoginRefresh(false);
        return;
      } catch (err) {
        console.warn('Refresh inbox with stored token failed, prompting fresh sign in:', err);
        setNeedsLoginRefresh(true);
      } finally {
        setIsLoadingEmails(false);
      }
    }
    // Only prompt account selection if no stored token exists or it expired
    handleGoogleSignIn();
  };

  // Block sender action
  const handleConfirmBlockSender = async () => {
    if (!emailToLabel) return;
    const target = emailToLabel;
    setShowBlockConfirm(false);
    setShowLabelModal(false);

    // Remove from UI stack immediately
    setEmails((prev) => prev.filter((e) => e.id !== target.id));

    // Show screen popup with red block icon
    setActivePopup({ icon: 'block', color: '#EF4444' });
    setTimeout(() => {
      setActivePopup(null);
    }, 800);

    const token = accessToken || getStoredAccessToken();
    if (target.isReal && token) {
      try {
        await blockSenderInGmail(token, target.sender, target.threadId || target.id);
      } catch (err) {
        console.error('Failed to block sender in Gmail:', err);
      }
    } else {
      addBlockedSender(target.sender);
    }
  };

  // Logout handler (clears Google OAuth session)
  const handleGoogleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setAccessToken(null);
    setIsLiveGmailMode(false);
    setNeedsLoginRefresh(false);
    setEmails(INITIAL_DEMO_EMAILS);
    setAccountLabels(DEFAULT_ACCOUNT_LABELS);
  };

  // Refresh labels
  const handleRefreshLabels = async () => {
    setIsRefreshingLabels(true);
    if (isLiveGmailMode && accessToken) {
      try {
        const labels = await fetchLabelsFromGmail(accessToken);
        if (labels.length > 0) {
          const mapped: AccountLabel[] = labels.map((lbl, idx) => ({
            id: lbl.id,
            name: lbl.name,
            color: LABEL_COLORS[idx % LABEL_COLORS.length],
          }));
          setAccountLabels(mapped);
        }
      } catch (e) {
        console.error('Error refreshing labels:', e);
      }
    }
    setTimeout(() => {
      setIsRefreshingLabels(false);
      const now = new Date();
      setLastRefreshedTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
    }, 400);
  };

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

  // Execute the actual swipe action (after confirmation if required)
  const executeSwipe = (email: MockEmail, direction: SwipeDirection) => {
    // 1. Show Screen-centered popup: ONLY the icon, NO words or text
    const popupColor = isDarkTheme
      ? {
          RIGHT: '#00FFFF', // Neon Cyan
          LEFT: '#FF3366', // Neon Red/Pink
          UP: '#39FF14', // Neon Green (matches Pen button)
          DOWN: '#4D9FFF', // Neon Lighter Blue (not teal or aqua)
        }[direction]
      : {
          RIGHT: '#0EA5E9',
          LEFT: '#F87171',
          UP: '#22C55E', // Green
          DOWN: '#2563EB',
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

    // 2. Perform live Gmail action if connected via OAuth
    if (email.isReal && accessToken) {
      const threadId = email.threadId || email.id;
      if (direction === 'RIGHT') {
        archiveGmailThread(accessToken, threadId).catch((err) =>
          console.warn('Gmail action notice:', err?.message || err)
        );
      } else if (direction === 'LEFT') {
        trashGmailThread(accessToken, threadId).catch((err) =>
          console.warn('Gmail action notice:', err?.message || err)
        );
      } else if (direction === 'DOWN') {
        markGmailThreadRead(accessToken, threadId).catch((err) =>
          console.warn('Gmail action notice:', err?.message || err)
        );
      } else if (direction === 'UP') {
        applyNeedsResponseLabel(accessToken, threadId).catch((err) =>
          console.warn('Gmail action notice:', err?.message || err)
        );
      }
    }

    // 3. Remove email locally
    setEmails((prev) => prev.filter((item) => item.id !== email.id));

    // 4. Set Last Action for Undo
    const actionDesc = {
      RIGHT: 'Archived email',
      LEFT: 'Moved to Gmail Trash',
      UP: 'Marked "Needs Response"',
      DOWN: 'Marked as read',
    }[direction];

    setLastAction({
      email,
      direction,
      label: `${actionDesc} from ${email.sender.split(' ')[0]}`,
    });
  };

  const handleSwipe = (email: MockEmail, direction: SwipeDirection) => {
    executeSwipe(email, direction);
  };

  // Open the Label selection popup window
  const handleOpenLabelModal = (email?: MockEmail) => {
    const target = email || (emails.length > 0 ? emails[emails.length - 1] : null);
    if (!target) return;
    setEmailToLabel(target);
    setSelectedLabelId(accountLabels[0]?.id || '');
    setIsDropdownOpen(false);
    setLabelSearchQuery('');
    setShowLabelModal(true);
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

    // 2. Perform live Gmail action if connected
    if (emailToLabel.isReal && accessToken) {
      const threadId = emailToLabel.threadId || emailToLabel.id;
      applyCustomLabelToThread(accessToken, threadId, targetId, markAsReadWithLabel).catch((err) =>
        console.warn('Label action notice:', err?.message || err)
      );
    }

    // 3. Remove email locally (triaged to destination label)
    setEmails((prev) => prev.filter((item) => item.id !== emailToLabel.id));

    // 4. Set Last Action for Undo
    setLastAction({
      email: emailToLabel,
      customLabel: labelName,
      customLabelId: targetId,
      label: `Moved to "${labelName}"${markAsReadWithLabel ? ' & marked read' : ''}`,
    });

    // 5. Close modal
    setShowLabelModal(false);
    setEmailToLabel(null);
    setIsDropdownOpen(false);
  };

  const handleUndo = () => {
    if (!lastAction) return;

    // Perform live reverse Gmail action if connected via OAuth
    if (lastAction.email.isReal && accessToken) {
      const threadId = lastAction.email.threadId || lastAction.email.id;
      if (lastAction.direction === 'RIGHT') {
        unarchiveGmailThread(accessToken, threadId).catch((err) =>
          console.warn('Gmail undo notice:', err?.message || err)
        );
      } else if (lastAction.direction === 'LEFT') {
        untrashGmailThread(accessToken, threadId).catch((err) =>
          console.warn('Gmail undo notice:', err?.message || err)
        );
      } else if (lastAction.direction === 'DOWN') {
        markGmailThreadUnread(accessToken, threadId).catch((err) =>
          console.warn('Gmail undo notice:', err?.message || err)
        );
      } else if (lastAction.direction === 'UP') {
        removeNeedsResponseLabel(accessToken, threadId).catch((err) =>
          console.warn('Gmail undo notice:', err?.message || err)
        );
      } else if (lastAction.customLabelId) {
        unapplyCustomLabelFromThread(accessToken, threadId, lastAction.customLabelId).catch((err) =>
          console.warn('Gmail undo notice:', err?.message || err)
        );
      }
    }

    // Restore to top of stack
    setEmails((prev) => [...prev, lastAction.email]);
    setLastAction(null);
  };

  const handleFetchNextBatch = async () => {
    if (isLiveGmailMode && accessToken) {
      setIsLoadingEmails(true);
      try {
        const result = await fetchEmailsFromGmail(accessToken, nextPageToken, filterTwoDays);
        if (result.emails.length > 0) {
          const formatted: MockEmail[] = result.emails.map((e) => ({
            id: e.id,
            threadId: e.threadId,
            sender: e.sender,
            subject: e.subject,
            snippet: e.snippet,
            category: e.category,
            isReal: true,
          }));
          setEmails((prev) => [...formatted, ...prev]);
          setNextPageToken(result.nextPageToken);
          setHasMore(Boolean(result.nextPageToken));
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.warn('Failed to fetch more emails:', err);
      } finally {
        setIsLoadingEmails(false);
      }
      return;
    }

    // Demo Mode batch
    const nextBatch: MockEmail[] = [
      {
        id: `batch-${batchCount}-1`,
        sender: 'Android Weekly #620',
        subject: 'Mastering PointerInput & DragGestures in Jetpack Compose',
        snippet:
          'A deep dive into high-performance physics-based swiping and card stacking in Kotlin.',
        category: 'Updates',
        isReal: false,
      },
      {
        id: `batch-${batchCount}-2`,
        sender: 'Google Developer Relations',
        subject: 'Credential Manager Migration Guide for Android 14',
        snippet:
          'How to replace GoogleSignInClient with androidx.credentials and GoogleIdTokenCredential seamlessly.',
        category: 'Primary',
        isReal: false,
      },
      {
        id: `batch-${batchCount}-3`,
        sender: 'Stripe Billing',
        subject: 'Your monthly invoice for Cloud Run API proxy',
        snippet:
          'Your statement for the current billing cycle is ready. Total charges: $0.00 (Free tier applied).',
        category: 'Updates',
        isReal: false,
      },
    ];

    setEmails((prev) => [...nextBatch, ...prev]);
    setBatchCount((c) => c + 1);
    if (batchCount >= 2) {
      setHasMore(false);
    }
  };

  const resetDemo = () => {
    setEmails(INITIAL_DEMO_EMAILS);
    setLastAction(null);
    setHasMore(true);
    setBatchCount(1);
    setIsLiveGmailMode(false);
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
      {/* Destructive Confirmation Modal for Gmail Trashing */}
      <DestructiveConfirmModal
        isOpen={Boolean(destructiveModal)}
        title="Move to Gmail Trash?"
        description="Are you sure you want to move this conversation to your Gmail Trash folder? This will remove it from your active inbox."
        itemDetails={
          destructiveModal
            ? {
                sender: destructiveModal.email.sender,
                subject: destructiveModal.email.subject,
              }
            : undefined
        }
        confirmLabel="Move to Trash"
        cancelLabel="Cancel"
        isDarkTheme={isDarkTheme}
        onCancel={() => setDestructiveModal(null)}
        onConfirm={() => {
          if (destructiveModal) {
            executeSwipe(destructiveModal.email, 'LEFT');
            setDestructiveModal(null);
          }
        }}
      />

      {/* Phone Hardware Shell with outer quick controls */}
      <div className="flex flex-col items-center">
        <div
          className={`relative w-[380px] h-[740px] ${canvasBg} rounded-[48px] border-4 ${deviceBorder} shadow-[0_0_50px_rgba(0,123,255,0.15)] flex flex-col overflow-hidden select-none transition-colors duration-300`}
        >
          {/* Device Camera Notch */}
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 ${
              isDarkTheme ? 'bg-[#22222E]' : 'bg-[#E2E8F0]'
            } rounded-b-2xl z-50 flex items-center justify-center gap-3 transition-colors`}
          >
            <div
              className={`w-10 h-1.5 ${isDarkTheme ? 'bg-[#111118]' : 'bg-[#94A3B8]'} rounded-full`}
            />
            <div
              className={`w-2.5 h-2.5 ${isDarkTheme ? 'bg-[#0a0a0f]' : 'bg-[#64748B]'} rounded-full`}
            />
          </div>

          {/* Android Status Bar */}
          <div
            className={`h-10 px-8 pt-2 flex items-center justify-between text-xs ${statusBarText} font-mono z-40 ${canvasBg}`}
          >
            <span>9:41</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold" style={{ color: primaryAccent }}>
                5G
              </span>
              <div className="w-4 h-2.5 border border-current rounded-sm p-[1px]">
                <div className={`w-full h-full ${signalColor} rounded-[1px]`} />
              </div>
            </div>
          </div>

          {/* Top App Header: Pixelated "0 INBOX" with Slashed Zero (Double-Tap opens Settings) */}
          <div
            onClick={handleHeaderTap}
            onDoubleClick={() => setShowSettings(true)}
            className="px-6 pt-2 pb-1 flex flex-col items-center justify-center z-30 cursor-pointer select-none transition-transform active:scale-98 bg-transparent"
            title="Double-tap header to open Settings"
          >
            <PixelTitle
              zeroColor={primaryAccent}
              inboxColor={secondaryAccent}
              width={160}
              height={52}
            />

            {/* Gmail Connection Badge */}
            <div className="mt-1 flex items-center gap-1.5">
              {isLiveGmailMode && currentUser && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                    isDarkTheme
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate max-w-[170px]">{currentUser.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Stack View Area */}
          <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
            {isLoadingEmails && (
              <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                <RefreshCw
                  size={32}
                  className="animate-spin"
                  style={{ color: primaryAccent }}
                />
                <span className="text-xs font-bold font-mono tracking-wider text-white">
                  SYNCING GMAIL INBOX...
                </span>
              </div>
            )}

            {emails.length === 0 && !isLoadingEmails && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                className="flex flex-col items-center justify-center text-center p-4 z-20 select-none max-w-[320px]"
              >
                {/* Big Pixelated 0 in Center of Screen */}
                <div
                  className="cursor-pointer transition-transform hover:scale-105 active:scale-95 my-1"
                  onClick={needsLoginRefresh ? handleRefreshInbox : triggerNeonConfetti}
                  title={needsLoginRefresh ? 'Click to Refresh & Login' : 'Click to explode neon confetti!'}
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
                    {needsLoginRefresh ? 'SESSION EXPIRED' : '0 INBOX'}
                  </h3>
                  <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                    {needsLoginRefresh
                      ? 'Previous session expired. Tap below to log in and sync mail.'
                      : inboxZeroText}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="mt-5 flex flex-wrap items-center justify-center gap-2"
                >
                  {needsLoginRefresh ? (
                    <>
                      <button
                        onClick={handleRefreshInbox}
                        className="px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
                        style={{
                          backgroundColor: primaryAccent,
                          borderColor: primaryAccent,
                          color: '#000000',
                        }}
                      >
                        <RefreshCw size={14} className="animate-spin-once" />
                        <span>Refresh & Login</span>
                      </button>
                      <button
                        onClick={handleSwitchToDemo}
                        className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer ${
                          isDarkTheme
                            ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:text-white'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <span>Demo Mode</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={triggerNeonConfetti}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                        style={{
                          backgroundColor: `${primaryAccent}18`,
                          borderColor: `${primaryAccent}45`,
                          color: primaryAccent,
                        }}
                      >
                        <span>🎉</span>
                        <span>Confetti</span>
                      </button>

                      {isLiveGmailMode && currentUser ? (
                        <button
                          onClick={handleRefreshInbox}
                          className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
                          style={{
                            backgroundColor: `${primaryAccent}18`,
                            borderColor: `${primaryAccent}45`,
                            color: primaryAccent,
                          }}
                        >
                          <RefreshCw size={14} />
                          <span>Refresh Inbox</span>
                        </button>
                      ) : hasMore ? (
                        <button
                          onClick={handleFetchNextBatch}
                          className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                          style={{
                            backgroundColor: `${primaryAccent}18`,
                            borderColor: `${primaryAccent}45`,
                            color: primaryAccent,
                          }}
                        >
                          <span>More Email?</span>
                        </button>
                      ) : (
                        <button
                          onClick={resetDemo}
                          className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                          style={{
                            backgroundColor: `${primaryAccent}18`,
                            borderColor: `${primaryAccent}45`,
                            color: primaryAccent,
                          }}
                        >
                          <span>Reload Demo</span>
                        </button>
                      )}
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* Informational Pagination Card (rendered at bottom of stack) */}
            {hasMore && emails.length > 0 && (
              <motion.div
                className={`absolute w-[85%] aspect-[0.75] rounded-[24px] ${
                  isDarkTheme ? 'bg-[#1A1A24]' : 'bg-[#F8FAFC]'
                } border-2 border-transparent p-6 flex flex-col items-center justify-center text-center shadow-lg cursor-pointer`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleFetchNextBatch}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: `${tertiaryAccent}20`,
                    color: tertiaryAccent,
                  }}
                >
                  <Sparkles size={24} />
                </div>
                <h4 className={`font-bold text-lg ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                  More Emails Available
                </h4>
                <p
                  className={`text-xs mt-1 mb-4 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}
                >
                  {isLiveGmailMode
                    ? 'Swipe or tap to fetch the next batch from Gmail'
                    : 'Swipe or tap to fetch more emails via Gmail API'}
                </p>
                <span
                  className="px-4 py-2 rounded-xl border text-xs font-semibold shadow-md flex items-center gap-1"
                  style={{
                    backgroundColor: `${primaryAccent}18`,
                    borderColor: `${primaryAccent}45`,
                    color: primaryAccent,
                  }}
                >
                  More Email?
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
                  cardBorderColor={isTop ? cardBorderColor : 'border-transparent'}
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
                  className={`absolute z-50 w-28 h-28 rounded-full ${
                    isDarkTheme ? 'bg-black/85' : 'bg-white/90'
                  } backdrop-blur-md flex items-center justify-center border-4 shadow-2xl pointer-events-none`}
                  style={{ borderColor: activePopup.color }}
                >
                  {activePopup.icon === 'archive' && (
                    <Archive size={48} color={activePopup.color} strokeWidth={2.5} />
                  )}
                  {activePopup.icon === 'trash' && (
                    <Trash2 size={48} color={activePopup.color} strokeWidth={2.5} />
                  )}
                  {activePopup.icon === 'pen' && (
                    <PenLine size={48} color={activePopup.color} strokeWidth={2.5} />
                  )}
                  {activePopup.icon === 'mail' && (
                    <MailOpen size={48} color={activePopup.color} strokeWidth={2.5} />
                  )}
                  {activePopup.icon === 'label' && (
                    <FolderInput size={48} color={activePopup.color} strokeWidth={2.5} />
                  )}
                  {activePopup.icon === 'block' && (
                    <ShieldAlert size={48} color={activePopup.color} strokeWidth={2.5} />
                  )}
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
                  className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center p-3"
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
                        <div
                          className={`p-2 rounded-xl ${
                            isDarkTheme
                              ? 'bg-[#00FFFF]/15 text-[#00FFFF]'
                              : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          <FolderInput size={18} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm leading-tight">Assign Label</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowLabelModal(false)}
                          className="p-1.5 rounded-lg hover:bg-gray-500/20 text-gray-400 hover:text-gray-200"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Email Target Card */}
                    <div
                      className={`my-3 p-3 rounded-2xl border ${
                        isDarkTheme
                          ? 'bg-[#1E1E2C] border-[#2E2E42]'
                          : 'bg-slate-50 border-slate-200'
                      } text-xs`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 mb-0.5">
                        <span className="truncate" style={{ color: primaryAccent }}>
                          {emailToLabel.sender}
                        </span>
                        <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          Target Email
                        </span>
                      </div>
                      <p
                        className={`font-bold truncate text-xs ${
                          isDarkTheme ? 'text-white' : 'text-slate-900'
                        }`}
                      >
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
                          <span className="truncate">
                            {selectedLabel?.name || 'Choose an account label...'}
                          </span>
                        </div>
                        <ChevronDown
                          size={15}
                          className={`transition-transform duration-200 shrink-0 ${
                            isDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Dropdown Menu Popup List */}
                      {isDropdownOpen && (
                        <div
                          className={`absolute top-full left-0 right-0 mt-1.5 max-h-48 overflow-y-auto rounded-xl border shadow-2xl z-50 p-1.5 ${
                            isDarkTheme
                              ? 'bg-[#181826] border-[#383850]'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="p-1 mb-1 border-b border-gray-500/20 flex items-center gap-1.5">
                            <Search size={13} className="text-gray-400 shrink-0" />
                            <input
                              type="text"
                              value={labelSearchQuery}
                              onChange={(e) => setLabelSearchQuery(e.target.value)}
                              placeholder="Search labels..."
                              className={`w-full bg-transparent text-xs outline-hidden ${
                                isDarkTheme
                                  ? 'text-white placeholder-gray-500'
                                  : 'text-slate-900 placeholder-slate-400'
                              }`}
                            />
                            {labelSearchQuery && (
                              <button
                                onClick={() => setLabelSearchQuery('')}
                                className="text-gray-400 hover:text-white text-[10px]"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {accountLabels
                              .filter((l) =>
                                l.name.toLowerCase().includes(labelSearchQuery.toLowerCase())
                              )
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
                                        ? isDarkTheme
                                          ? 'bg-[#007BFF]/25 text-[#00FFFF] font-bold'
                                          : 'bg-sky-50 text-sky-700 font-bold'
                                        : isDarkTheme
                                        ? 'hover:bg-[#252538] text-gray-200'
                                        : 'hover:bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: label.color }}
                                      />
                                      <span className="truncate">{label.name}</span>
                                    </div>
                                    {isSelected && (
                                      <Check size={14} className="text-emerald-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Explanation */}
                    <div
                      className={`p-3 rounded-2xl border ${
                        isDarkTheme
                          ? 'bg-[#111118] border-[#22222E]'
                          : 'bg-slate-50 border-slate-200'
                      } text-[11px] space-y-1.5 mb-4`}
                    >
                      <div className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">
                        Automated Triage Action:
                      </div>
                      <div className="flex items-center gap-2 text-emerald-500 font-medium">
                        <Check size={13} className="shrink-0" />
                        <span>
                          Apply label <strong>{selectedLabel?.name}</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => setMarkAsReadWithLabel(!markAsReadWithLabel)}
                        className={`w-full flex items-center justify-between text-left transition-colors ${
                          markAsReadWithLabel ? 'text-emerald-500' : 'text-gray-400'
                        } font-medium`}
                      >
                        <div className="flex items-center gap-2">
                          <Check size={13} className={`shrink-0 ${!markAsReadWithLabel && 'opacity-0'}`} />
                          <span>
                            Mark email as <strong>Read</strong>
                          </span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${
                            markAsReadWithLabel
                              ? 'bg-emerald-500'
                              : isDarkTheme
                              ? 'bg-gray-700'
                              : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full bg-white transition-transform ${
                              markAsReadWithLabel ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </button>
                      <div className="flex items-center gap-2 text-emerald-500 font-medium">
                        <Check size={13} className="shrink-0" />
                        <span>
                          Move from <strong>Inbox</strong>
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowBlockConfirm(true)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5 border-none bg-red-600 hover:bg-red-700 active:bg-red-800 cursor-pointer"
                      >
                        <ShieldAlert size={14} />
                        <span>BLOCK</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyLabel()}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5 border-none bg-[#FF00FF] hover:bg-[#FF00FF]/90 cursor-pointer"
                      >
                        <FolderInput size={14} />
                        <span>Apply & Move</span>
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Block Sender Confirmation Dialog */}
            <AnimatePresence>
              {showBlockConfirm && emailToLabel && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => setShowBlockConfirm(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full max-w-[310px] rounded-3xl p-5 border shadow-2xl flex flex-col items-center text-center ${
                      isDarkTheme
                        ? 'bg-[#181826] border-red-500/30 text-white'
                        : 'bg-white border-red-200 text-slate-900'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mb-3">
                      <ShieldAlert size={24} />
                    </div>
                    <h4 className="font-bold text-base mb-1">Block Sender?</h4>
                    <p className={`text-xs mb-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                      Are you sure you want to block emails from this address?
                    </p>
                    <div className="w-full py-1.5 px-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-semibold truncate mb-3">
                      {extractEmailAddress(emailToLabel.sender)}
                    </div>
                    <p className={`text-[11px] leading-relaxed mb-4 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                      This email address will be added to your blocked list in Gmail, and future messages will automatically go to Trash.
                    </p>
                    <div className="flex items-center gap-2.5 w-full">
                      <button
                        type="button"
                        onClick={() => setShowBlockConfirm(false)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          isDarkTheme
                            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        No, Keep
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmBlockSender}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 shadow-lg shadow-red-600/30 cursor-pointer border-none"
                      >
                        Yes, Block
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
                  className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center"
                >
                  <motion.div
                    initial={{ rotateX: -90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    exit={{ rotateX: -90, opacity: 0 }}
                    style={{ transformOrigin: 'top center', perspective: '1200px' }}
                    className={`absolute inset-0 w-full h-full ${
                      isDarkTheme
                        ? 'bg-[#181822] text-white'
                        : 'bg-white text-slate-900'
                    } p-5 shadow-2xl overflow-y-auto flex flex-col`}
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
                      {/* Gmail Account Section */}
                      <div>
                        <label className="text-xs font-semibold text-gray-400 block mb-2 uppercase tracking-wider">
                          Gmail Integration
                        </label>
                        {isLiveGmailMode && currentUser ? (
                          <div
                            className={`p-3 rounded-2xl border ${
                              isDarkTheme
                                ? 'bg-[#111118] border-[#252538]'
                                : 'bg-slate-50 border-slate-200'
                            } flex items-center justify-between gap-2`}
                          >
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Connected (Google OAuth)</span>
                              </div>
                              <p className="text-xs text-gray-400 truncate mt-0.5 font-mono">
                                {currentUser.email}
                              </p>
                            </div>
                            <button
                              onClick={handleGoogleLogout}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <LogOut size={12} />
                              <span>Disconnect</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2.5 flex justify-center">
                            <GoogleSignInButton
                              onClick={handleGoogleSignIn}
                              isLoading={isSigningInGoogle}
                              label="Sign in with Google"
                              variant="primary"
                            />
                          </div>
                        )}
                      </div>

                      {/* Theme Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">
                            Theme Mode
                          </label>
                          <p className={`text-[10px] mt-0.5 ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`}>
                            {isDarkTheme ? 'Neon Dark' : 'Pastel Light'}
                          </p>
                        </div>
                        <button
                          onClick={() => setIsDarkTheme(!isDarkTheme)}
                          className={`w-12 h-6 rounded-full p-1 transition-colors ${
                            isDarkTheme ? 'bg-[#00FFFF]' : 'bg-slate-300'
                          }`}
                        >
                          <motion.div
                            className="w-4 h-4 rounded-full bg-white shadow-sm"
                            animate={{ x: isDarkTheme ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>

                      {/* Filter Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">
                            Filter Emails
                          </label>
                          <p className={`text-[10px] mt-0.5 ${isDarkTheme ? 'text-gray-500' : 'text-slate-400'}`}>
                            {filterTwoDays ? 'Last 2 Days' : 'All Inbox Mail'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !filterTwoDays;
                            setFilterTwoDays(newValue);
                            if (isLiveGmailMode && accessToken) loadRealGmailData(accessToken);
                          }}
                          className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${
                            filterTwoDays ? 'bg-[#00FFFF]' : 'bg-slate-300'
                          }`}
                        >
                          <motion.div
                            className="w-4 h-4 rounded-full bg-white shadow-sm"
                            animate={{ x: filterTwoDays ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowSettings(false)}
                      className="w-full mt-3 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-transform active:scale-98"
                      style={{ backgroundColor: tertiaryAccent }}
                    >
                      Done
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Trigger Buttons on Bottom */}
          <div
            className={`px-4 py-3 ${
              isDarkTheme ? 'bg-[#121218] border-[#1E1E28]' : 'bg-[#F8FAFC] border-slate-200'
            } border-t flex items-center justify-between z-30 transition-colors`}
          >
            {/* 1. Needs Response / Pen (Swipe Up) - Neon Green */}
            <button
              title="Needs Response (Swipe Up)"
              disabled={emails.length === 0}
              onClick={() => emails.length > 0 && handleSwipe(emails[emails.length - 1], 'UP')}
              className={`w-10 h-10 rounded-full relative ${
                isDarkTheme
                  ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14]'
                  : 'bg-green-50 border-green-200 text-green-600'
              } border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 cursor-pointer`}
            >
              <div className="absolute top-0 w-full flex justify-center -mt-0.5">
                <ChevronUp size={13} strokeWidth={4} className="opacity-70" />
              </div>
              <PenLine size={18} />
            </button>

            {/* 2. Mark Read / South (Swipe Down) - Neon Lighter Blue (not teal or aqua) */}
            <button
              title="Mark Read (Swipe Down)"
              disabled={emails.length === 0}
              onClick={() => emails.length > 0 && handleSwipe(emails[emails.length - 1], 'DOWN')}
              className={`w-10 h-10 rounded-full relative ${
                isDarkTheme
                  ? 'bg-[#4D9FFF]/10 border-[#4D9FFF]/40 text-[#4D9FFF]'
                  : 'bg-blue-50 border-blue-200 text-blue-600'
              } border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 cursor-pointer`}
            >
              <MailOpen size={18} />
              <div className="absolute bottom-0 w-full flex justify-center -mb-0.5">
                <ChevronDown size={13} strokeWidth={4} className="opacity-70" />
              </div>
            </button>

            {/* 3. Delete / Trash (Swipe Left) */}
            <button
              title="Delete / Trash (Swipe Left)"
              disabled={emails.length === 0}
              onClick={() =>
                emails.length > 0 && handleSwipe(emails[emails.length - 1], 'LEFT')
              }
              className={`w-10 h-10 rounded-full relative ${
                isDarkTheme
                  ? 'bg-[#FF3366]/10 border-[#FF3366]/40 text-[#FF3366]'
                  : 'bg-red-50 border-red-200 text-red-500'
              } border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 cursor-pointer`}
            >
              <div className="absolute left-0 h-full flex items-center -ml-0.5">
                <ChevronLeft size={13} strokeWidth={4} className="opacity-70" />
              </div>
              <Trash2 size={18} />
            </button>

            {/* 3. Archive (Swipe Right) */}
            <button
              title="Archive (Swipe Right)"
              disabled={emails.length === 0}
              onClick={() =>
                emails.length > 0 && handleSwipe(emails[emails.length - 1], 'RIGHT')
              }
              className={`w-10 h-10 rounded-full relative ${
                isDarkTheme
                  ? 'bg-[#00FFFF]/10 border-[#00FFFF]/40 text-[#00FFFF]'
                  : 'bg-sky-50 border-sky-200 text-sky-600'
              } border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 cursor-pointer`}
            >
              <Archive size={18} />
              <div className="absolute right-0 h-full flex items-center -mr-0.5">
                <ChevronRight size={13} strokeWidth={4} className="opacity-70" />
              </div>
            </button>

            {/* Undo Button */}
            <button
              title="Undo Last Action"
              disabled={!lastAction}
              onClick={handleUndo}
              className={`w-10 h-10 rounded-full ${
                isDarkTheme
                  ? 'bg-[#FFFF00]/10 border-[#FFFF00]/40 text-[#FFFF00]'
                  : 'bg-yellow-50 border-yellow-300 text-[#EAB308]'
              } border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 cursor-pointer`}
            >
              <RotateCcw size={18} />
            </button>

            {/* 4. Assign Custom Label */}
            <button
              title="Assign Label (or Long Press Card)"
              disabled={emails.length === 0}
              onClick={() => handleOpenLabelModal()}
              className={`w-10 h-10 rounded-full ${
                isDarkTheme
                  ? 'bg-[#B026FF]/10 border-[#B026FF]/40 text-[#B026FF]'
                  : 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600'
              } border flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 cursor-pointer`}
            >
              <FolderInput size={18} />
            </button>
          </div>

          {/* Android Gesture Bar */}
          <div
            className={`h-4 flex items-center justify-center ${
              isDarkTheme ? 'bg-[#121218]' : 'bg-[#F8FAFC]'
            }`}
          >
            <div
              className={`w-28 h-1 ${isDarkTheme ? 'bg-gray-600' : 'bg-slate-300'} rounded-full`}
            />
          </div>
        </div>
      </div>

      {/* Startup Login Prompt Overlay */}
      <AnimatePresence>
        {showLoginPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className={`max-w-md w-full p-8 rounded-3xl border shadow-2xl space-y-5 ${
                isDarkTheme
                  ? 'bg-[#15151A] border-[#2A2A3E] text-white'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex justify-center mb-6">
                <img src="/app-icon.svg" alt="0 Inbox Logo" className="w-24 h-24" />
              </div>

              <div className="pt-2 flex flex-col items-center space-y-5">
                <GoogleSignInButton
                  onClick={handleGoogleSignIn}
                  isLoading={isSigningInGoogle}
                  label="Sign in with Google"
                  variant="primary"
                />

                {/* Fallback for testing UI without login */}
                <button
                  onClick={() => {
                    setHasDismissedLoginPrompt(true);
                    setShowLoginPrompt(false);
                  }}
                  className={`w-full py-2 text-xs font-semibold underline underline-offset-4 opacity-60 hover:opacity-100 transition-opacity cursor-pointer ${
                    isDarkTheme ? 'text-gray-400' : 'text-slate-500'
                  }`}
                >
                  Skip for now (Use Demo Data)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SwipeableCardProps {
  key?: React.Key;
  email: MockEmail;
  isTop: boolean;
  isDarkTheme: boolean;
  primaryAccent: string;
  cardBorderColor: string;
  onSwipe: (dir: SwipeDirection) => void;
  onLongPress: () => void;
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
  const tagBg = isDarkTheme
    ? 'bg-[#FF00FF]/15 text-[#FF00FF] border-[#FF00FF]/30'
    : 'bg-pink-50 text-pink-600 border-pink-200';

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
      className={`absolute w-[85%] aspect-[0.75] rounded-[24px] ${cardBg} border-2 ${cardBorderColor} p-6 flex flex-col justify-start shadow-2xl cursor-grab active:cursor-grabbing ${
        !isTop ? 'pointer-events-none' : ''
      }`}
      title={isTop ? 'Swipe in 4 directions or Long Press to Label' : undefined}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${tagBg}`}>
            {email.category}
          </span>
          <div className="flex items-center gap-1.5">
            {email.isReal && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                GMAIL
              </span>
            )}
            <span
              className={`text-[10px] font-mono ${
                isDarkTheme ? 'text-gray-500' : 'text-slate-400'
              }`}
            >
              Today
            </span>
          </div>
        </div>

        <h4 className="text-base font-bold truncate mb-1" style={{ color: primaryAccent }}>
          {email.sender}
        </h4>

        <h3 className={`text-lg font-extrabold ${subjectColor} leading-snug line-clamp-3 mb-3`}>
          {email.subject}
        </h3>
      </div>

      <div className={`mt-2 pt-3 border-t ${isDarkTheme ? 'border-[#22222E]/80' : 'border-slate-200'}`}>
        <p className={`text-xs ${snippetColor} line-clamp-6 leading-relaxed`}>{email.snippet}</p>
      </div>
    </motion.div>
  );
}
