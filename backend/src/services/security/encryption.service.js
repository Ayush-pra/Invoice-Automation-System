import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const RAW_KEY = process.env.ENCRYPTION_KEY || 'default-fallback-key-do-not-use-in-prod';
// Hash the raw key to ensure it is ALWAYS exactly 32 bytes (256 bits), regardless of user input length/format
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_KEY).digest(); 
const IV_LENGTH = 16; // For AES, this is always 16

class EncryptionService {
  constructor() {
    if (!process.env.ENCRYPTION_KEY) {
      console.warn('⚠️ ENCRYPTION_KEY is missing in .env. Using fallback key. Vendor credentials are not secure.');
    }
  }

  encrypt(text) {
    if (!text) return text;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(text) {
    if (!text) return text;

    const textParts = text.split(':');
    if (textParts.length !== 2) throw new Error('Invalid encrypted format.');

    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

export default new EncryptionService();
