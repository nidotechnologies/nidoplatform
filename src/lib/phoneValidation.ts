/**
 * Phone input rules used throughout the platform.
 * Phone country codes are selected separately where applicable, so the stored
 * local number is always exactly the ten numeric digits entered by the user.
 */
export function sanitizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Keep compatibility with existing values entered as +91XXXXXXXXXX.
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
  return digits.slice(0, 10);
}

export function isValidPhoneNumber(value: string): boolean {
  return /^\d{10}$/.test(value);
}