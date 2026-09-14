"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ContractorAuthLayout } from "@/components/contractor-app/ContractorAuthLayout";
import { isSafeContractorNextPath } from "@/lib/contractor-paths";

type Mode = "signin" | "setup" | "first";

export function ContractorLogin({
  nextPath = "",
  initialMode = "signin",
  notice = "",
}: {
  nextPath?: string;
  initialMode?: Mode;
  notice?: string;
}) {
  const router = useRouter();
  const next = isSafeContractorNextPath(nextPath) ? nextPath : "";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const afterLogin = next || "/contractor";
  const banner = useMemo(() => {
    if (notice === "password") {
      return "This invite cannot sign you in by itself. Use the password you already set.";
    }
    if (mode === "setup") {
      return "Choose a password for this shop. Future visits use email (or shop ID) and this password.";
    }
    return "";
  }, [mode, notice]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);

    const setting = mode === "setup" || mode === "first";
    const response = await fetch(setting ? "/api/contractor/password" : "/api/contractor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        setting
          ? {
              email: mode === "first" ? email : undefined,
              phone: mode === "first" ? phone : undefined,
              password,
              confirm,
            }
          : { identifier, password },
      ),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Could not sign in.");
      return;
    }
    router.push(afterLogin);
    router.refresh();
  }

  return (
    <ContractorAuthLayout>
      <p className="stamp text-xs text-ember">Partner app</p>
      <h1 className="mt-2 font-display text-3xl text-navy">
        {mode === "signin" ? "Contractor sign in" : "Set a password"}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Approved licensed partners only. Customers pay Trades on Demand — do not collect payment on
        site.
      </p>
      {banner ? <p className="mt-3 rounded-xl bg-gold/20 px-3 py-2 text-sm text-navy">{banner}</p> : null}

      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "signin" ? (
          <label className="block text-sm">
            <span className="font-medium text-navy">Email, phone, or shop ID</span>
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
              placeholder="morgan@shop.example or PRO-D71B72"
            />
          </label>
        ) : null}

        {mode === "first" ? (
          <>
            <label className="block text-sm">
              <span className="font-medium text-navy">Email on your application</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-navy">Phone on your application</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
              />
            </label>
          </>
        ) : null}

        <label className="block text-sm">
          <span className="font-medium text-navy">{mode === "signin" ? "Password" : "New password"}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
          />
        </label>

        {mode !== "signin" ? (
          <label className="block text-sm">
            <span className="font-medium text-navy">Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
            />
          </label>
        ) : null}

        {mode !== "signin" ? (
          <p className="text-xs text-muted">At least 10 characters. Do not reuse a customer or personal login.</p>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
        >
          {pending ? "Working…" : mode === "signin" ? "Open jobs" : "Save password and open jobs"}
        </button>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm text-muted">
        {mode === "signin" ? (
          <p>
            First visit after approval?{" "}
            <button type="button" className="font-semibold text-ember" onClick={() => setMode("first")}>
              Set a password
            </button>
          </p>
        ) : (
          <p>
            Already have a password?{" "}
            <button type="button" className="font-semibold text-ember" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </p>
        )}
        <p>
          <Link href="/contractor/forgot" className="font-semibold text-ember">
            Forgot password?
          </Link>{" "}
          We text a reset code to the phone on your application. Dispatch can still reset it from
          Admin if you cannot get a text.
        </p>
        <p>
          Not approved yet?{" "}
          <Link href="/contractors/signup" className="font-semibold text-ember">
            Apply as a licensed partner
          </Link>
        </p>
      </div>
    </ContractorAuthLayout>
  );
}
