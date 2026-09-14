import type Stripe from "stripe";
import { prisma } from "./prisma";
import { appOriginFromRequest, getStripe, logStripeMissingKeys } from "./stripe";
import {
  contractorConnectStatusLabel,
  createPayoutPublicId,
  invoiceIsPayableForPayout,
  isMissingContractorPayoutModel,
  remainingShopPayoutCents,
  shopEarningsCents,
  transferEligibility,
  transferEligibilityMessage,
  transferIdempotencyKey,
} from "./contractor-payouts";

const V2_ACCOUNT_INCLUDE = [
  "configuration.recipient",
  "defaults",
  "identity",
  "requirements",
] as const;

export const CONTRACTOR_CONNECT_COPY =
  "Customers pay Trades on Demand. This page shows your shop earnings (invoice subtotal) after the customer pays TOD — not the 20% markup. Finish Stripe Express onboarding so TOD can transfer that shop amount to your Connect balance.";

export function connectOnboardingUrls(origin: string): { refresh_url: string; return_url: string } {
  return {
    refresh_url: `${origin}/contractor/payments?connect=refresh`,
    return_url: `${origin}/contractor/payments?connect=return`,
  };
}

/**
 * Maps Stripe connected-account state onto TOD flags.
 * v2 recipient: transfers are enabled when stripe_transfers is active.
 * v1 fallback: capabilities.transfers / payouts_enabled / details_submitted.
 */
export function connectFlagsFromAccount(account: unknown): { onboarded: boolean; payoutsEnabled: boolean } {
  const rec = (account ?? {}) as {
    details_submitted?: boolean | null;
    payouts_enabled?: boolean | null;
    capabilities?: { transfers?: string | null } | null;
    configuration?: {
      recipient?: {
        capabilities?: {
          stripe_balance?: {
            stripe_transfers?: { status?: string } | null;
            payouts?: { status?: string } | null;
          } | null;
        } | null;
      } | null;
    } | null;
    requirements?: { entries?: unknown[] | null } | null;
  };
  const transfersV2 = rec.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const payoutsV2 = rec.configuration?.recipient?.capabilities?.stripe_balance?.payouts?.status;
  const transfersV1 = rec.capabilities?.transfers;
  const payoutsEnabled =
    transfersV2 === "active" || transfersV1 === "active" || payoutsV2 === "active" || Boolean(rec.payouts_enabled);
  const requirementEntries = rec.requirements?.entries;
  const onboarded =
    Boolean(rec.details_submitted) ||
    transfersV2 === "active" ||
    transfersV1 === "active" ||
    (Array.isArray(requirementEntries) && requirementEntries.length === 0 && Boolean(rec.configuration?.recipient));
  return { onboarded: onboarded || payoutsEnabled, payoutsEnabled };
}

export async function retrieveConnectAccount(accountId: string) {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    return await stripe.v2.core.accounts.retrieve(accountId, {
      include: [...V2_ACCOUNT_INCLUDE],
    });
  } catch {
    try {
      return await stripe.accounts.retrieve(accountId);
    } catch {
      return null;
    }
  }
}

export async function syncContractorConnectFlags(contractorId: string, accountId: string) {
  const account = await retrieveConnectAccount(accountId);
  if (!account) return null;
  const flags = connectFlagsFromAccount(account);
  try {
    return await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        stripeConnectAccountId: account.id,
        stripeConnectOnboarded: flags.onboarded,
        stripeConnectPayoutsEnabled: flags.payoutsEnabled,
      },
    });
  } catch (error) {
    if (!isMissingContractorPayoutModel(error)) throw error;
    return null;
  }
}

async function createExpressRecipientAccount(input: {
  contractorId: string;
  businessName: string;
  email: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  try {
    const account = await stripe.v2.core.accounts.create({
      display_name: input.businessName,
      contact_email: input.email,
      dashboard: "express",
      identity: { country: "US" },
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      metadata: { contractorId: input.contractorId },
      include: [...V2_ACCOUNT_INCLUDE],
    });
    return account.id;
  } catch (error) {
    console.warn("[stripe] v2 account create failed; falling back to v1 controller Express", error);
    const account = await stripe.accounts.create({
      controller: {
        stripe_dashboard: { type: "express" },
        fees: { payer: "application" },
        losses: { payments: "application" },
      },
      capabilities: {
        transfers: { requested: true },
      },
      country: "US",
      email: input.email,
      business_profile: { name: input.businessName },
      metadata: { contractorId: input.contractorId },
    });
    return account.id;
  }
}

async function createAccountLinkUrl(accountId: string, origin: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");
  const urls = connectOnboardingUrls(origin);

  try {
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: urls.refresh_url,
          return_url: urls.return_url,
        },
      },
    });
    if (!link.url) throw new Error("Stripe did not return an Account Link URL.");
    return link.url;
  } catch (error) {
    console.warn("[stripe] v2 account link failed; falling back to v1 Account Links", error);
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: urls.refresh_url,
      return_url: urls.return_url,
      type: "account_onboarding",
    });
    return link.url;
  }
}

