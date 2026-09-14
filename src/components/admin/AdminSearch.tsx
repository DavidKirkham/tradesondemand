import type { ReactNode } from "react";

export function AdminSearch({
  action,
  q,
  extra,
  placeholder,
}: {
  action: string;
  q: string;
  placeholder: string;
  extra?: ReactNode;
}) {
  return (
    <form action={action} method="get" className="mt-4 flex flex-col gap-2 md:flex-row md:items-end">
      <label className="block flex-1 text-sm">
        <span className="sr-only">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
        />
      </label>
      {extra}
      <button type="submit" className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream">
        Search
      </button>
    </form>
  );
}
