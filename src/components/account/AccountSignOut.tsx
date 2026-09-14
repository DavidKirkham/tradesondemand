"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/account/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="text-sm font-semibold text-muted hover:text-navy disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
