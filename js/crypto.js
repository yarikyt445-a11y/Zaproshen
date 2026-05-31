/* ═══════════════════════════════════════════════════════
   Crypto — AES-GCM encryption via Web Crypto API
   ═══════════════════════════════════════════════════════ */

(function () {
  const SALT = 'zaproshennya-salt-2024';

  async function deriveKey(uid) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(uid + SALT), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(data, uid) {
    try {
      const key = await deriveKey(uid);
      const enc = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(JSON.stringify(data))
      );
      return {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
      };
    } catch (e) {
      console.warn('Encrypt error:', e);
      return null;
    }
  }

  async function decrypt(encryptedObj, uid) {
    try {
      const key = await deriveKey(uid);
      const iv = new Uint8Array(encryptedObj.iv);
      const data = new Uint8Array(encryptedObj.data);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.warn('Decrypt error:', e);
      return null;
    }
  }

  ZAP.crypto = { encrypt, decrypt };
})();
