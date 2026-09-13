"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseResponseJson } from "@/lib/http";

type ActiveJob = {
  id: string;
  publicId: string;
  status: string;
};

export function AdminContractorDelete({
  id,
  businessName,
  activeJobs,
  closedJobCount,
}: {
  id: string;
  businessName: string;
  activeJobs: ActiveJob[];
  closedJobCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const blocked = activeJobs.length > 0;
  const nameMatches = confirm.trim().toLowerCase() === businessName.trim().toLowerCase();

  async function remove() {
    if (blocked || !nameMatches) return;
    setDeleting(true);
    setMessage("");
    const response = await fetch(`/api/admin/contractors/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const payload = await parseResponseJson<{ error?: string; businessName?: string }>(response);
    setDeleting(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not delete subcontractor.");
      return;
    }
    const name = payload.businessName || businessName;
    router.push(`/admin/contractors?deleted=${encodeURIComponent(name)}`);
    router.refresh();
  }

  return (
    <section id="delete" className="space-y-3 rounded-2xl border border-danger/30 bg-paper p-5">
      <h2 className="font-display text-2xl text-navy">Delete subcontractor</h2>
      <p className="text-sm text-muted">
        Permanently removes this shop, their portal login, password-reset rows, and push
        subscriptions. Completed or cancelled jobs stay on the books as unassigned. Payments stay
        on those jobs.
      </p>
      {closedJobCount > 0 && !blocked ? (
        <p className="text-sm text-muted">
          {closedJobCount} completed or cancelled {closedJobCount === 1 ? "job" : "jobs"} will be
          unassigned from this shop.
        </p>
      ) : null}

      {blocked ? (
        <div className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-3 text-sm text-navy">
          <p className="font-semibold">
            {activeJobs.length === 1 ? "1 active job" : `${activeJobs.length} active jobs`} still
            assigned. Reassign, complete, or cancel them before deleting.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {activeJobs.map((job) => (
              <li key={job.id}>
                <Link href={`/admin/jobs/${job.id}`} className="font-semibold text-ember">
                  {job.publicId}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : open ? (
        <div className="space-y-3">
          <p className="text-sm text-navy">
            Type <span className="font-semibold">{businessName}</span> to confirm. This cannot be
            undone.
          </p>
          <label className="block text-sm">
            <span className="font-medium text-navy">Business name</span>
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
              className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting || !nameMatches}
              className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setMessage("");
              }}
              disabled={deleting}
              className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-navy disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white"
        >
          Delete subcontractor
        </button>
      )}
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </section>
  );
}
