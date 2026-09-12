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

export function saveImapCredentials(email: string, appPassword: string) {
  const cleanPassword = (appPassword || '').replace(/[\s-]+/g, '').trim();
  let cleanEmail = (email || '').trim();
  if (cleanEmail && !cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@gmail.com`;
  }
  localStorage.setItem(
    IMAP_STORAGE_KEY,
    JSON.stringify({ email: cleanEmail, appPassword: cleanPassword })
  );
}

export function clearImapCredentials() {
  localStorage.removeItem(IMAP_STORAGE_KEY);
}

export async function testImapConnection(email: string, appPassword: string): Promise<boolean> {
  const res = await fetch('/api/imap/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, appPassword }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to connect to Gmail IMAP');
  }
  return true;
}

export async function fetchImapEmails(
  email: string,
  appPassword: string,
  filterTwoDays = true
): Promise<ImapEmail[]> {
  const res = await fetch('/api/imap/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, appPassword, filterTwoDays }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
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
