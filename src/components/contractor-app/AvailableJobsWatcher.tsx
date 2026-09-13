"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ContractorPushToggle } from "@/components/contractor-app/ContractorPushToggle";

type JobPreview = { id: string; publicId: string; trade: string; city: string; zip: string };

export function AvailableJobsWatcher({ initialCount = 0 }: { initialCount?: number }) {
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);
  const [polledCount, setPolledCount] = useState<number | null>(null);
  const count = polledCount ?? initialCount;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const response = await fetch("/api/contractor/jobs", { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const payload = (await response.json()) as { available?: JobPreview[] };
      const available = payload.available ?? [];
      setPolledCount(available.length);
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

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-cream/80">
      {count > 0 ? (
        <span className="rounded-full bg-ember px-2 py-0.5 font-semibold text-white">{count} available</span>
      ) : (
        <span>No new matches</span>
      )}
      <ContractorPushToggle />
    </div>
  );
}
