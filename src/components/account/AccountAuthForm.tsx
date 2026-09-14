"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { isSafeAccountNextPath } from "@/lib/customer-paths";

type Mode = "signin" | "register" | "claim" | "setup";

export function AccountAuthForm({
  nextPath = "",
  initialMode = "signin",
  notice = "",
}: {
  nextPath?: string;
  initialMode?: Mode;
  notice?: string;
}) {
  const router = useRouter();
  const next = isSafeAccountNextPath(nextPath) ? nextPath : "";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const afterLogin = next || "/account";
  const banner = useMemo(() => {
    if (notice === "password") {
      return "This link cannot sign you in by itself. Use the password you already set.";
    }
    if (mode === "setup") {
      return "Choose a password for this profile. Future visits use your email and this password.";
    }
    if (mode === "claim") {
      return "Already booked with us? Match the email and phone on the ticket, then choose a password.";
    }
    return "";
  }, [mode, notice]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);

    const path =
      mode === "register"
        ? "/api/account/register"
        : mode === "signin"
          ? "/api/account/login"
          : "/api/account/password";

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "register"
          ? { name, email, phone, password, confirm }
          : mode === "signin"
            ? { email, password }
            : {
                email: mode === "claim" ? email : undefined,
                phone: mode === "claim" ? phone : undefined,
                password,
                confirm,
              },
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

  const title =
    mode === "signin" ? "Sign in" : mode === "register" ? "Create an account" : "Set a password";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="stamp text-xs text-ember">Customer portal</p>
      <h1 className="mt-2 font-display text-3xl text-navy">{title}</h1>
      <p className="mt-3 text-sm text-muted">
        Private jobs, receipts, and TOD payments. Contractors never see this login. You pay Trades
        on Demand, not the pro.
      </p>
      {banner ? <p className="mt-3 rounded-xl bg-gold/20 px-3 py-2 text-sm text-navy">{banner}</p> : null}

      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "register" ? (
          <label className="block text-sm">
            <span className="font-medium text-navy">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
            />
          </label>
        ) : null}

        {mode !== "setup" ? (
          <label className="block text-sm">
            <span className="font-medium text-navy">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
              placeholder="Email on the booking"
            />
          </label>
        ) : null}

        {mode === "register" || mode === "claim" ? (
          <label className="block text-sm">
            <span className="font-medium text-navy">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm"
              placeholder="10-digit U.S. phone"
            />
          </label>
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
          <p className="text-xs text-muted">At least 10 characters. Do not reuse a contractor or personal login.</p>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full bg-navy text-sm font-semibold text-cream disabled:opacity-60"
        >
          {pending ? "Working…" : mode === "signin" ? "Open my jobs" : "Save password and open jobs"}
        </button>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm text-muted">
        {mode === "signin" ? (
          <>
            <p>
              New here?{" "}
              <button type="button" className="font-semibold text-ember" onClick={() => setMode("register")}>
                Create an account
              </button>
            </p>
            <p>
              Booked before accounts existed?{" "}
              <button type="button" className="font-semibold text-ember" onClick={() => setMode("claim")}>
                Claim my jobs
              </button>
            </p>
            <p>
              <Link href="/account/forgot" className="font-semibold text-ember">
                Forgot password
              </Link>
            </p>
          </>
        ) : (
          <p>
            Already have a password?{" "}
            <button type="button" className="font-semibold text-ember" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </p>
        )}
        <p>
          Need a job first?{" "}
          <Link href="/book" className="font-semibold text-ember">
            Book a KC trade
          </Link>
        </p>
      </div>
    </div>
  );
}