export async function createAccountLinkForRefresh(
  contractor: { stripeConnectAccountId: string | null },
  origin: string,
): Promise<string | null> {
  if (!contractor.stripeConnectAccountId || !origin) return null;
  try {
    return await createAccountLinkUrl(contractor.stripeConnectAccountId, origin);
  } catch (error) {
    console.error("[stripe] Connect refresh Account Link failed", error);
    return null;
  }
}

export async function startContractorConnectOnboarding(input: {
  request: Request;
  contractor: {
    id: string;
    businessName: string;
    email: string;
    stripeConnectAccountId: string | null;
  };
}): Promise<{ url: string } | { error: string; status: number }> {
  const stripe = getStripe();
  if (!stripe) {
    logStripeMissingKeys("startContractorConnectOnboarding");
    return { error: "Stripe payouts are not configured yet. TOD will still pay your shop separately.", status: 503 };
  }

  const origin = appOriginFromRequest(input.request);
  let accountId = input.contractor.stripeConnectAccountId;
  try {
    if (!accountId) {
      accountId = await createExpressRecipientAccount({
        contractorId: input.contractor.id,
        businessName: input.contractor.businessName,
        email: input.contractor.email,
      });
      await prisma.contractor.update({
        where: { id: input.contractor.id },
        data: { stripeConnectAccountId: accountId },
      });
    }
    const url = await createAccountLinkUrl(accountId, origin);
    return { url };
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) {
      return { error: "Payout tables are not migrated yet. Ask dispatch to run npm run db:migrate.", status: 500 };
    }
    const message = error instanceof Error ? error.message : "Could not start Stripe onboarding.";
    console.error("[stripe] Connect onboarding failed", error);
    return { error: message, status: 502 };
  }
}

export async function createContractorExpressLoginLink(
  accountId: string,
): Promise<{ url: string } | { error: string; status: number }> {
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Stripe payouts are not configured yet.", status: 503 };
  }
  try {
    const link = await stripe.accounts.createLoginLink(accountId);
    return { url: link.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open the Express dashboard.";
    return { error: message, status: 502 };
  }
}

export async function refreshContractorConnectFromStripe(contractorId: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectOnboarded: true,
      stripeConnectPayoutsEnabled: true,
    },
  });
  if (!contractor?.stripeConnectAccountId) return contractor;
  return syncContractorConnectFlags(contractor.id, contractor.stripeConnectAccountId);
}

export async function ensureContractorPayoutForPaidInvoice(invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        booking: { select: { id: true, contractorId: true } },
        payout: true,
      },
    });
    if (!invoice) return null;
    if (!invoiceIsPayableForPayout(invoice)) return invoice.payout;
    if (invoice.payout) return invoice.payout;

    const contractorId = invoice.contractorId ?? invoice.booking.contractorId;
    if (!contractorId) return null;

    const remaining = remainingShopPayoutCents({
      shopSubtotalCents: shopEarningsCents(invoice),
      existingPayouts: [],
    });
    if (remaining <= 0) return null;

    return await prisma.contractorPayout.create({
      data: {
        publicId: createPayoutPublicId(),
        contractorId,
        bookingId: invoice.bookingId,
        invoiceId: invoice.id,
        shopAmountCents: remaining,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) return null;
    throw error;
  }
}

export async function ensureContractorPayoutsForPayment(paymentId: string) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { paymentId, status: "PAID" },
      select: { id: true },
    });
    for (const invoice of invoices) {
      await ensureContractorPayoutForPaidInvoice(invoice.id);
    }
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) return;
    throw error;
  }
}

export async function applyConnectAccountUpdated(account: { id?: string | null }) {
  const accountId = account.id?.trim();
  if (!accountId) return null;
  try {
    const contractor = await prisma.contractor.findUnique({
      where: { stripeConnectAccountId: accountId },
      select: { id: true },
    });
    if (!contractor) return null;
    return syncContractorConnectFlags(contractor.id, accountId);
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) return null;
    throw error;
  }
}

export async function applyTransferUpdated(transfer: Stripe.Transfer) {
  const payoutId = transfer.metadata?.contractorPayoutId;
  try {
    const existing = payoutId
      ? await prisma.contractorPayout.findUnique({ where: { id: payoutId } })
      : await prisma.contractorPayout.findUnique({ where: { stripeTransferId: transfer.id } });
    if (!existing) return null;

    const reversed = Boolean(transfer.reversed);
    const status = reversed ? "FAILED" : "PAID";
    return await prisma.contractorPayout.update({
      where: { id: existing.id },
      data: {
        status,
        stripeTransferId: transfer.id,
        failureMessage: reversed ? "Transfer was reversed." : null,
        transferredAt: reversed ? null : (existing.transferredAt ?? new Date()),
      },
    });
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) return null;
    throw error;
  }
}

