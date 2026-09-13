"use client";

import { useEffect, useRef, useState } from "react";

export function AdminCopyPayLink({
  path,
  label = "Copy pay link",
}: {
  path: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [absolute, setAbsolute] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAbsolute(new URL(path, window.location.origin).href);
  }, [path]);

  async function copy() {
    setError("");
    const url = new URL(path, window.location.origin).href;
    setAbsolute(url);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = inputRef.current;
      if (!input) {
        setError("Could not copy. Select the link and copy it.");
        return;
      }
      input.focus();
      input.select();
      if (!document.execCommand("copy")) {
        setError("Could not copy. Select the link and copy it.");
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label className="block min-w-0">
        <span className="sr-only">Customer pay link</span>
        <input
          ref={inputRef}
          readOnly
          value={absolute}
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 w-full rounded-lg border border-line bg-white px-3 font-mono text-xs text-navy"
        />
      </label>
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
