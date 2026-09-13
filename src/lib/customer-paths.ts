export const CUSTOMER_SESSION_COOKIE = "tod_customer_session";
export const CUSTOMER_SETUP_COOKIE = "tod_customer_setup";
export const CUSTOMER_LEGACY_COOKIE = "tod_customer";

const PUBLIC_ACCOUNT_SEGMENTS = new Set(["login", "forgot", "reset", "s"]);

/** Safe in-app return paths after customer login. Reject protocol-relative and query strings. */
export function isSafeAccountNextPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/account")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\") || value.includes("://")) return false;
  if (value.includes("?") || value.includes("#")) return false;
  if (value.startsWith("/account/s/")) return false;
  if (value === "/account/login" || value === "/account/forgot" || value === "/account/reset") return false;
  return true;
}

export function customerLoginHref(next?: string | null): string {
  if (isSafeAccountNextPath(next)) {
    return `/account/login?next=${encodeURIComponent(next)}`;
  }
  return "/account/login";
}

export function isPublicAccountPath(pathname: string): boolean {
  if (pathname === "/account/login") return true;
  if (pathname === "/account/forgot") return true;
  if (pathname === "/account/reset") return true;
  if (pathname.startsWith("/account/s/")) return true;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "account" && !PUBLIC_ACCOUNT_SEGMENTS.has(parts[1])) {
    // Legacy magic link: /account/<customer.token>
    if (parts[1] === "jobs" || parts[1] === "profile") return false;
    return true;
  }
  return false;
}
