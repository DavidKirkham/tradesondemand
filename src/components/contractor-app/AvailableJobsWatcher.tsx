"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type JobPreview = { id: string; publicId: string; trade: string; city: string; zip: string };

export function AvailableJobsWatcher({ initialCount = 0 }: { initialCount?: number }) {
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);
  const [count, setCount] = useState(initialCount);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const response = await fetch("/api/contractor/jobs", { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const payload = (await response.json()) as { available?: JobPreview[] };
      const available = payload.available ?? [];
      setCount(available.length);
      const ids = new Set(available.map((job) => job.id));
      if (!seen.current) {
        seen.current = ids;
        return;
      }
      const fresh = available.filter((job) => !seen.current!.has(job.id));
      seen.current = ids;
      if (fresh.length > 0) {
        router.refresh();
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const job = fresh[0];
          new Notification("New TOD job in your area", {
            body: `${job.trade} · ${job.city} ${job.zip} · ${job.publicId}`,
          });
        }
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [router]);

  async function enable() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const next = await Notification.requestPermission();
    setPermission(next);
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-cream/80">
      {count > 0 ? (
        <span className="rounded-full bg-ember px-2 py-0.5 font-semibold text-white">{count} available</span>
      ) : (
        <span>No new matches</span>
      )}
      {permission === "default" ? (
        <button type="button" onClick={() => void enable()} className="font-semibold text-gold">
          Alert me in this browser
        </button>
      ) : permission === "granted" ? (
        <span>Browser alerts on while the app is open</span>
      ) : permission === "denied" ? (
        <span>Browser alerts blocked</span>
      ) : null}
    </div>
  );
}
