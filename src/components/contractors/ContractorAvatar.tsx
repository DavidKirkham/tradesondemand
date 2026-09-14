import { initials } from "@/lib/contractor";

export function ContractorAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-20 w-20 text-xl" : size === "sm" ? "h-10 w-10 text-sm" : "h-14 w-14 text-base";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-2xl bg-navy font-display font-semibold text-cream ${dim}`}
    >
      {initials(name)}
    </span>
  );
}
