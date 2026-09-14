import Link from "next/link";
import { BrandMark } from "./BrandMark";

type HomeBrandLinkProps = {
  compact?: boolean;
  light?: boolean;
  className?: string;
  onClick?: () => void;
};

export function HomeBrandLink({
  compact = false,
  light = false,
  className = "inline-flex shrink-0",
  onClick,
}: HomeBrandLinkProps) {
  return (
    <Link href="/" aria-label="Trades on Demand home" className={className} onClick={onClick}>
      <BrandMark compact={compact} light={light} />
    </Link>
  );
}
