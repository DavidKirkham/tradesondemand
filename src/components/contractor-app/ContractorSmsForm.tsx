"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONTRACTOR_SMS_MAX, CONTRACTOR_SMS_MIN } from "@/lib/contractor-app";
import { parseResponseJson } from "@/lib/http";
import { describeContractorCustomerSms, describeContractorEtaSms } from "@/lib/sms";

export function ContractorSmsForm({
  id,
  smsStatus,
  kind = "message",
}: {
  id: string;
  smsStatus?: string | null;
  kind?: "eta" | "message";
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function send() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/contractor/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "eta" ? { eta: text } : { message: text }),
    });
    const payload = await parseResponseJson<{
      error?: string;
      sms?: { status?: string; error?: string | null; persistSkipped?: boolean };
    }>(response);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not text the client.");
      return;
    }
    const sms = {
      status: payload.sms?.status ?? "",
      error: payload.sms?.error,
      persistSkipped: payload.sms?.persistSkipped,
    };
    setMessage(kind === "eta" ? describeContractorEtaSms(sms) : describeContractorCustomerSms(sms));
    setText("");
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-cream/40 p-3">
      <label className="block text-sm font-medium text-navy">
        {kind === "eta" ? "Text the client when you can get there" : "Text the customer"}
      </label>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={CONTRACTOR_SMS_MAX}
        placeholder={
          kind === "eta" ? "I can be there in about 45 minutes." : "On my way — call if the gate code changed."
        }
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={saving || text.trim().length < CONTRACTOR_SMS_MIN}
        onClick={() => void send()}
        className="h-11 w-full rounded-full bg-ember text-sm font-semibold text-white disabled:opacity-60"
      >
        {smsStatus === "SENT"
          ? kind === "eta"
            ? "Send another arrival text"
            : "Send another text"
          : kind === "eta"
            ? "Send arrival text"
            : "Send text"}
      </button>
      {smsStatus ? (
        <p className="text-xs text-muted">
          Last SMS: {smsStatus === "SENT" ? "sent" : smsStatus === "SKIPPED" ? "skipped" : smsStatus.toLowerCase()}
        </p>
      ) : null}
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </div>
  );
}
