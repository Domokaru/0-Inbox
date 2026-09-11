import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
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
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const provider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is logged in to Firebase, but access token needs refreshed or sign-in popup
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No access token returned from Google Sign-In');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
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
  cachedAccessToken = null;
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
  const queryParts = ['(category:primary OR category:promotions OR category:social OR category:updates)'];
  if (filterTwoDays) {
    queryParts.push('newer_than:2d');
  }
  const query = encodeURIComponent(queryParts.join(' '));
  
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`;
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
  const emails = resolved.filter((e): e is WebEmail => e !== null);

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
