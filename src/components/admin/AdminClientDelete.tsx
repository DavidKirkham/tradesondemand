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

export function AdminClientDelete({
  id,
  name,
  activeJobs,
  closedJobCount,
}: {
  id: string;
  name: string;
  activeJobs: ActiveJob[];
  closedJobCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const blocked = activeJobs.length > 0;
  const nameMatches = confirm.trim().toLowerCase() === name.trim().toLowerCase();

  async function remove() {
    if (blocked || !nameMatches) return;
    setDeleting(true);
    setMessage("");
    const response = await fetch(`/api/admin/clients/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const payload = await parseResponseJson<{ error?: string; name?: string }>(response);
    setDeleting(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not delete client.");
      return;
    }
    const label = payload.name || name;
    router.push(`/admin/clients?deleted=${encodeURIComponent(label)}`);
    router.refresh();
  }

  return (
    <section id="delete" className="space-y-3 rounded-2xl border border-danger/30 bg-paper p-5">
      <h2 className="font-display text-2xl text-navy">Delete client</h2>
      <p className="text-sm text-muted">
        Permanently removes this client and their portal login. Completed or cancelled jobs stay on
        the books as unlinked tickets (name, phone, and email stay on the job). Payments stay on
        those jobs.
      </p>
      {closedJobCount > 0 && !blocked ? (
        <p className="text-sm text-muted">
          {closedJobCount} completed or cancelled {closedJobCount === 1 ? "job" : "jobs"} will be
          unlinked from this client.
        </p>
      ) : null}

      {blocked ? (
        <div className="rounded-xl border border-ember/30 bg-ember/5 px-3 py-3 text-sm text-navy">
          <p className="font-semibold">
            {activeJobs.length === 1 ? "1 active job" : `${activeJobs.length} active jobs`} still
            on this client. Complete or cancel them before deleting.
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
            Type <span className="font-semibold">{name}</span> to confirm. This cannot be undone.
          </p>
          <label className="block text-sm">
            <span className="font-medium text-navy">Client name</span>
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
          Delete client
        </button>
      )}
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </section>
  );
}
