const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Add connection cache below createGmailClient
const cacheBlock = `
// Connection Cache to prevent Gmail from blocking rapid reconnects during swiping
const clientCache = new Map<string, ImapFlow>();

async function getCachedClient(email: string, appPassword: string, verifyOnly = false): Promise<ImapFlow> {
  if (verifyOnly) {
    return createGmailClient(email, appPassword, true);
  }
  const key = \`\${email}:\${appPassword}\`;
  let client = clientCache.get(key);
  
  if (client && client.usable) {
    return client;
  }
  if (client) {
    try { client.close(); } catch (_) {}
    clientCache.delete(key);
  }

  client = createGmailClient(email, appPassword, false);
  client.on('close', () => {
    if (clientCache.get(key) === client) {
      clientCache.delete(key);
    }
  });

  await client.connect();
  clientCache.set(key, client);
  return client;
}
`;

content = content.replace('// 1. Test IMAP Connection', cacheBlock + '\n// 1. Test IMAP Connection');

// 2. Replace fetching logic
content = content.replace(/const client = createGmailClient\(email, appPassword, false\);\s*try {\s*await client\.connect\(\);/g, `let client;
  try {
    client = await getCachedClient(email, appPassword, false);
  } catch (err: any) {
    throw err;
  }
  try {`);

// Also for /api/imap/action and /api/imap/undo, they don't have the "false" argument
content = content.replace(/const client = createGmailClient\(email, appPassword\);\s*try {\s*await client\.connect\(\);/g, `let client;
  try {
    client = await getCachedClient(email, appPassword, false);
  } catch (err: any) {
    throw err;
  }
  try {`);


// 3. Remove `await client.logout()` and `client.close()` from finally blocks in the routes that shouldn't close it
content = content.replace(/finally {\s*try {\s*await client\.logout\(\);\s*} catch \(_\) {\s*try {\s*client\.close\(\);\s*} catch \(_\) {}\s*}\s*}/g, 
`finally {
    // Keep connection alive in cache
  }`);

content = content.replace(/await client\.logout\(\);/g, ''); // just remove all other logouts

fs.writeFileSync('server.ts', content);
