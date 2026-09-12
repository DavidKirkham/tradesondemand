import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallButton } from "@/components/CallButton";
import { statusDetail, statusLabel } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getTrade } from "@/lib/trades";

export const metadata: Metadata = {
  title: "Job status",
};

export const dynamic = "force-dynamic";

export default async function StatusDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ token }, { publicId: token }] },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });

  if (!booking) notFound();

  const trade = getTrade(booking.trade);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="stamp text-xs text-ember">{booking.publicId}</p>
      <h1 className="mt-2 font-display text-4xl text-navy">{statusLabel(booking.status)}</h1>
      <p className="mt-3 text-muted">{statusDetail(booking.status, booking.urgency)}</p>

      <div className="mt-8 rounded-2xl border border-line bg-paper p-6">
        <dl className="space-y-3 text-sm">
          <Row label="Trade" value={trade?.name ?? booking.trade} />
          <Row label="Urgency" value={booking.urgency} />
          <Row
            label="Job site"
            value={`${booking.street}, ${booking.city}, ${booking.state} ${booking.zip}`}
          />
          <Row label="Quote" value={booking.quoteSummary} />
          <Row label="Problem" value={booking.problem} />
        </dl>
      </div>

      <ol className="mt-8 space-y-3">
        {booking.events.map((event, index) => (
          <li key={event.id} className="flex gap-3">
            <span
              className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                index === booking.events.length - 1 ? "bg-ember" : "bg-navy"
              }`}
            />
            <div>
              <p className="font-medium text-navy">{statusLabel(event.status)}</p>
              <p className="text-xs text-muted">
                {new Date(event.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}
                {event.note ? ` · ${event.note}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <CallButton />
        <Link href="/status" className="inline-flex h-11 items-center justify-center text-sm font-semibold text-navy">
          Look up another job
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stamp text-[0.65rem] text-muted">{label}</dt>
      <dd className={`mt-1 text-navy ${label === "Urgency" ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}
