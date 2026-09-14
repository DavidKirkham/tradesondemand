import {
  buildContractorBookedPush,
  buildContractorBookedSms,
  contractorAppOrigin,
  isMissingPushSubscriptionTable,
  shouldSendBookedSmsFallback,
  type ContractorBookedJob,
  type NotifyBookedResult,
  type StoredPushSubscription,
} from "./contractor-push";
import { sendWebPushToSubscription, type WebPushSendResult } from "./contractor-push-send";
import { prisma } from "./prisma";
import { sendCustomerSms, type SmsResult } from "./sms";

export type NotifyContractorBookedInput = {
  contractorId: string;
  contractorPhone?: string | null;
  job: ContractorBookedJob;
  origin?: string;
};

export type NotifyContractorBookedDeps = {
  listSubscriptions: (contractorId: string) => Promise<StoredPushSubscription[]>;
  sendPush: (subscription: StoredPushSubscription, payload: unknown) => Promise<WebPushSendResult>;
  deleteSubscription: (id: string) => Promise<void>;
  sendSms: (to: string, body: string) => Promise<SmsResult>;
};

export async function notifyContractorBooked(
  input: NotifyContractorBookedInput,
  deps: NotifyContractorBookedDeps = defaultNotifyDeps(),
): Promise<NotifyBookedResult> {
  const payload = buildContractorBookedPush(input.job);
  let subscriptions: StoredPushSubscription[] = [];
  try {
    subscriptions = await deps.listSubscriptions(input.contractorId);
  } catch (error) {
    if (!isMissingPushSubscriptionTable(error)) {
      console.warn("[contractor-push] could not load subscriptions", error);
    }
  }

  let pushSent = 0;
  for (const subscription of subscriptions) {
    const result = await deps.sendPush(subscription, payload);
    if (result.ok) {
      pushSent += 1;
      continue;
    }
    if (result.gone) {
      try {
        await deps.deleteSubscription(subscription.id);
      } catch (error) {
        console.warn("[contractor-push] could not drop stale subscription", error);
      }
    }
  }

  if (!shouldSendBookedSmsFallback({ pushDelivered: pushSent })) {
    return { channel: "push", pushSent };
  }

  const phone = input.contractorPhone?.trim();
  if (!phone) {
    return {
      channel: "none",
      pushSent,
      error: subscriptions.length ? "Push failed and no shop phone is on file." : "No push subscription or shop phone.",
    };
  }

  const sms = await deps.sendSms(
    phone,
    buildContractorBookedSms(input.job, input.origin || contractorAppOrigin()),
  );
  return {
    channel: sms.status === "SENT" ? "sms" : "none",
    pushSent,
    smsStatus: sms.status,
    error: sms.status === "SENT" ? undefined : sms.error,
  };
}

/** Assign / booking must not fail if notify throws. */
export async function notifyContractorBookedSafe(
  input: NotifyContractorBookedInput,
): Promise<NotifyBookedResult> {
  try {
    return await notifyContractorBooked(input);
  } catch (error) {
    console.warn("[contractor-push] notify failed", error);
    return { channel: "none", pushSent: 0, error: "Notify failed." };
  }
}

function defaultNotifyDeps(): NotifyContractorBookedDeps {
  return {
    async listSubscriptions(contractorId) {
      try {
        return await prisma.contractorPushSubscription.findMany({
          where: { contractorId },
          select: { id: true, endpoint: true, p256dh: true, auth: true, userAgent: true },
        });
      } catch (error) {
        if (isMissingPushSubscriptionTable(error)) return [];
        throw error;
      }
    },
    sendPush: (subscription, payload) => sendWebPushToSubscription(subscription, payload),
    async deleteSubscription(id) {
      try {
        await prisma.contractorPushSubscription.delete({ where: { id } });
      } catch (error) {
        if (isMissingPushSubscriptionTable(error)) return;
        throw error;
      }
    },
    sendSms: sendCustomerSms,
  };
}
