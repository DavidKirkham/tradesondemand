import { formatPhone, getDispatchPhone, telHref } from "@/lib/phone";

type CallButtonProps = {
  variant?: "ember" | "navy" | "ghost" | "cream";
  size?: "md" | "lg";
  label?: string;
  className?: string;
};

const variants: Record<NonNullable<CallButtonProps["variant"]>, string> = {
  ember: "bg-ember text-white hover:bg-ember-dark shadow-[0_8px_24px_rgba(226,91,26,0.28)]",
  navy: "bg-navy text-cream hover:bg-navy-mid",
  ghost: "border border-line bg-paper text-navy hover:border-navy/30",
  cream: "bg-cream text-navy hover:bg-white",
};

export function CallButton({
  variant = "ember",
  size = "md",
  label,
  className = "",
}: CallButtonProps) {
  const phone = getDispatchPhone();
  const display = formatPhone(phone);

  return (
    <a
      href={telHref(phone)}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition ${
        size === "lg" ? "h-14 px-6 text-base" : "h-11 px-4 text-sm"
      } ${variants[variant]} ${className}`}
    >
      <PhoneIcon />
      <span>{label ?? `Call ${display}`}</span>
    </a>
  );
}

export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M7.2 3.8h2.3l1.2 3-1.8 1.1a12.5 12.5 0 0 0 6.2 6.2l1.1-1.8 3 1.2v2.3c0 .9-.7 1.6-1.6 1.6C9.8 17.4 3.8 11.4 3.8 4.4 3.8 3.5 4.5 2.8 5.4 2.8h1.8Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
