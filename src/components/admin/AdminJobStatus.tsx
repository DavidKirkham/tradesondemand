"use client";

import { useRouter } from "next/navigation";
import { BOOKING_STATUSES, statusLabel } from "@/lib/booking";

export function AdminJobStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function update(next: string) {
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) router.refresh();
  }

  return (
    <select
      defaultValue={status}
      key={`${id}-${status}`}
      onChange={(event) => update(event.target.value)}
      className="h-10 rounded-lg border border-line bg-white px-2 text-sm"
    >
      {BOOKING_STATUSES.map((value) => (
        <option key={value} value={value}>
          {statusLabel(value)}
        </option>
      ))}
    </select>
  );
}
