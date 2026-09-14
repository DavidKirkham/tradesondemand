import { isSchemaMismatchError } from "./api-errors";

/** Present in Prisma; Neon may not have them until `npm run db:migrate`. */
export const BOOKING_SMS_OMIT = {
  customerSmsStatus: true,
  customerSmsBody: true,
  customerSmsError: true,
} as const;

export function isMissingBookingSmsColumn(error: unknown): boolean {
  if (!isSchemaMismatchError(error)) return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /customerSms(Status|Body|Error)/i.test(message);
}

/**
 * Retry a Prisma read without Booking SMS columns when production Neon is behind
 * migration 20260913180000_customer_sms. Login /admin does not query Booking;
 * the authenticated overview/jobs pages do, and a missing column 500s the RSC tree.
 */
export async function withOptionalBookingSmsColumns<T>(query: (omitSms: boolean) => Promise<T>): Promise<T> {
  try {
    return await query(false);
  } catch (error) {
    if (!isMissingBookingSmsColumn(error)) throw error;
    return query(true);
  }
}

export function bookingSmsOmit(omitSms: boolean) {
  return omitSms ? { omit: BOOKING_SMS_OMIT } : {};
}
