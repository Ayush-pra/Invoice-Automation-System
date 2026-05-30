import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // AES block size

/**
 * Encrypt plaintext using AES-256-CBC.
 * Returns a string in format: iv:encryptedData (both hex-encoded)
 */
const encrypt = (text) => {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters')
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'utf-8'), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Store iv alongside encrypted data so we can decrypt later
  return `${iv.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an encrypted string (format: iv:encryptedData)
 * Returns the original plaintext
 */
const decrypt = (encryptedText) => {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters')
  }

  const [ivHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'utf-8'), iv)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export { encrypt, decrypt }
