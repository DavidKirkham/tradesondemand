"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { parseResponseJson } from "@/lib/http";

type PushConfig = {
  configured?: boolean;
  publicKey?: string;
  subscriptionCount?: number;
  migrateRequired?: boolean;
  error?: string;
};

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function pushPermissionSnapshot(): NotificationPermission | "unsupported" {
  if (!("Notification" in window) || !("PushManager" in window)) return "unsupported";
  return Notification.permission;
}

export function ContractorPushToggle({ variant = "compact" }: { variant?: "compact" | "card" }) {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const browserPermission = useSyncExternalStore(
    () => () => undefined,
    pushPermissionSnapshot,
    () => "default" as const,
  );
  const [permissionOverride, setPermissionOverride] = useState<
    NotificationPermission | "unsupported" | null
  >(null);
  const permission = permissionOverride ?? browserPermission;
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/contractor/push", { cache: "no-store" });
      const payload = await parseResponseJson<PushConfig>(response);
      if (cancelled || !response.ok) return;
      setConfig(payload);
      const local = await currentPushSubscription();
      if (cancelled) return;
      setSubscribed(Boolean(local));
      if (payload.configured && payload.publicKey && Notification.permission === "granted" && !local) {
        try {
          await subscribeAndStore(payload.publicKey);
          if (!cancelled) setSubscribed(true);
        } catch {
          /* user can tap Enable */
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      if (!("Notification" in window) || !("PushManager" in window)) {
        setPermissionOverride("unsupported");
        return;
      }
      const next = await Notification.requestPermission();
      setPermissionOverride(next);
      if (next !== "granted") {
        setMessage("Notifications are blocked in this browser. Enable them in Settings, then try again.");
        return;
      }
      if (!config?.configured || !config.publicKey) {
        setMessage("In-browser alerts are on. Dispatch still needs VAPID keys for push when the app is closed.");
        return;
      }
      await subscribeAndStore(config.publicKey);
      setSubscribed(true);
      setMessage("");
    } catch {
      setMessage("Could not enable push on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const local = await currentPushSubscription();
      if (local) {
        await fetch("/api/contractor/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: local.endpoint }),
        });
        await local.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setMessage("Could not turn push off.");
    } finally {
      setBusy(false);
    }
  }

  const status =
    permission === "unsupported"
      ? "This browser cannot receive Web Push."
      : subscribed
        ? "Push on — booked jobs reach this phone even when the app is closed."
        : permission === "denied"
          ? "Browser alerts blocked."
          : config?.configured
            ? "Enable push to hear about assigned jobs when the app is closed."
            : "Browser alerts work while the app is open. Closed-app push needs VAPID keys on the server.";

  if (variant === "card") {
    return (
      <section className="rounded-2xl border border-line bg-paper p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Job push alerts</h2>
        <p className="mt-1 text-sm text-navy">{status}</p>
        <p className="mt-2 text-xs text-muted">
          iPhone: add this PWA to the Home Screen first. Opening a notification lands on that job.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!subscribed ? (
            <button
              type="button"
              disabled={busy || permission === "unsupported"}
              onClick={() => void enable()}
              className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
            >
              {busy ? "Saving…" : "Enable job push"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void disable()}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy disabled:opacity-60"
            >
              {busy ? "Saving…" : "Turn push off"}
            </button>
          )}
        </div>
        {message ? <p className="mt-2 text-xs text-ember">{message}</p> : null}
      </section>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-cream/80">
      {permission === "default" || (!subscribed && permission === "granted" && config?.configured) ? (
        <button type="button" onClick={() => void enable()} disabled={busy} className="font-semibold text-gold">
          {busy ? "…" : "Enable job push"}
        </button>
      ) : (
        <span>{subscribed ? "Job push on" : status}</span>
      )}
    </div>
  );
}

async function subscribeAndStore(publicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = subscription.toJSON();
  const response = await fetch("/api/contractor/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  });
  if (!response.ok) {
    const payload = await parseResponseJson<{ error?: string }>(response);
    throw new Error(payload.error || "Could not save push subscription.");
  }
}
