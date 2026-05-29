import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
const IV_LENGTH = 16; // For AES, this is always 16

class EncryptionService {
  constructor() {
    if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
      console.warn('⚠️ ENCRYPTION_KEY is missing or invalid in .env. It must be a 32-byte hex string (64 characters). Vendor credentials will fail to encrypt.');
    }
  }

  encrypt(text) {
    if (!text) return text;
    if (!ENCRYPTION_KEY) throw new Error('Encryption key is not configured.');

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(text) {
    if (!text) return text;
    if (!ENCRYPTION_KEY) throw new Error('Encryption key is not configured.');

    const textParts = text.split(':');
    if (textParts.length !== 2) throw new Error('Invalid encrypted format.');

    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

export default new EncryptionService();
