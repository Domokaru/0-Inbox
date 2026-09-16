import { KEYSTORE_BASE64 } from './src/android-code/keystoreBase64.ts';
import * as fs from 'fs';
import { execSync } from 'child_process';

const buffer = Buffer.from(KEYSTORE_BASE64, 'base64');
fs.writeFileSync('temp.keystore', buffer);
try {
  const result = execSync('openssl pkcs12 -in temp.keystore -passin pass:android -nodes -provider default -provider legacy 2>/dev/null | openssl x509 -noout -fingerprint -sha1');
  console.log(result.toString());
} catch (e) {
  try {
     const result2 = execSync('openssl pkcs12 -in temp.keystore -passin pass:android -nodes 2>/dev/null | openssl x509 -noout -fingerprint -sha1');
     console.log(result2.toString());
  } catch(e2) {
     console.log("Error running openssl:", e2.message);
  }
}
fs.unlinkSync('temp.keystore');
