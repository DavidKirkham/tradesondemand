"use client";

import { useState } from "react";

export function AdminCopyPayLink({
  path,
  label = "Copy pay link",
}: {
  path: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    const url = new URL(path, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the link and copy it.");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="break-all font-mono text-xs text-muted">{path}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-10 items-center rounded-full bg-ember px-4 text-sm font-semibold text-white"
        >
          {copied ? "Copied" : label}
        </button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-full border border-line bg-paper px-4 text-sm font-semibold text-navy"
        >
          Open pay page
        </a>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
