import { CallButton } from "./CallButton";

export function StickyCallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-paper/95 p-3 shadow-[0_-8px_30px_rgba(16,32,51,0.08)] backdrop-blur sm:hidden">
      <div className="flex gap-2">
        <a
          href="/book"
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-navy text-sm font-semibold text-cream"
        >
          Book online
        </a>
        <CallButton className="flex-1" />
      </div>
    </div>
  );
}
