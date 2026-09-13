export const DEFAULT_DISPATCH_PHONE = "8165160735";

export function getDispatchPhone(): string {
  const raw =
    process.env.NEXT_PUBLIC_DISPATCH_PHONE ||
    process.env.NEXT_PUBLIC_PHONE ||
    DEFAULT_DISPATCH_PHONE;
  const digits = raw.replace(/\D/g, "");
  return digits || DEFAULT_DISPATCH_PHONE;
}

export function formatPhone(digits: string): string {
  const cleaned = digits.replace(/\D/g, "");
  const national = cleaned.length === 11 && cleaned.startsWith("1") ? cleaned.slice(1) : cleaned;
  if (national.length !== 10) {
    return digits.trim();
  }
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function telHref(digits = getDispatchPhone()): string {
  const cleaned = digits.replace(/\D/g, "");
  return cleaned.startsWith("1") ? `tel:+${cleaned}` : `tel:+1${cleaned}`;
}

export function nationalUsDigits(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  return cleaned.length === 11 && cleaned.startsWith("1") ? cleaned.slice(1) : cleaned;
}

export function toE164Us(value: string): string | null {
  const national = nationalUsDigits(value);
  if (national.length !== 10) return null;
  return `+1${national}`;
}

export function isValidUsPhone(value: string): boolean {
  return nationalUsDigits(value).length === 10;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
