import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to create an ImapFlow client for Gmail
function createGmailClient(email: string, appPassword: string, verifyOnly = false) {
  const cleanPassword = (appPassword || '').replace(/[\s-]+/g, '').trim();
  let cleanEmail = (email || '').trim();
  if (cleanEmail && !cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@gmail.com`;
  }

  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    tls: {
      rejectUnauthorized: false,
    },
    auth: {
      user: cleanEmail,
      pass: cleanPassword,
    },
    logger: false,
    verifyOnly,
  });
}

// 1. Test IMAP Connection
app.post('/api/imap/connect', async (req, res) => {
  const { email, appPassword } = req.body;
  if (!email || !appPassword) {
    return res.status(400).json({ success: false, error: 'Email and App Password are required' });
  }

  const client = createGmailClient(email, appPassword, true);
  try {
    await client.connect();
    return res.json({ success: true, email: email.trim() });
  } catch (err: any) {
    console.error('IMAP Connect error:', err);
    let errorMessage = err.message || 'Failed to connect to Gmail IMAP';
    if (
      errorMessage.includes('Invalid credentials') ||
      errorMessage.includes('AUTHENTICATIONFAILED') ||
      errorMessage.includes('Command failed')
    ) {
      errorMessage = 'Invalid credentials. Please verify your Gmail address and 16-character Google App Password.';
    }
    return res.status(401).json({ success: false, error: errorMessage });
  } finally {
    try {
      client.close();
    } catch (_) {}
  }
});

// 2. Fetch Emails from INBOX
app.post('/api/imap/emails', async (req, res) => {
  const { email, appPassword, filterTwoDays } = req.body;
  if (!email || !appPassword) {
    return res.status(400).json({ success: false, error: 'Email and App Password are required' });
  }

  const client = createGmailClient(email, appPassword, false);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const mailboxTotal = client.mailbox ? (client.mailbox.exists || 0) : 0;
      if (mailboxTotal === 0) {
        return res.json({ success: true, emails: [] });
      }

      let fetchRange: string | number[] = '1:*';
      let useUid = false;

      if (filterTwoDays) {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        try {
          const searchResult = await client.search({ since: twoDaysAgo }, { uid: true });
          if (Array.isArray(searchResult) && searchResult.length > 0) {
            fetchRange = searchResult.slice(-40);
            useUid = true;
          } else {
            return res.json({ success: true, emails: [] });
          }
        } catch (_) {
          const startSeq = Math.max(1, mailboxTotal - 39);
          fetchRange = `${startSeq}:${mailboxTotal}`;
          useUid = false;
        }
      } else {
        const startSeq = Math.max(1, mailboxTotal - 39);
        fetchRange = `${startSeq}:${mailboxTotal}`;
        useUid = false;
      }

      const messages: any[] = [];
      for await (const message of client.fetch(
        fetchRange,
        {
          envelope: true,
          flags: true,
          uid: true,
          source: {
            maxLength: 8192,
          },
        },
        { uid: useUid }
      )) {
        let snippet = '';
        if (message.source) {
          try {
            const parsed = await simpleParser(message.source);
            snippet = (parsed.text || parsed.html || '')
              .replace(/<[^>]*>?/gm, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 180);
          } catch (_) {
            snippet = message.envelope?.subject || '';
          }
        }

        const sender =
          message.envelope?.from?.[0]?.name ||
          message.envelope?.from?.[0]?.address ||
          'Unknown Sender';

        messages.push({
          id: `imap-${message.uid}`,
          uid: message.uid,
          sender,
          subject: message.envelope?.subject || '(No Subject)',
          snippet: snippet || message.envelope?.subject || 'No preview available',
          category: 'Primary',
          date: message.envelope?.date || new Date(),
          flags: Array.from(message.flags || []),
          isReal: true,
        });
      }

      messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return res.json({ success: true, emails: messages });
    } finally {
      lock.release();
    }
  } catch (err: any) {
    console.error('IMAP Fetch emails error:', err);
    const isAuthFailed =
      err.authenticationFailed ||
      err.serverResponseCode === 'AUTHENTICATIONFAILED' ||
      (err.message && (err.message.includes('AUTHENTICATIONFAILED') || err.message.includes('Invalid credentials') || err.message.includes('Command failed')));
    
    const statusCode = isAuthFailed ? 401 : 500;
    const errorMessage = isAuthFailed
      ? 'Gmail authentication failed. Your 16-character Google App Password may be incorrect, expired, or revoked. Please verify your App Password.'
      : (err.message || 'Failed to fetch emails');

    return res.status(statusCode).json({
      success: false,
      authenticationFailed: !!isAuthFailed,
      error: errorMessage,
    });
  } finally {
    try {
      await client.logout();
    } catch (_) {
      try {
        client.close();
      } catch (_) {}
    }
  }
});

// 3. Perform Triage Action (Archive / Trash / Mark Read / Star)
app.post('/api/imap/action', async (req, res) => {
  const { email, appPassword, uid, action } = req.body;
  if (!email || !appPassword || !uid || !action) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  const client = createGmailClient(email, appPassword);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    const uidStr = uid.toString();

    if (action === 'archive') {
      // In Gmail IMAP, deleting from INBOX removes the Inbox label (keeps it in All Mail)
      try {
        await client.messageMove(uidStr, '[Gmail]/All Mail', { uid: true });
      } catch (_) {
        await client.messageDelete(uidStr, { uid: true });
      }
    } else if (action === 'trash') {
      try {
        await client.messageMove(uidStr, '[Gmail]/Trash', { uid: true });
      } catch (_) {
        try {
          await client.messageMove(uidStr, '[Gmail]/Bin', { uid: true });
        } catch (_) {
          await client.messageFlagsAdd(uidStr, ['\\Deleted'], { uid: true });
        }
      }
    } else if (action === 'read') {
      await client.messageFlagsAdd(uidStr, ['\\Seen'], { uid: true });
    } else if (action === 'unread') {
      await client.messageFlagsRemove(uidStr, ['\\Seen'], { uid: true });
    } else if (action === 'star') {
      await client.messageFlagsAdd(uidStr, ['\\Flagged'], { uid: true });
    } else if (action === 'unstar') {
      await client.messageFlagsRemove(uidStr, ['\\Flagged'], { uid: true });
    }

    lock.release();
    await client.logout();
    return res.json({ success: true });
  } catch (err: any) {
    console.error(`IMAP Action (${action}) error:`, err);
    return res.status(500).json({ success: false, error: err.message || `Failed to perform ${action}` });
  } finally {
    try {
      await client.logout();
    } catch (_) {
      try {
        client.close();
      } catch (_) {}
    }
  }
});

// 4. Undo Triage Action
app.post('/api/imap/undo', async (req, res) => {
  const { email, appPassword, uid, previousAction } = req.body;
  if (!email || !appPassword || !uid) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  const client = createGmailClient(email, appPassword);
  try {
    await client.connect();

    const uidStr = uid.toString();
    if (previousAction === 'trash') {
      try {
        const lock = await client.getMailboxLock('[Gmail]/Trash');
        await client.messageMove(uidStr, 'INBOX', { uid: true });
        lock.release();
      } catch (_) {
        const lock = await client.getMailboxLock('[Gmail]/Bin');
        await client.messageMove(uidStr, 'INBOX', { uid: true });
        lock.release();
      }
    } else if (previousAction === 'archive') {
      const lock = await client.getMailboxLock('[Gmail]/All Mail');
      await client.messageMove(uidStr, 'INBOX', { uid: true });
      lock.release();
    }

    await client.logout();
    return res.json({ success: true });
  } catch (err: any) {
    console.error('IMAP Undo error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to undo action' });
  } finally {
    try {
      await client.logout();
    } catch (_) {
      try {
        client.close();
      } catch (_) {}
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '0 Inbox IMAP Server' });
});

// Vite middleware for development & static serving for production
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
