import { HomeBrandLink } from "@/components/HomeBrandLink";

export function ContractorAuthLayout({ children }: { children: import("react").ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <HomeBrandLink className="mb-6 inline-flex shrink-0" />
      {children}
    </div>
  );
}
