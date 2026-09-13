import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createContractorLoginToken } from "./contractor";
import { CONTRACTOR_SESSION_COOKIE, contractorLoginHref } from "./contractor-paths";
import { prisma } from "./prisma";

const COOKIE = CONTRACTOR_SESSION_COOKIE;
const SETUP_COOKIE = "tod_contractor_setup";

export function contractorCookieOptions(sessionToken: string) {
  return {
    name: COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  };
}

export function contractorSetupCookieOptions(loginToken: string) {
  return {
    name: SETUP_COOKIE,
    value: loginToken,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
  };
}

export function clearContractorCookieOptions() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export function clearContractorSetupCookieOptions() {
  return {
    name: SETUP_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export async function getApprovedContractorFromCookie() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const contractor = await prisma.contractor.findUnique({ where: { sessionToken: token } });
  if (!contractor || contractor.status !== "APPROVED" || !contractor.passwordHash) return null;
  return contractor;
}

export async function getContractorFromSetupCookie() {
  const jar = await cookies();
  const token = jar.get(SETUP_COOKIE)?.value;
  if (!token) return null;
  const contractor = await prisma.contractor.findUnique({ where: { loginToken: token } });
  if (!contractor || contractor.status !== "APPROVED" || contractor.passwordHash) return null;
  return contractor;
}

export async function requireApprovedContractor(nextPath?: string) {
  const contractor = await getApprovedContractorFromCookie();
  if (!contractor) {
    redirect(contractorLoginHref(nextPath));
  }
  return contractor;
}

export async function issueContractorSession(
  contractorId: string,
  extra?: { passwordHash?: string | null },
) {
  const sessionToken = createContractorLoginToken();
  await prisma.contractor.update({
    where: { id: contractorId },
    data: { sessionToken, ...extra },
  });
  return sessionToken;
}

export async function resetContractorPasswordAccess(contractorId: string) {
  const loginToken = createContractorLoginToken();
  await prisma.contractor.update({
    where: { id: contractorId },
    data: {
      passwordHash: null,
      sessionToken: null,
      loginToken,
    },
  });
  return { loginToken, invitePath: `/contractor/s/${loginToken}` };
}
