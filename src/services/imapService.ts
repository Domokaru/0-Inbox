// Client service for communicating with the server IMAP endpoints

export interface ImapEmail {
  id: string;
  uid: number;
  sender: string;
  subject: string;
  snippet: string;
  category: string;
  date: string;
  flags: string[];
  isReal: boolean;
}

const IMAP_STORAGE_KEY = 'zero_inbox_imap_creds';
const LAST_APP_PASSWORD_KEY = 'zero_inbox_last_app_password';

export interface StoredCredentials {
  email: string;
  appPassword: string; // Stored only in user's browser localStorage for session persistence
}

export function getStoredImapCredentials(): StoredCredentials | null {
  try {
    const raw = localStorage.getItem(IMAP_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function getLastUsedAppPassword(): string | null {
  try {
    const direct = localStorage.getItem(LAST_APP_PASSWORD_KEY);
    if (direct) return direct;
    const creds = getStoredImapCredentials();
    return creds?.appPassword || null;
  } catch (_) {
    return null;
  }
}

export function sanitizePassword(appPassword: string): string {
  return (appPassword || '').replace(/[\s\-_"“”'‘’\u200B-\u200D\uFEFF]/g, '').trim();
}

export function sanitizeEmail(email: string): string {
  let cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail && !cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@gmail.com`;
  }
  return cleanEmail;
}

export function saveLastUsedAppPassword(appPassword: string) {
  const cleanPassword = sanitizePassword(appPassword);
  if (cleanPassword) {
    try {
      localStorage.setItem(LAST_APP_PASSWORD_KEY, cleanPassword);
    } catch (_) {}
  }
}

export function saveImapCredentials(email: string, appPassword: string) {
  const cleanPassword = sanitizePassword(appPassword);
  const cleanEmail = sanitizeEmail(email);
  try {
    localStorage.setItem(
      IMAP_STORAGE_KEY,
      JSON.stringify({ email: cleanEmail, appPassword: cleanPassword })
    );
    if (cleanPassword) {
      localStorage.setItem(LAST_APP_PASSWORD_KEY, cleanPassword);
    }
  } catch (_) {}
}

export function clearImapCredentials() {
  try {
    localStorage.removeItem(IMAP_STORAGE_KEY);
  } catch (_) {}
}

export function clearAllImapData() {
  try {
    localStorage.removeItem(IMAP_STORAGE_KEY);
    localStorage.removeItem(LAST_APP_PASSWORD_KEY);
  } catch (_) {}
}

export class ImapAuthError extends Error {
  isAuthFailed: boolean;
  constructor(message: string) {
    super(message);
    this.name = 'ImapAuthError';
    this.isAuthFailed = true;
  }
}

export async function testImapConnection(email: string, appPassword: string): Promise<boolean> {
  const cleanEmail = sanitizeEmail(email);
  const cleanPassword = sanitizePassword(appPassword);
  const res = await fetch('/api/imap/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, appPassword: cleanPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    if (res.status === 401 || data.authenticationFailed) {
      throw new ImapAuthError(data.error || 'Invalid credentials or App Password.');
    }
    throw new Error(data.error || 'Failed to connect to Gmail IMAP');
  }
  return true;
}

export async function fetchImapEmails(
  email: string,
  appPassword: string,
  filterTwoDays = true
): Promise<ImapEmail[]> {
  const cleanEmail = sanitizeEmail(email);
  const cleanPassword = sanitizePassword(appPassword);
  const res = await fetch('/api/imap/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, appPassword: cleanPassword, filterTwoDays }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    if (res.status === 401 || data.authenticationFailed) {
      throw new ImapAuthError(data.error || 'Invalid credentials or App Password.');
    }
    throw new Error(data.error || 'Failed to fetch emails via IMAP');
  }
  return data.emails || [];
}

export async function performImapAction(
  email: string,
  appPassword: string,
  uid: number,
  action: 'archive' | 'trash' | 'read' | 'unread' | 'star' | 'unstar'
): Promise<boolean> {
  const res = await fetch('/api/imap/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, appPassword, uid, action }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to perform ${action}`);
  }
  return true;
}

export async function undoImapAction(
  email: string,
  appPassword: string,
  uid: number,
  previousAction: 'archive' | 'trash'
): Promise<boolean> {
  const res = await fetch('/api/imap/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, appPassword, uid, previousAction }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to undo action');
  }
  return true;
}