export async function applyTransferFailed(transfer: Stripe.Transfer, message?: string) {
  const payoutId = transfer.metadata?.contractorPayoutId;
  try {
    const existing = payoutId
      ? await prisma.contractorPayout.findUnique({ where: { id: payoutId } })
      : await prisma.contractorPayout.findUnique({ where: { stripeTransferId: transfer.id } });
    if (!existing) return null;
    return await prisma.contractorPayout.update({
      where: { id: existing.id },
      data: {
        status: "FAILED",
        stripeTransferId: transfer.id,
        failureMessage: message?.trim() || "Stripe could not complete this transfer.",
      },
    });
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) return null;
    throw error;
  }
}

export type ExecutePayoutTransferResult =
  | { ok: true; payout: { id: string; status: string; stripeTransferId: string | null; shopAmountCents: number } }
  | { ok: false; status: number; error: string };

export async function executePayoutTransfer(payoutId: string): Promise<ExecutePayoutTransferResult> {
  const stripe = getStripe();
  if (!stripe) {
    logStripeMissingKeys("executePayoutTransfer");
    return { ok: false, status: 503, error: "Stripe is not configured. Set STRIPE_SECRET_KEY." };
  }

  let payout;
  try {
    payout = await prisma.contractorPayout.findUnique({
      where: { id: payoutId },
      include: {
        contractor: {
          select: {
            id: true,
            businessName: true,
            stripeConnectAccountId: true,
            stripeConnectPayoutsEnabled: true,
          },
        },
        invoice: { select: { id: true, status: true, publicId: true, subtotalCents: true } },
        booking: { select: { id: true, publicId: true } },
      },
    });
  } catch (error) {
    if (isMissingContractorPayoutModel(error)) {
      return { ok: false, status: 500, error: "Payout tables are not migrated yet. Run npm run db:migrate." };
    }
    throw error;
  }

  if (!payout) return { ok: false, status: 404, error: "Payout not found." };
  if (payout.status === "PAID" && payout.stripeTransferId) {
    return {
      ok: true,
      payout: {
        id: payout.id,
        status: payout.status,
        stripeTransferId: payout.stripeTransferId,
        shopAmountCents: payout.shopAmountCents,
      },
    };
  }

  if (payout.contractor?.stripeConnectAccountId) {
    await syncContractorConnectFlags(payout.contractor.id, payout.contractor.stripeConnectAccountId);
    const latest = await prisma.contractor.findUnique({
      where: { id: payout.contractor.id },
      select: { stripeConnectAccountId: true, stripeConnectPayoutsEnabled: true },
    });
    if (latest) {
      payout.contractor.stripeConnectAccountId = latest.stripeConnectAccountId;
      payout.contractor.stripeConnectPayoutsEnabled = latest.stripeConnectPayoutsEnabled;
    }
  }

  const eligibility = transferEligibility({
    payoutStatus: payout.status,
    shopAmountCents: payout.shopAmountCents,
    invoiceStatus: payout.invoice.status,
    contractorId: payout.contractorId,
    stripeConnectAccountId: payout.contractor?.stripeConnectAccountId ?? null,
    stripeConnectPayoutsEnabled: payout.contractor?.stripeConnectPayoutsEnabled ?? false,
  });
  if (!eligibility.ok) {
    return { ok: false, status: 409, error: transferEligibilityMessage(eligibility.code) };
  }

  const destination = payout.contractor?.stripeConnectAccountId;
  if (!destination) {
    return { ok: false, status: 409, error: transferEligibilityMessage("needs_onboarding") };
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: payout.shopAmountCents,
        currency: "usd",
        destination,
        transfer_group: payout.booking.publicId,
        description: `TOD shop payout ${payout.publicId} · ${payout.booking.publicId} · ${payout.invoice.publicId}`,
        metadata: {
          contractorPayoutId: payout.id,
          invoiceId: payout.invoiceId,
          bookingId: payout.bookingId,
          shopAmountCents: String(payout.shopAmountCents),
        },
      },
      { idempotencyKey: transferIdempotencyKey(payout) },
    );

    const updated = await prisma.contractorPayout.update({
      where: { id: payout.id },
      data: {
        status: "PAID",
        stripeTransferId: transfer.id,
        failureMessage: null,
        transferredAt: new Date(),
      },
    });
    return {
      ok: true,
      payout: {
        id: updated.id,
        status: updated.status,
        stripeTransferId: updated.stripeTransferId,
        shopAmountCents: updated.shopAmountCents,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe transfer failed.";
    try {
      await prisma.contractorPayout.update({
        where: { id: payout.id },
        data: { status: "FAILED", failureMessage: message },
      });
    } catch (persistError) {
      if (!isMissingContractorPayoutModel(persistError)) throw persistError;
    }
    return { ok: false, status: 502, error: message };
  }
}

export function connectStatusForContractor(contractor: {
  stripeConnectAccountId: string | null;
  stripeConnectOnboarded: boolean;
  stripeConnectPayoutsEnabled: boolean;
}) {
  const status = contractorConnectStatusLabel(contractor);
  return {
    status,
    accountId: contractor.stripeConnectAccountId,
    onboarded: contractor.stripeConnectOnboarded,
    payoutsEnabled: contractor.stripeConnectPayoutsEnabled,
  };
}
