import { randomBytes } from "node:crypto";
import { isValidEmail, isValidUsPhone } from "./phone";

export function createCustomerToken(): string {
  return randomBytes(18).toString("base64url");
}

export function createPaymentPublicId(): string {
  return `PAY-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export const PREFERRED_CONTACT = ["PHONE", "EMAIL"] as const;
export type PreferredContact = (typeof PREFERRED_CONTACT)[number];

export function isPreferredContact(value: string): value is PreferredContact {
  return (PREFERRED_CONTACT as readonly string[]).includes(value);
}

export function validateCustomerPatch(input: {
  name?: string;
  phone?: string;
  preferredContact?: string;
}): { ok: true; name?: string; phone?: string; preferredContact?: PreferredContact } | { ok: false; message: string } {
  const result: { name?: string; phone?: string; preferredContact?: PreferredContact } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) return { ok: false, message: "Enter a name we can put on the ticket." };
    result.name = name;
  }
  if (input.phone !== undefined) {
    if (!isValidUsPhone(input.phone)) return { ok: false, message: "Enter a 10-digit U.S. phone number." };
    result.phone = input.phone.replace(/\D/g, "").slice(-10);
  }
  if (input.preferredContact !== undefined) {
    if (!isPreferredContact(input.preferredContact)) {
      return { ok: false, message: "Preferred contact is phone or email." };
    }
    result.preferredContact = input.preferredContact;
  }
  return { ok: true, ...result };
}

export function validateAccountLookup(email: string, phone: string): { ok: true; email: string; phone: string } | { ok: false; message: string } {
  if (!isValidEmail(email)) return { ok: false, message: "Enter the email you booked with." };
  if (!isValidUsPhone(phone)) return { ok: false, message: "Enter the phone on the booking." };
  return { ok: true, email: email.trim().toLowerCase(), phone: phone.replace(/\D/g, "").slice(-10) };
}
