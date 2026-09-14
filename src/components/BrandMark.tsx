type BrandMarkProps = {
  compact?: boolean;
  light?: boolean;
};

export function BrandMark({ compact = false, light = false }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? "text-cream" : "text-navy"}`}>
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-md bg-ember text-cream shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 14.5 4.8 20h3.3l1.8-3.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14.8 4.5 19 12.8l-3.1 1.3-4.4-7.4 3.3-2.2Z" strokeLinejoin="round" />
          <path d="M9.2 9.8 6.4 15" strokeLinecap="round" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="font-display block text-[1.15rem] font-semibold tracking-tight">
          Trades on Demand
        </span>
        {!compact ? (
          <span className="stamp mt-0.5 block text-[0.62rem] text-muted">Kansas City metro</span>
        ) : null}
      </span>
    </span>
  );
}
