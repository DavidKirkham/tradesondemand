import Link from "next/link";
import { CallButton } from "@/components/CallButton";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="stamp text-xs text-ember">404</p>
      <h1 className="mt-2 font-display text-4xl text-navy">That page isn&apos;t on the board.</h1>
      <p className="mt-3 text-muted">
        If you&apos;re trying to track a job, use the status link or job ID. If you need a tech in
        KC, book or call.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/book"
          className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-cream"
        >
          Book a trade
        </Link>
        <CallButton variant="ghost" />
      </div>
    </div>
  );
}
