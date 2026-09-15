import { ImapFlow } from 'imapflow';
const client = new ImapFlow({ host: 'localhost', port: 993, auth: { user: 'u', pass: 'p'} });
console.log(client.usable);
