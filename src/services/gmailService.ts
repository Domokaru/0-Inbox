import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

const provider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));

const TOKEN_KEY = 'zeroinbox_gmail_access_token';
const USER_PROFILE_KEY = 'zeroinbox_gmail_user_profile';
const BLOCKED_SENDERS_KEY = 'zeroinbox_blocked_senders';

export function extractEmailAddress(sender: string): string {
  if (!sender) return '';
  const match = sender.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = sender.match(emailRegex);
  if (emailMatch && emailMatch[1]) {
    return emailMatch[1].trim().toLowerCase();
  }
  return sender.trim().toLowerCase();
}

export function getBlockedSenders(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(BLOCKED_SENDERS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addBlockedSender(emailOrSender: string): void {
  try {
    const email = extractEmailAddress(emailOrSender);
    if (!email) return;
    const current = getBlockedSenders();
    if (!current.includes(email)) {
      current.push(email);
      if (typeof window !== 'undefined') {
        localStorage.setItem(BLOCKED_SENDERS_KEY, JSON.stringify(current));
      }
    }
  } catch (e) {
    console.warn('Could not save blocked sender to localStorage', e);
  }
}

export function isSenderBlocked(sender: string): boolean {
  const email = extractEmailAddress(sender);
  if (!email) return false;
  return getBlockedSenders().includes(email);
}

let cachedAccessToken: string | null = null;
try {
  cachedAccessToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
} catch {
  cachedAccessToken = null;
}
let isSigningIn = false;

export const saveStoredAuth = (token: string, user?: { email?: string | null; displayName?: string | null }) => {
  cachedAccessToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (user?.email) {
      localStorage.setItem(
        USER_PROFILE_KEY,
        JSON.stringify({
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
        })
      );
    }
  } catch (e) {
    console.warn('Could not store auth in localStorage', e);
  }
};

export const getStoredAccessToken = (): string | null => {
  try {
    return cachedAccessToken || (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
  } catch {
    return null;
  }
};

export const getStoredUser = (): { email?: string; displayName?: string } | null => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearStoredAuth = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
  } catch (e) {
    console.warn('Could not clear auth from localStorage', e);
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we already had existing OAuth credentials saved, attempt immediate login and retrieval
  const existingToken = cachedAccessToken || (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
  const existingUser = getStoredUser();

  if (existingToken && onAuthSuccess) {
    const dummyUser = auth.currentUser || ({
      email: existingUser?.email || 'Google User',
      displayName: existingUser?.displayName || 'Google User',
    } as unknown as User);
    onAuthSuccess(dummyUser, existingToken);
  }

  // Handle redirect result for mobile/PWA (APK) installations
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          saveStoredAuth(cachedAccessToken, result.user);
          if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
        }
      }
    })
    .catch((error) => {
      console.error('Redirect sign-in error:', error);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        saveStoredAuth(cachedAccessToken, user);
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is logged in to Firebase, but access token needs refresh
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      if (!existingToken) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Use Redirect for mobile devices or PWA/APK wrappers to prevent authorization issues
    if (isMobile || isStandalone) {
      await signInWithRedirect(auth, provider);
      return null;
    } else {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('No access token returned from Google Sign-In');
      }
      cachedAccessToken = credential.accessToken;
      saveStoredAuth(cachedAccessToken, result.user);
      return { user: result.user, accessToken: cachedAccessToken };
    }
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user' && !error.message?.includes('popup-closed-by-user')) {
      console.error('Sign-in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  clearStoredAuth();
};

export interface WebEmail {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  category: string;
}

export interface WebLabel {
  id: string;
  name: string;
  type: string;
}

let cachedNeedsResponseLabelId: string | null = null;

export async function fetchEmailsFromGmail(
  accessToken: string,
  pageToken?: string,
  filterTwoDays: boolean = true
): Promise<{ emails: WebEmail[]; nextPageToken?: string }> {
  const queryParts = ['in:inbox'];
  if (filterTwoDays) {
    queryParts.push('newer_than:2d');
  }
  const query = encodeURIComponent(queryParts.join(' '));
  
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500`;
  if (pageToken) {
    url += `&pageToken=${encodeURIComponent(pageToken)}`;
  }

  const listRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    throw new Error(`Gmail API error: ${listRes.statusText}`);
  }

  const listData = await listRes.json();
  const messages: { id: string; threadId: string }[] = listData.messages || [];

  // Fetch metadata for each message
  const emailPromises = messages.map(async (m) => {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const subject =
        headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
      const sender =
        headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
      const labelIds: string[] = msg.labelIds || [];

      let category = 'Primary';
      if (labelIds.includes('CATEGORY_PROMOTIONS')) category = 'Promotions';
      else if (labelIds.includes('CATEGORY_SOCIAL')) category = 'Social';
      else if (labelIds.includes('CATEGORY_UPDATES')) category = 'Updates';

      return {
        id: msg.id,
        threadId: msg.threadId || m.threadId,
        sender,
        subject,
        snippet: msg.snippet || '',
        category,
      } as WebEmail;
    } catch {
      return null;
    }
  });

  const resolved = await Promise.all(emailPromises);
  const emails = resolved
    .filter((e): e is WebEmail => e !== null)
    .filter((e) => !isSenderBlocked(e.sender));

  return { emails, nextPageToken: listData.nextPageToken };
}

export async function fetchLabelsFromGmail(accessToken: string): Promise<WebLabel[]> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch labels');
  const data = await res.json();
  const labels: any[] = data.labels || [];
  const excludedIds = new Set(['CHAT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'INBOX']);

  return labels
    .filter((l) => !excludedIds.has(l.id))
    .map((l) => ({ id: l.id, name: l.name, type: l.type || 'user' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function archiveGmailThread(accessToken: string, threadId: string) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      removeLabelIds: ['INBOX', 'UNREAD'],
    }),
  });
}

export async function unarchiveGmailThread(accessToken: string, threadId: string) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      addLabelIds: ['INBOX'],
    }),
  });
}

export async function trashGmailThread(accessToken: string, threadId: string) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function untrashGmailThread(accessToken: string, threadId: string) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/untrash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function markGmailThreadRead(accessToken: string, threadId: string) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      removeLabelIds: ['UNREAD'],
    }),
  });
}

export async function markGmailThreadUnread(accessToken: string, threadId: string) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      addLabelIds: ['UNREAD'],
    }),
  });
}

export async function applyNeedsResponseLabel(accessToken: string, threadId: string) {
  if (!cachedNeedsResponseLabelId) {
    const labels = await fetchLabelsFromGmail(accessToken);
    const existing = labels.find((l) => l.name === 'Needs Response');
    if (existing) {
      cachedNeedsResponseLabelId = existing.id;
    } else {
      const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Needs Response',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        }),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        cachedNeedsResponseLabelId = created.id;
      }
    }
  }

  if (cachedNeedsResponseLabelId) {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: [cachedNeedsResponseLabelId],
        removeLabelIds: ['UNREAD'],
      }),
    });
  }
}

export async function removeNeedsResponseLabel(accessToken: string, threadId: string) {
  if (!cachedNeedsResponseLabelId) {
    const labels = await fetchLabelsFromGmail(accessToken);
    const existing = labels.find((l) => l.name === 'Needs Response');
    if (existing) cachedNeedsResponseLabelId = existing.id;
  }

  if (cachedNeedsResponseLabelId) {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: [cachedNeedsResponseLabelId],
      }),
    });
  }
}

export async function applyCustomLabelToThread(
  accessToken: string,
  threadId: string,
  labelId: string,
  markAsRead: boolean = true
) {
  const removeLabelIds = ['INBOX'];
  if (markAsRead) {
    removeLabelIds.push('UNREAD');
  }
  
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      addLabelIds: [labelId],
      removeLabelIds,
    }),
  });
}

export async function unapplyCustomLabelFromThread(
  accessToken: string,
  threadId: string,
  labelId: string
) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      removeLabelIds: [labelId],
      addLabelIds: ['INBOX', 'UNREAD'],
    }),
  });
}

export async function blockSenderInGmail(
  accessToken: string,
  senderRaw: string,
  threadId?: string
): Promise<{ success: boolean; filterCreated: boolean; senderEmail: string }> {
  const senderEmail = extractEmailAddress(senderRaw);
  addBlockedSender(senderEmail);

  let filterCreated = false;
  // 1. Attempt to create filter in Gmail Settings: criteria.from = senderEmail, action = remove INBOX, add TRASH
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/filters', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        criteria: {
          from: senderEmail,
        },
        action: {
          removeLabelIds: ['INBOX'],
          addLabelIds: ['TRASH'],
        },
      }),
    });
    if (res.ok) {
      filterCreated = true;
    } else {
      console.warn('Gmail settings.filters.create response status:', res.status);
    }
  } catch (e) {
    console.warn('Failed to create Gmail filter for blocked sender:', e);
  }

  // 2. Also trash the current thread so it leaves the inbox right away
  if (threadId) {
    try {
      await trashGmailThread(accessToken, threadId);
    } catch (e) {
      console.warn('Failed to trash thread for blocked sender:', e);
    }
  }

  return { success: true, filterCreated, senderEmail };
}
