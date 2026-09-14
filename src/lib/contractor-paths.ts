export const CONTRACTOR_SESSION_COOKIE = "tod_contractor";

/** Safe in-app return paths after contractor login. Reject protocol-relative and query strings. */
export function isSafeContractorNextPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/contractor")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\") || value.includes("://")) return false;
  if (value.includes("?") || value.includes("#")) return false;
  if (value.startsWith("/contractor/s/")) return false;
  if (value.startsWith("/contractor/r/")) return false;
  if (value === "/contractor/forgot" || value.startsWith("/contractor/forgot/")) return false;
  return true;
}

export function contractorLoginHref(next?: string | null): string {
  if (isSafeContractorNextPath(next)) {
    return `/contractor?next=${encodeURIComponent(next)}`;
  }
  return "/contractor";
}

export function isPublicContractorPath(pathname: string): boolean {
  if (pathname === "/contractor") return true;
  if (pathname === "/contractor/forgot") return true;
  if (pathname.startsWith("/contractor/s/")) return true;
  if (pathname.startsWith("/contractor/r/")) return true;
  if (pathname === "/contractor/manifest.webmanifest") return true;
  return false;
}

/** Deep link opened from a booked-job push (or SMS). Uses the booking cuid, not publicId. */
export function contractorJobPath(bookingId: string): string {
  const id = bookingId.trim();
  return id ? `/contractor/jobs/${id}` : "/contractor";
}
