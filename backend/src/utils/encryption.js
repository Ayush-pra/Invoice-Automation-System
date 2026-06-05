import crypto from 'crypto';
import config from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte encryption key from the JWT secret.
 */
function getKey() {
  return crypto.scryptSync(config.jwt.secret, 'salt', 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a combined string: iv:encrypted:authTag (all hex-encoded).
 */
export function encrypt(text) {
  if (!text) return text;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects format: iv:encrypted:authTag (all hex-encoded).
 */
export function decrypt(text) {
  if (!text) return text;

  // If text doesn't look encrypted (no colons), return as-is
  if (!text.includes(':')) return text;

  try {
    const [ivHex, encrypted, authTagHex] = text.split(':');
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // If decryption fails, return original text
    // This handles cases where data isn't encrypted yet
    return text;
  }
}
