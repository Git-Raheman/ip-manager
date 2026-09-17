import bcrypt from 'bcryptjs';
import { User } from '../src/types.js';

const SALT_ROUNDS = 10;

/**
 * Securely hashes a plaintext password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a password against a stored bcrypt hash or legacy plaintext string.
 * Detects if the stored value is legacy plaintext and signals if it needs upgrading.
 */
export async function verifyPassword(
  password: string,
  storedValue?: string
): Promise<{ isValid: boolean; needsUpgrade: boolean }> {
  if (!storedValue || !password) {
    return { isValid: false, needsUpgrade: false };
  }

  // Check if the stored string is a bcrypt hash ($2a$, $2b$, or $2y$)
  const isBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(storedValue);

  if (isBcryptHash) {
    try {
      const isValid = await bcrypt.compare(password, storedValue);
      return { isValid, needsUpgrade: false };
    } catch {
      return { isValid: false, needsUpgrade: false };
    }
  }

  // Legacy plaintext fallback
  if (password === storedValue) {
    return { isValid: true, needsUpgrade: true };
  }

  return { isValid: false, needsUpgrade: false };
}

/**
 * Removes sensitive authentication attributes before transmitting user records to clients.
 */
export function sanitizeUser(user: User): User {
  const sanitized = { ...user };
  delete sanitized.localPassword;
  return sanitized;
}

/**
 * Sanitizes an array of users.
 */
export function sanitizeUsers(users: User[]): User[] {
  return users.map(sanitizeUser);
}
